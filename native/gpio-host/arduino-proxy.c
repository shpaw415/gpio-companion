#define _GNU_SOURCE
#include "Arduino.h"
#include "gpio-host.h"

#include <errno.h>
#include <fcntl.h>
#include <stdarg.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/select.h>
#include <termios.h>
#include <time.h>
#include <unistd.h>

#define MAX_PINS 128
#define START_SYSEX 0xF0
#define END_SYSEX 0xF7
#define SET_PIN_MODE 0xF4
#define SET_DIGITAL_PIN 0xF5
#define ANALOG_MESSAGE 0xE0
#define REPORT_ANALOG 0xC0
#define SYSEX_ANALOG_MAPPING_QUERY 0x69
#define SYSEX_ANALOG_MAPPING_RESPONSE 0x6A
#define SYSEX_I2C_REQUEST 0x76
#define SYSEX_I2C_CONFIG 0x78
#define SYSEX_SERIAL 0x60
#define SYSEX_SPI_DATA 0x80

enum PinKind {
	PIN_NONE = 0,
	PIN_GPIO,
	PIN_RESERVED,
};

typedef struct {
	enum PinKind kind;
	int adc;
	int pwm;
	int mode;
	int value;
} PinState;

static PinState pins[MAX_PINS];
static struct timespec start_time;
static int serial_fd = -1;
static char serial_port[128];
static int serial_baud = 57600;
static int analog_channel[MAX_PINS];
static int analog_pin_by_channel[16];
static int analog_value[16];
static int analog_fresh[16];
static int analog_map_ready;
static int analog_map_from_fw;
static int analog_queried;
static int analog_warned;
static int analog_wait;
static unsigned char analog_cmd;
static unsigned char analog_lsb;
static int in_sysex;
static unsigned char sysex_buf[80];
static uint8_t sysex_len;

int A0, A1, A2, A3, A4, A5, A6, A7, A8, A9, A10, A11, A12, A13, A14, A15;

SerialClass Serial;

static void die(const char *msg) {
	fprintf(stderr, "gpio-host-proxy: %s\n", msg);
	exit(1);
}

static void sleep_ns(long ns) {
	if (ns <= 0) {
		return;
	}
	struct timespec ts = {
		.tv_sec = ns / 1000000000L,
		.tv_nsec = ns % 1000000000L,
	};
	while (clock_nanosleep(CLOCK_MONOTONIC, 0, &ts, &ts) == EINTR) {
		if (gpio_host_stopping()) {
			return;
		}
	}
}

static speed_t baud_flag(int baud) {
	switch (baud) {
	case 9600:
		return B9600;
	case 57600:
		return B57600;
	case 115200:
		return B115200;
	default:
		return B57600;
	}
}

static void serial_open(void) {
	if (serial_fd >= 0 || serial_port[0] == 0) {
		return;
	}
	serial_fd = open(serial_port, O_RDWR | O_NOCTTY | O_NONBLOCK);
	if (serial_fd < 0) {
		die("cannot open arduino-proxy serial");
	}
	struct termios tio;
	if (tcgetattr(serial_fd, &tio) == 0) {
		cfmakeraw(&tio);
		cfsetispeed(&tio, baud_flag(serial_baud));
		cfsetospeed(&tio, baud_flag(serial_baud));
		tio.c_cflag |= CLOCAL | CREAD;
		tcsetattr(serial_fd, TCSANOW, &tio);
	}
}

static void analog_map_from_pinmap(void) {
	for (int pin = 0; pin < MAX_PINS; pin++) {
		analog_channel[pin] = -1;
	}
	for (int i = 0; i < 16; i++) {
		analog_pin_by_channel[i] = -1;
	}
	int ch = 0;
	for (int pin = 0; pin < MAX_PINS && ch < 16; pin++) {
		if (pins[pin].adc) {
			analog_channel[pin] = ch;
			analog_pin_by_channel[ch] = pin;
			ch++;
		}
	}
	analog_map_ready = 1;
}

static void handle_analog_map(const unsigned char *data, uint8_t len) {
	for (int pin = 0; pin < MAX_PINS; pin++) {
		analog_channel[pin] = -1;
	}
	for (int i = 0; i < 16; i++) {
		analog_pin_by_channel[i] = -1;
	}
	for (uint8_t pin = 0; pin < len && pin < MAX_PINS; pin++) {
		uint8_t ch = data[pin];
		if (ch < 16) {
			analog_channel[pin] = ch;
			analog_pin_by_channel[ch] = pin;
		}
	}
	analog_map_from_fw = 1;
	analog_map_ready = 1;
}

static void handle_rx_byte(unsigned char value) {
	if (in_sysex) {
		if (value == END_SYSEX) {
			in_sysex = 0;
			if (sysex_len >= 1 && sysex_buf[0] == SYSEX_ANALOG_MAPPING_RESPONSE) {
				handle_analog_map(sysex_buf + 1, (uint8_t)(sysex_len - 1));
			}
			sysex_len = 0;
			return;
		}
		if (sysex_len < sizeof(sysex_buf)) {
			sysex_buf[sysex_len++] = value;
		}
		return;
	}
	if (value == START_SYSEX) {
		in_sysex = 1;
		sysex_len = 0;
		return;
	}
	if (analog_wait) {
		if (analog_wait == 2) {
			analog_lsb = value;
			analog_wait = 1;
			return;
		}
		int ch = analog_cmd & 0x0f;
		analog_value[ch] = analog_lsb | ((value & 0x7f) << 7);
		analog_fresh[ch] = 1;
		analog_wait = 0;
		return;
	}
	if ((value & 0xF0) == ANALOG_MESSAGE) {
		analog_cmd = value;
		analog_wait = 2;
	}
}

static void serial_drain(void) {
	serial_open();
	if (serial_fd < 0) {
		return;
	}
	unsigned char buf[64];
	for (;;) {
		ssize_t n = read(serial_fd, buf, sizeof(buf));
		if (n <= 0) {
			break;
		}
		for (ssize_t i = 0; i < n; i++) {
			handle_rx_byte(buf[i]);
		}
	}
}

static int serial_wait(int timeout_ms) {
	serial_open();
	if (serial_fd < 0) {
		return -1;
	}
	fd_set rfds;
	FD_ZERO(&rfds);
	FD_SET(serial_fd, &rfds);
	struct timeval tv;
	tv.tv_sec = timeout_ms / 1000;
	tv.tv_usec = (timeout_ms % 1000) * 1000L;
	int r = select(serial_fd + 1, &rfds, NULL, NULL, &tv);
	if (r > 0) {
		serial_drain();
		return 1;
	}
	return 0;
}

static void serial_send(const unsigned char *bytes, size_t n) {
	serial_open();
	if (serial_fd < 0) {
		return;
	}
	(void)write(serial_fd, bytes, n);
}

static void send_mode(int pin, int mode) {
	unsigned char buf[3] = {SET_PIN_MODE, (unsigned char)(pin & 0x7f),
		(unsigned char)mode};
	serial_send(buf, 3);
}

static void send_digital(int pin, int value) {
	unsigned char buf[3] = {SET_DIGITAL_PIN, (unsigned char)(pin & 0x7f),
		(unsigned char)(value ? 1 : 0)};
	serial_send(buf, 3);
}

static void analog_map_query(void) {
	if (analog_map_from_fw) {
		return;
	}
	if (!analog_map_ready) {
		analog_map_from_pinmap();
	}
	if (analog_queried) {
		return;
	}
	analog_queried = 1;
	unsigned char q[] = {START_SYSEX, SYSEX_ANALOG_MAPPING_QUERY, END_SYSEX};
	serial_send(q, 3);
	unsigned long start = millis();
	while (!analog_map_from_fw && millis() - start < 80) {
		if (gpio_host_stopping()) {
			return;
		}
		serial_wait(20);
	}
}

static int resolve_analog(int pin, int *channel) {
	analog_map_query();
	if (pin >= 0 && pin < MAX_PINS && analog_channel[pin] >= 0) {
		*channel = analog_channel[pin];
		return pin;
	}
	if (pin >= 0 && pin < 16 && analog_pin_by_channel[pin] >= 0) {
		*channel = pin;
		return analog_pin_by_channel[pin];
	}
	return -1;
}

static void fill_analog_aliases(void) {
	int *aliases[] = {&A0, &A1, &A2, &A3, &A4, &A5, &A6, &A7, &A8, &A9, &A10,
		&A11, &A12, &A13, &A14, &A15};
	int n = 0;
	for (int pin = 0; pin < MAX_PINS && n < 16; pin++) {
		if (pins[pin].adc) {
			*aliases[n++] = pin;
		}
	}
}

static PinState *require_gpio(int pin, const char *op) {
	if (pin < 0 || pin >= MAX_PINS || pins[pin].kind != PIN_GPIO) {
		fprintf(stderr, "gpio-host-proxy: %s refused pin %d\n", op, pin);
		exit(1);
	}
	return &pins[pin];
}

static void parse_pinmap(const char *path) {
	FILE *file = fopen(path, "r");
	if (!file) {
		die("cannot open pinmap");
	}
	char line[256];
	while (fgets(line, sizeof(line), file)) {
		if (line[0] == '#' || line[0] == '\n') {
			continue;
		}
		if (strncmp(line, "port ", 5) == 0) {
			sscanf(line + 5, "%127s", serial_port);
			continue;
		}
		if (strncmp(line, "baud ", 5) == 0) {
			sscanf(line + 5, "%d", &serial_baud);
			continue;
		}
		int physical = 0;
		char kind[32] = {0};
		char extra[32] = {0};
		if (sscanf(line, "%d %31s %31s", &physical, kind, extra) < 2) {
			continue;
		}
		if (physical < 0 || physical >= MAX_PINS) {
			continue;
		}
		PinState *state = &pins[physical];
		if (strcmp(kind, "reserved") == 0) {
			state->kind = PIN_RESERVED;
		} else {
			state->kind = PIN_GPIO;
			if (strstr(line, "adc")) {
				state->adc = 1;
			}
			if (strstr(line, "pwm")) {
				state->pwm = 1;
			}
		}
	}
	fclose(file);
}

static void serial_begin(unsigned long baud) {
	(void)baud;
}

static void serial_print(const char *text) {
	fputs(text ? text : "", stdout);
	fflush(stdout);
}

static void serial_println(const char *text) {
	fputs(text ? text : "", stdout);
	fputc('\n', stdout);
	fflush(stdout);
}

static int serial_printf(const char *fmt, ...) {
	va_list args;
	va_start(args, fmt);
	int n = vprintf(fmt, args);
	va_end(args);
	fflush(stdout);
	return n;
}

void gpio_host_init(int argc, char **argv) {
	const char *pinmap = NULL;
	for (int i = 1; i < argc; i++) {
		if (strcmp(argv[i], "--pinmap") == 0 && i + 1 < argc) {
			pinmap = argv[++i];
		}
	}
	if (!pinmap) {
		die("missing --pinmap");
	}
	memset(pins, 0, sizeof(pins));
	parse_pinmap(pinmap);
	fill_analog_aliases();
	analog_map_from_pinmap();
	clock_gettime(CLOCK_MONOTONIC, &start_time);
	Serial.begin = serial_begin;
	Serial.print = serial_print;
	Serial.println = serial_println;
	Serial.printf = serial_printf;
	serial_open();
}

void gpio_host_shutdown(void) {
	if (serial_fd >= 0) {
		close(serial_fd);
		serial_fd = -1;
	}
}

void pinMode(int pin, int mode) {
	PinState *state = require_gpio(pin, "pinMode");
	state->mode = mode;
	if (mode == INPUT_PULLUP) {
		send_mode(pin, 11);
	} else if (mode == OUTPUT) {
		send_mode(pin, 1);
	} else {
		send_mode(pin, 0);
	}
}

void digitalWrite(int pin, int value) {
	PinState *state = require_gpio(pin, "digitalWrite");
	state->value = value ? 1 : 0;
	send_digital(pin, state->value);
}

int digitalRead(int pin) {
	PinState *state = require_gpio(pin, "digitalRead");
	return state->value ? HIGH : LOW;
}

void analogWrite(int pin, int value) {
	PinState *state = require_gpio(pin, "analogWrite");
	if (value < 0) {
		value = 0;
	}
	if (value > 255) {
		value = 255;
	}
	state->value = value >= 128;
	send_mode(pin, 3);
	unsigned char buf[3] = {
		(unsigned char)(ANALOG_MESSAGE | (pin & 0x0f)),
		(unsigned char)(value & 0x7f),
		(unsigned char)((value >> 7) & 0x7f),
	};
	serial_send(buf, 3);
}

int analogRead(int pin) {
	int channel = -1;
	int digital = resolve_analog(pin, &channel);
	if (digital < 0 || channel < 0 || channel >= 16) {
		if (!analog_warned) {
			analog_warned = 1;
			fprintf(stderr, "gpio-host-proxy: analogRead is unavailable for pin %d\n",
				pin);
		}
		return 0;
	}
	if (digital < MAX_PINS && pins[digital].kind == PIN_GPIO) {
		pins[digital].mode = INPUT;
	}
	analog_fresh[channel] = 0;
	send_mode(digital, 2);
	unsigned char report[2] = {
		(unsigned char)(REPORT_ANALOG | (channel & 0x0f)),
		1,
	};
	serial_send(report, 2);
	unsigned long start = millis();
	while (millis() - start < 150) {
		if (gpio_host_stopping()) {
			break;
		}
		serial_wait(20);
		if (analog_fresh[channel]) {
			return analog_value[channel];
		}
	}
	return analog_value[channel];
}

void tone(int pin, unsigned int frequency) {
	(void)frequency;
	analogWrite(pin, 128);
}

void noTone(int pin) {
	digitalWrite(pin, LOW);
}

void delay(unsigned long ms) {
	sleep_ns((long)ms * 1000000L);
}

void delayMicroseconds(unsigned int us) {
	sleep_ns((long)us * 1000L);
}

unsigned long millis(void) {
	struct timespec now;
	clock_gettime(CLOCK_MONOTONIC, &now);
	return (unsigned long)((now.tv_sec - start_time.tv_sec) * 1000L +
		(now.tv_nsec - start_time.tv_nsec) / 1000000L);
}

unsigned long micros(void) {
	struct timespec now;
	clock_gettime(CLOCK_MONOTONIC, &now);
	return (unsigned long)((now.tv_sec - start_time.tv_sec) * 1000000L +
		(now.tv_nsec - start_time.tv_nsec) / 1000L);
}
