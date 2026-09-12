CC ?= gcc
CFLAGS ?= -O2 -Wall -Wextra -std=c11
LDFLAGS ?= -lgpiod -lpthread

.PHONY: all clean

all: arduino.o main.o

arduino.o: arduino.c Arduino.h gpio-host.h
	$(CC) $(CFLAGS) -c -o $@ arduino.c

main.o: main.c Arduino.h gpio-host.h
	$(CC) $(CFLAGS) -c -o $@ main.c

clean:
	rm -f arduino.o main.o
