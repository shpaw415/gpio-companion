#include <Arduino.h>
#include <Wire.h>
#include <SPI.h>

#define START_SYSEX 0xF0
#define END_SYSEX 0xF7
#define SET_PIN_MODE 0xF4
#define SET_DIGITAL_PIN 0xF5
#define DIGITAL_MESSAGE 0x90
#define ANALOG_MESSAGE 0xE0
#define REPORT_ANALOG 0xC0
#define REPORT_DIGITAL 0xD0
#define REPORT_VERSION 0xF9
#define SYSEX_REPORT_FIRMWARE 0x79
#define SYSEX_CAPABILITY_QUERY 0x6C
#define SYSEX_ANALOG_MAPPING_QUERY 0x69
#define SYSEX_ANALOG_MAPPING_RESPONSE 0x6A
#define SYSEX_I2C_REQUEST 0x76
#define SYSEX_I2C_CONFIG 0x78
#define SYSEX_SERIAL 0x60
#define SYSEX_SPI_DATA 0x80

#define MODE_INPUT 0
#define MODE_OUTPUT 1
#define MODE_ANALOG 2
#define MODE_PWM 3
#define MODE_I2C 6
#define MODE_SERIAL 10
#define MODE_PULLUP 11
#define MODE_SPI 12

#if defined(ESP32)
#define SERIAL_BAUD 115200
#define ANALOG_RESOLUTION 12
#else
#define SERIAL_BAUD 57600
#define ANALOG_RESOLUTION 10
#endif

#ifndef LED_BUILTIN
#define LED_BUILTIN 13
#endif

static uint8_t pinModeStored[128];
static uint8_t pinAnalog[128];
static uint8_t reportDigital[16];
static uint8_t reportAnalog[16];
static int analogMap[16];
static uint8_t analogCount;
static uint8_t sysex[64];
static uint8_t sysexLen;
static uint8_t inSysex;

static void sendSysex(uint8_t command, const uint8_t *data, uint8_t len) {
	Serial.write(START_SYSEX);
	Serial.write(command);
	if (data && len) {
		Serial.write(data, len);
	}
	Serial.write(END_SYSEX);
}

static int analogDigitalPin(uint8_t channel) {
#if defined(ESP32)
	(void)channel;
	return -1;
#elif defined(analogInputToDigitalPin)
	int mapped = analogInputToDigitalPin(channel);
	if (mapped >= 0) {
		return mapped;
	}
#endif
#if defined(A0)
	return (int)A0 + (int)channel;
#else
	return -1;
#endif
}

static int analogChannelForPin(int pin) {
	for (uint8_t i = 0; i < analogCount; i++) {
		if (analogMap[i] == pin) {
			return i;
		}
	}
	return -1;
}

static uint8_t pinCount() {
	uint8_t n = NUM_DIGITAL_PINS;
	for (uint8_t i = 0; i < analogCount; i++) {
		if (analogMap[i] >= 0 && analogMap[i] + 1 > n) {
			n = (uint8_t)(analogMap[i] + 1);
		}
	}
	return n;
}

static int pinSupported(uint8_t pin) {
	if (pin < NUM_DIGITAL_PINS) {
		return 1;
	}
	return analogChannelForPin(pin) >= 0;
}

static int bindAnalogChannel(uint8_t ch) {
	if (ch >= 16) {
		return -1;
	}
	if (analogMap[ch] >= 0) {
		return analogMap[ch];
	}
	for (uint8_t pin = 0; pin < 128; pin++) {
		if (pinModeStored[pin] == MODE_ANALOG && analogChannelForPin(pin) < 0) {
			analogMap[ch] = pin;
			if (ch >= analogCount) {
				analogCount = ch + 1;
			}
			return pin;
		}
	}
	return -1;
}

static int sampleAnalogChannel(uint8_t ch) {
	if (ch >= analogCount) {
		return 0;
	}
	int pin = analogMap[ch];
	if (pin >= 0) {
		return analogRead(pin);
	}
#if defined(ESP32)
	return 0;
#else
	return analogRead(ch);
#endif
}

static void sendAnalog(uint8_t ch, int value) {
	if (value < 0) {
		value = 0;
	}
	if (value > 16383) {
		value = 16383;
	}
	Serial.write(ANALOG_MESSAGE | (ch & 0x0F));
	Serial.write(value & 0x7f);
	Serial.write((value >> 7) & 0x7f);
}

static void reportAnalogChannel(uint8_t ch) {
	if (ch >= analogCount) {
		return;
	}
	int pin = analogMap[ch];
	if (pin >= 0 && pin < 128 && pinModeStored[pin] == MODE_PWM) {
		return;
	}
	sendAnalog(ch, sampleAnalogChannel(ch));
}

static void sendFirmware() {
	const char *name = "gpio-companion-proxy";
	uint8_t payload[48];
	uint8_t n = 0;
	payload[n++] = 2;
	payload[n++] = 5;
	for (uint8_t i = 0; name[i] && n + 1 < sizeof(payload); i++) {
		payload[n++] = (uint8_t)name[i] & 0x7f;
		payload[n++] = 0;
	}
	sendSysex(SYSEX_REPORT_FIRMWARE, payload, n);
}

static void sendCapabilities() {
	Serial.write(START_SYSEX);
	Serial.write(SYSEX_CAPABILITY_QUERY);
	uint8_t n = pinCount();
	for (uint8_t pin = 0; pin < n; pin++) {
		if (pin < NUM_DIGITAL_PINS) {
			Serial.write((uint8_t)MODE_INPUT);
			Serial.write((uint8_t)1);
			Serial.write((uint8_t)MODE_OUTPUT);
			Serial.write((uint8_t)1);
			Serial.write((uint8_t)MODE_PULLUP);
			Serial.write((uint8_t)1);
			if (digitalPinHasPWM(pin)) {
				Serial.write((uint8_t)MODE_PWM);
				Serial.write((uint8_t)8);
			}
		}
		if (analogChannelForPin(pin) >= 0) {
			Serial.write((uint8_t)MODE_ANALOG);
			Serial.write((uint8_t)ANALOG_RESOLUTION);
		}
		Serial.write(0x7f);
	}
	Serial.write(END_SYSEX);
}

static void sendAnalogMapping() {
	Serial.write(START_SYSEX);
	Serial.write(SYSEX_ANALOG_MAPPING_RESPONSE);
	uint8_t n = pinCount();
	for (uint8_t pin = 0; pin < n; pin++) {
		int ch = analogChannelForPin(pin);
		Serial.write(ch >= 0 ? (uint8_t)ch : 0x7f);
	}
	Serial.write(END_SYSEX);
}

static void applyMode(uint8_t pin, uint8_t mode) {
	if (!pinSupported(pin)) {
		return;
	}
	pinModeStored[pin] = mode;
	if (mode != MODE_PWM) {
		pinAnalog[pin] = 0;
	}
	if (mode == MODE_OUTPUT || mode == MODE_PWM) {
		pinMode(pin, OUTPUT);
	} else if (mode == MODE_PULLUP) {
		pinMode(pin, INPUT_PULLUP);
	} else {
		pinMode(pin, INPUT);
	}
}

static void handleSysex() {
	if (sysexLen < 1) {
		return;
	}
	uint8_t command = sysex[0];
	if (command == SYSEX_REPORT_FIRMWARE) {
		sendFirmware();
		return;
	}
	if (command == SYSEX_CAPABILITY_QUERY) {
		sendCapabilities();
		return;
	}
	if (command == SYSEX_ANALOG_MAPPING_QUERY) {
		sendAnalogMapping();
		return;
	}
	if (command == SYSEX_I2C_CONFIG) {
		Wire.begin();
		return;
	}
	if (command == SYSEX_I2C_REQUEST && sysexLen >= 3) {
		uint8_t address = sysex[1];
		uint8_t mode = (sysex[2] >> 3) & 0x07;
		Wire.begin();
		if (mode == 0) {
			Wire.beginTransmission(address);
			for (uint8_t i = 3; i + 1 < sysexLen; i += 2) {
				Wire.write((sysex[i] & 0x7f) | ((sysex[i + 1] & 0x7f) << 7));
			}
			Wire.endTransmission();
		} else {
			uint8_t length = 1;
			if (sysexLen >= 5) {
				length = (sysex[3] & 0x7f) | ((sysex[4] & 0x7f) << 7);
			}
			uint8_t got = Wire.requestFrom((int)address, (int)length);
			uint8_t reply[40];
			uint8_t n = 0;
			reply[n++] = address & 0x7f;
			reply[n++] = 0;
			reply[n++] = 0;
			reply[n++] = 0;
			while (got && n + 1 < sizeof(reply)) {
				uint8_t value = Wire.read();
				got--;
				reply[n++] = value & 0x7f;
				reply[n++] = (value >> 7) & 0x7f;
			}
			sendSysex(0x77, reply, n);
		}
		return;
	}
	if (command == SYSEX_SPI_DATA) {
		SPI.begin();
		for (uint8_t i = 2; i + 1 < sysexLen; i += 2) {
			SPI.transfer((sysex[i] & 0x7f) | ((sysex[i + 1] & 0x7f) << 7));
		}
		return;
	}
#if defined(HAVE_HWSERIAL1)
	if (command == SYSEX_SERIAL && sysexLen >= 2) {
		uint8_t sub = sysex[1];
		if ((sub >> 4) == 1) {
			Serial1.begin(9600);
			for (uint8_t i = 2; i + 1 < sysexLen; i += 2) {
				Serial1.write((sysex[i] & 0x7f) | ((sysex[i + 1] & 0x7f) << 7));
			}
		}
	}
#endif
}

static void handleByte(uint8_t value) {
	static uint8_t stored = 0;
	static uint8_t wait = 0;
	static uint8_t cmd = 0;
	if (inSysex) {
		if (value == END_SYSEX) {
			inSysex = 0;
			handleSysex();
			sysexLen = 0;
			return;
		}
		if (sysexLen < sizeof(sysex)) {
			sysex[sysexLen++] = value;
		}
		return;
	}
	if (value == START_SYSEX) {
		inSysex = 1;
		sysexLen = 0;
		return;
	}
	if (wait) {
		if (wait == 2) {
			stored = value;
			wait = 1;
			return;
		}
		if (cmd == SET_PIN_MODE) {
			applyMode(stored, value);
		} else if (cmd == SET_DIGITAL_PIN) {
			if (stored < 128 && pinSupported(stored)) {
				pinModeStored[stored] = MODE_OUTPUT;
				pinAnalog[stored] = 0;
			}
			digitalWrite(stored, value ? HIGH : LOW);
		} else if ((cmd & 0xF0) == ANALOG_MESSAGE) {
			uint8_t pin = cmd & 0x0F;
			int analog = stored | ((value & 0x7f) << 7);
			if (analog > 255) {
				analog = 255;
			}
			if (pin < 128 && pinSupported(pin)) {
				pinModeStored[pin] = MODE_PWM;
				pinAnalog[pin] = (uint8_t)analog;
			}
			analogWrite(pin, analog);
		} else if ((cmd & 0xF0) == REPORT_ANALOG) {
			uint8_t ch = cmd & 0x0F;
			reportAnalog[ch] = value ? 1 : 0;
			if (reportAnalog[ch]) {
				bindAnalogChannel(ch);
				reportAnalogChannel(ch);
			}
		} else if ((cmd & 0xF0) == REPORT_DIGITAL) {
			reportDigital[cmd & 0x0F] = value ? 1 : 0;
		}
		wait = 0;
		return;
	}
	if (value == REPORT_VERSION) {
		Serial.write(REPORT_VERSION);
		Serial.write(2);
		Serial.write(5);
		return;
	}
	if (value == SET_PIN_MODE || value == SET_DIGITAL_PIN) {
		cmd = value;
		wait = 2;
		return;
	}
	if ((value & 0xF0) == ANALOG_MESSAGE) {
		cmd = value;
		wait = 2;
		return;
	}
	if ((value & 0xF0) == REPORT_DIGITAL) {
		cmd = value;
		wait = 1;
		return;
	}
	if ((value & 0xF0) == REPORT_ANALOG) {
		cmd = value;
		wait = 1;
		return;
	}
}

void setup() {
	Serial.begin(SERIAL_BAUD);
	analogCount = 0;
	for (uint8_t i = 0; i < 128; i++) {
		pinModeStored[i] = 0xFF;
	}
	for (uint8_t i = 0; i < 16; i++) {
		analogMap[i] = -1;
		reportAnalog[i] = 0;
		reportDigital[i] = 0;
	}
#if defined(NUM_ANALOG_INPUTS)
	analogCount = NUM_ANALOG_INPUTS;
	if (analogCount > 16) {
		analogCount = 16;
	}
	for (uint8_t a = 0; a < analogCount; a++) {
		analogMap[a] = analogDigitalPin(a);
	}
#endif
	applyMode(LED_BUILTIN, MODE_OUTPUT);
	sendFirmware();
}

void loop() {
	while (Serial.available()) {
		handleByte((uint8_t)Serial.read());
	}
	static uint32_t last = 0;
	if (millis() - last < 50) {
		return;
	}
	last = millis();
	for (uint8_t port = 0; port < (NUM_DIGITAL_PINS + 7) / 8; port++) {
		uint16_t bits = 0;
		uint8_t any = 0;
		for (uint8_t bit = 0; bit < 8; bit++) {
			uint8_t pin = port * 8 + bit;
			if (pin >= NUM_DIGITAL_PINS) {
				continue;
			}
#if !defined(USBCON)
			if (pin < 2) {
				continue;
			}
#endif
			if (pinModeStored[pin] != MODE_INPUT && pinModeStored[pin] != MODE_PULLUP) {
				continue;
			}
			any = 1;
			if (digitalRead(pin)) {
				bits |= (1 << bit);
			}
		}
		if (!any) {
			continue;
		}
		Serial.write(DIGITAL_MESSAGE | port);
		Serial.write(bits & 0x7f);
		Serial.write((bits >> 7) & 0x7f);
	}
	for (uint8_t ch = 0; ch < analogCount && ch < 16; ch++) {
		if (!reportAnalog[ch]) {
			continue;
		}
		reportAnalogChannel(ch);
	}
}
