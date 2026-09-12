CC ?= gcc
CFLAGS ?= -O2 -Wall -Wextra -std=c11
LDFLAGS ?= -lgpiod -lpthread

PREFIX ?= /usr/local
LIBDIR ?= $(PREFIX)/lib/gpio-companion

.PHONY: all clean install

all: gpio-pwm

gpio-pwm: gpio-pwm.c
	$(CC) $(CFLAGS) -o $@ $< $(LDFLAGS)

install: gpio-pwm
	install -d -m 0755 "$(LIBDIR)"
	install -m 0755 gpio-pwm "$(LIBDIR)/gpio-pwm"

clean:
	rm -f gpio-pwm
