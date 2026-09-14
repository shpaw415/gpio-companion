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
#else
#define SERIAL_BAUD 57600
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
	for (uint8_t pin = 0; pin < NUM_DIGITAL_PINS; pin++) {
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
		Serial.write(0x7f);
	}
	Serial.write(END_SYSEX);
}

static void applyMode(uint8_t pin, uint8_t mode) {
	if (pin >= NUM_DIGITAL_PINS) {
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
			if (stored < NUM_DIGITAL_PINS) {
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
			if (pin < NUM_DIGITAL_PINS) {
				pinModeStored[pin] = MODE_PWM;
				pinAnalog[pin] = (uint8_t)analog;
			}
			analogWrite(pin, analog);
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
		stored = value & 0x0F;
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
	}
#if defined(NUM_ANALOG_INPUTS)
	for (uint8_t a = 0; a < NUM_ANALOG_INPUTS && analogCount < 16; a++) {
		analogMap[analogCount++] = analogInputToDigitalPin(a);
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
}
