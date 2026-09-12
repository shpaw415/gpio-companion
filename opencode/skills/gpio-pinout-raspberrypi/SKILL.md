---
name: gpio-pinout-raspberrypi
description: >-
  Raspberry Pi 40-pin GPIO header for gpio-companion. Use when hardware is
  raspberrypi, wiring a breadboard/PCB, or driving GPIO. Talk physical pins
  1–40 (companion API). 3.3V logic. Avoid pins 27–28.
---

# Raspberry Pi GPIO pinout

Logic is **3.3V**. Do not feed 5V into a GPIO. Do not short 3V3 to 5V.

Pin numbers are **physical** (the header seats you can see). gpio-companion drives pins by those numbers. BCM is only a label.

Orient the board with the 40-pin header on the right (USB/Ethernet typically toward you on a Pi 4/5). Pin 1 is 3V3, top-left of the header.

## Safety

- Start an LED on physical **11** or **7** with a series resistor to GND (pin 6 or 9).
- Do not use pins **27** and **28** — they are the HAT EEPROM.
- Pins **8** and **10** are UART TX/RX — often the serial console; avoid for projects.
- 5V is on pins 2 and 4 — never wire that into a GPIO.

## 40-pin header

```
 3V3  (1)  (2)  5V
SDA   (3)  (4)  5V
SCL   (5)  (6)  GND
GPIO4 (7)  (8)  TXD
 GND  (9) (10)  RXD
GPIO17(11) (12) GPIO18
GPIO27(13) (14) GND
GPIO22(15) (16) GPIO23
 3V3 (17) (18) GPIO24
MOSI (19) (20) GND
MISO (21) (22) GPIO25
SCLK (23) (24) CE0
 GND (25) (26) CE1
ID_SD(27) (28) ID_SC
GPIO5(29) (30) GND
GPIO6(31) (32) GPIO12
GPIO13(33) (34) GND
GPIO19(35) (36) GPIO16
GPIO26(37) (38) GPIO20
 GND (39) (40) GPIO21
```

| Physical | Name | Notes |
| ---: | --- | --- |
| 1 | 3V3 | Power |
| 2 | 5V | Power — never into a GPIO |
| 3 | GPIO2 | I2C SDA (BCM 2) |
| 4 | 5V | Power — never into a GPIO |
| 5 | GPIO3 | I2C SCL (BCM 3) |
| 6 | GND | Ground |
| 7 | GPIO4 | GPIO (BCM 4) — good first jumper |
| 8 | GPIO14 | UART TX (BCM 14) — often console; avoid |
| 9 | GND | Ground |
| 10 | GPIO15 | UART RX (BCM 15) — often console; avoid |
| 11 | GPIO17 | GPIO (BCM 17) — good first LED |
| 12 | GPIO18 | GPIO / PWM (BCM 18) |
| 13 | GPIO27 | GPIO (BCM 27) |
| 14 | GND | Ground |
| 15 | GPIO22 | GPIO (BCM 22) |
| 16 | GPIO23 | GPIO (BCM 23) |
| 17 | 3V3 | Power |
| 18 | GPIO24 | GPIO (BCM 24) |
| 19 | GPIO10 | SPI MOSI (BCM 10) |
| 20 | GND | Ground |
| 21 | GPIO9 | SPI MISO (BCM 9) |
| 22 | GPIO25 | GPIO (BCM 25) |
| 23 | GPIO11 | SPI SCLK (BCM 11) |
| 24 | GPIO8 | SPI CE0 (BCM 8) |
| 25 | GND | Ground |
| 26 | GPIO7 | SPI CE1 (BCM 7) |
| 27 | GPIO0 | HAT EEPROM — do not use |
| 28 | GPIO1 | HAT EEPROM — do not use |
| 29 | GPIO5 | GPIO (BCM 5) |
| 30 | GND | Ground |
| 31 | GPIO6 | GPIO (BCM 6) |
| 32 | GPIO12 | GPIO / PWM (BCM 12) |
| 33 | GPIO13 | GPIO / PWM (BCM 13) |
| 34 | GND | Ground |
| 35 | GPIO19 | GPIO / PWM (BCM 19) |
| 36 | GPIO16 | GPIO (BCM 16) |
| 37 | GPIO26 | GPIO (BCM 26) |
| 38 | GPIO20 | GPIO (BCM 20) |
| 39 | GND | Ground |
| 40 | GPIO21 | GPIO (BCM 21) |

GND: 6, 9, 14, 20, 25, 30, 34, 39. 3V3: 1, 17. 5V: 2, 4.

I2C: 3/5. SPI: 19/21/23/24/26. Hardware PWM seats: 12, 32, 33. Companion software PWM and tone work on any GPIO.

On Project, Live GPIO shows this header. Tap a pin there to drive it.

## For the on-device agent

Load when `/etc/gpio-companion/config.json` has `"hardware": "raspberrypi"`, or `/proc/device-tree/model` contains Raspberry Pi.

1. `GET http://127.0.0.1:4150/v1/gpio` first — that snapshot is the live map (physical, name, dir, value, PWM).
  2. Drive header GPIO with a C sketch (skill `gpio-host`, **physical** pins). Never BCM in the body. `PUT /v1/gpio` only for a one-shot test: `{ "physical": 11, "dir": "out", "value": 1 }`. analogWrite/tone in C, or skill `gpio-pwm` for a test. Breadboard: `gpio-breadboard`.
3. Technical sheets: **physical pin + name** so the user can see the header. Push `technical/` and `breadboard/diagram.json`.
4. Refuse power, GND, and physical 27–28. Do not `gpioset`.
