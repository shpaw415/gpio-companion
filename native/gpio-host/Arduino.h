#ifndef GPIO_COMPANION_ARDUINO_H
#define GPIO_COMPANION_ARDUINO_H

#ifdef __cplusplus
extern "C" {
#endif

#define HIGH 1
#define LOW 0
#define INPUT 0
#define OUTPUT 1
#define INPUT_PULLUP 2

void pinMode(int pin, int mode);
void digitalWrite(int pin, int value);
int digitalRead(int pin);
void analogWrite(int pin, int value);
int analogRead(int pin);
void tone(int pin, unsigned int frequency);
void noTone(int pin);
void delay(unsigned long ms);
void delayMicroseconds(unsigned int us);
unsigned long millis(void);
unsigned long micros(void);

typedef struct {
	void (*begin)(unsigned long baud);
	void (*print)(const char *text);
	void (*println)(const char *text);
	int (*printf)(const char *fmt, ...);
} SerialClass;

extern SerialClass Serial;

void setup(void);
void loop(void);

#ifdef __cplusplus
}
#endif

#endif
