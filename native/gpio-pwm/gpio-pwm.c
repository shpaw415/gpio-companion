#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <gpiod.h>
#include <poll.h>
#include <pthread.h>
#include <sched.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

#define CONSUMER "gpio-pwm"
#define ANALOG_MAX 255
#define DEFAULT_HZ 490

static volatile sig_atomic_t stop_flag = 0;
static pthread_mutex_t lock = PTHREAD_MUTEX_INITIALIZER;
static int duty = 0;
static int hz = DEFAULT_HZ;
static unsigned int line_offset;
static struct gpiod_line_request *request = NULL;

static void on_signal(int sig) {
	(void)sig;
	stop_flag = 1;
}

static void die(const char *msg) {
	fprintf(stderr, "gpio-pwm: %s\n", msg);
	exit(1);
}

static void set_line(int high) {
	enum gpiod_line_value value =
		high ? GPIOD_LINE_VALUE_ACTIVE : GPIOD_LINE_VALUE_INACTIVE;
	if (gpiod_line_request_set_value(request, line_offset, value) < 0) {
		stop_flag = 1;
	}
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
		if (stop_flag) {
			return;
		}
	}
}

static void *pwm_loop(void *arg) {
	(void)arg;
	while (!stop_flag) {
		pthread_mutex_lock(&lock);
		int current_duty = duty;
		int current_hz = hz;
		pthread_mutex_unlock(&lock);
		if (current_hz < 1) {
			current_hz = 1;
		}
		if (current_duty <= 0) {
			set_line(0);
			sleep_ns(1000000L);
			continue;
		}
		if (current_duty >= ANALOG_MAX) {
			set_line(1);
			sleep_ns(1000000L);
			continue;
		}
		long period_ns = 1000000000L / current_hz;
		long high_ns = (period_ns * current_duty) / ANALOG_MAX;
		long low_ns = period_ns - high_ns;
		set_line(1);
		sleep_ns(high_ns);
		if (stop_flag) {
			break;
		}
		set_line(0);
		sleep_ns(low_ns);
	}
	set_line(0);
	return NULL;
}

static int parse_int(const char *text, int min, int max, const char *name) {
	char *end = NULL;
	long value = strtol(text, &end, 10);
	if (end == text || (end && *end != '\0' && *end != '\n') || value < min ||
		value > max) {
		fprintf(stderr, "gpio-pwm: %s must be %d-%d\n", name, min, max);
		exit(1);
	}
	return (int)value;
}

static void apply_line(char *line) {
	if (strncmp(line, "duty ", 5) == 0) {
		int next = parse_int(line + 5, 0, ANALOG_MAX, "duty");
		pthread_mutex_lock(&lock);
		duty = next;
		pthread_mutex_unlock(&lock);
		return;
	}
	if (strncmp(line, "hz ", 3) == 0) {
		int next = parse_int(line + 3, 31, 65535, "hz");
		pthread_mutex_lock(&lock);
		hz = next;
		pthread_mutex_unlock(&lock);
		return;
	}
	if (strncmp(line, "stop", 4) == 0) {
		stop_flag = 1;
	}
}

static char *chip_path(const char *chip) {
	static char path[128];
	if (chip[0] == '/') {
		return (char *)chip;
	}
	snprintf(path, sizeof(path), "/dev/%s", chip);
	return path;
}

int main(int argc, char **argv) {
	const char *chip = NULL;
	const char *mode = "pwm";
	int analog = 128;
	int frequency = DEFAULT_HZ;
	int have_line = 0;

	for (int i = 1; i < argc; i++) {
		if (strcmp(argv[i], "--chip") == 0 && i + 1 < argc) {
			chip = argv[++i];
		} else if (strcmp(argv[i], "--line") == 0 && i + 1 < argc) {
			line_offset = (unsigned int)parse_int(argv[++i], 0, 511, "line");
			have_line = 1;
		} else if (strcmp(argv[i], "--mode") == 0 && i + 1 < argc) {
			mode = argv[++i];
		} else if (strcmp(argv[i], "--duty") == 0 && i + 1 < argc) {
			analog = parse_int(argv[++i], 0, ANALOG_MAX, "duty");
		} else if (strcmp(argv[i], "--hz") == 0 && i + 1 < argc) {
			frequency = parse_int(argv[++i], 31, 65535, "hz");
		} else {
			die("usage: gpio-pwm --chip gpiochipN --line N [--mode pwm|tone] [--duty 0-255] [--hz N]");
		}
	}
	if (!chip || !have_line) {
		die("usage: gpio-pwm --chip gpiochipN --line N [--mode pwm|tone] [--duty 0-255] [--hz N]");
	}
	if (strcmp(mode, "tone") == 0) {
		analog = 128;
	}

	signal(SIGTERM, on_signal);
	signal(SIGINT, on_signal);
	signal(SIGHUP, on_signal);

	struct gpiod_chip *gpiochip = gpiod_chip_open(chip_path(chip));
	if (!gpiochip) {
		die("cannot open gpiochip");
	}
	struct gpiod_line_settings *settings = gpiod_line_settings_new();
	struct gpiod_line_config *config = gpiod_line_config_new();
	struct gpiod_request_config *req_cfg = gpiod_request_config_new();
	if (!settings || !config || !req_cfg) {
		die("gpiod alloc failed");
	}
	gpiod_line_settings_set_direction(settings, GPIOD_LINE_DIRECTION_OUTPUT);
	gpiod_line_settings_set_output_value(settings, GPIOD_LINE_VALUE_INACTIVE);
	unsigned int offsets[1] = {line_offset};
	if (gpiod_line_config_add_line_settings(config, offsets, 1, settings) < 0) {
		die("line config failed");
	}
	gpiod_request_config_set_consumer(req_cfg, CONSUMER);
	request = gpiod_chip_request_lines(gpiochip, req_cfg, config);
	gpiod_line_settings_free(settings);
	gpiod_line_config_free(config);
	gpiod_request_config_free(req_cfg);
	gpiod_chip_close(gpiochip);
	if (!request) {
		die("request lines failed");
	}

	duty = analog;
	hz = frequency;

	struct sched_param param = {.sched_priority = 10};
	pthread_setschedparam(pthread_self(), SCHED_FIFO, &param);

	pthread_t thread;
	if (pthread_create(&thread, NULL, pwm_loop, NULL) != 0) {
		die("thread failed");
	}

	char buf[128];
	struct pollfd fd = {.fd = STDIN_FILENO, .events = POLLIN};
	while (!stop_flag) {
		int ready = poll(&fd, 1, 200);
		if (ready < 0) {
			if (errno == EINTR) {
				continue;
			}
			break;
		}
		if (ready == 0) {
			continue;
		}
		if (fd.revents & (POLLERR | POLLHUP | POLLNVAL)) {
			stop_flag = 1;
			break;
		}
		if (!(fd.revents & POLLIN)) {
			continue;
		}
		ssize_t n = read(STDIN_FILENO, buf, sizeof(buf) - 1);
		if (n <= 0) {
			stop_flag = 1;
			break;
		}
		buf[n] = '\0';
		char *save = NULL;
		for (char *line = strtok_r(buf, "\n", &save); line;
			 line = strtok_r(NULL, "\n", &save)) {
			apply_line(line);
		}
	}

	stop_flag = 1;
	pthread_join(thread, NULL);
	gpiod_line_request_release(request);
	return 0;
}
