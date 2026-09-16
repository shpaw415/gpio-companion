#define _GNU_SOURCE
#include "Arduino.h"
#include "gpio-host.h"

#include <errno.h>
#include <fcntl.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <termios.h>
#include <time.h>
#include <unistd.h>

#define MAX_PINS 128
#define START_SYSEX 0xF0
#define END_SYSEX 0xF7
#define SET_PIN_MODE 0xF4
#define SET_DIGITAL_PIN 0xF5
#define ANALOG_MESSAGE 0xE0
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
	PinState *state = require_gpio(pin, "analogRead");
	if (!state->adc) {
		return 0;
	}
	return 0;
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
