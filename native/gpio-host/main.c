#include "Arduino.h"
#include "gpio-host.h"

#include <signal.h>

static volatile sig_atomic_t stop_flag = 0;

static void on_signal(int sig) {
	(void)sig;
	stop_flag = 1;
}

int gpio_host_stopping(void) {
	return stop_flag ? 1 : 0;
}

int main(int argc, char **argv) {
	signal(SIGTERM, on_signal);
	signal(SIGINT, on_signal);
	signal(SIGHUP, on_signal);
	gpio_host_init(argc, argv);
	setup();
	while (!gpio_host_stopping()) {
		loop();
	}
	gpio_host_shutdown();
	return 0;
}
