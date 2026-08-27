---
name: gpio-pinout-raspberrypi
description: >-
  Raspberry Pi 40-pin GPIO header pinout (BCM) for gpio-companion. Use when
  hardware is raspberrypi, wiring a breadboard/PCB, or talking to libgpiod on a
  Pi. 3.3V logic. Physical pin numbers 1–40.
---

# Raspberry Pi GPIO pinout

Load this skill when `/etc/gpio-companion/config.json` has `"hardware": "raspberrypi"`, or `/proc/device-tree/model` contains Raspberry Pi.

Machine-readable map: `pinout.json` next to this file.

Logic is **3.3V**. Do not feed 5V into a GPIO. Do not short 3V3 to 5V.

Orient the board with the 40-pin header on the right (USB/Ethernet typically toward you on a Pi 4/5). Pin 1 is 3V3, top-left of the header.

```
 3V3  (1)  (2)  5V
SDA2  (3)  (4)  5V
SCL3  (5)  (6)  GND
GPIO4 (7)  (8)  TXD14
 GND  (9) (10)  RXD15
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

| Physical | BCM | Function |
| ---: | ---: | --- |
| 1 | — | 3V3 |
| 2 | — | 5V |
| 3 | 2 | I2C1 SDA |
| 4 | — | 5V |
| 5 | 3 | I2C1 SCL |
| 6 | — | GND |
| 7 | 4 | GPIO4 / GPCLK0 |
| 8 | 14 | UART0 TXD |
| 9 | — | GND |
| 10 | 15 | UART0 RXD |
| 11 | 17 | GPIO17 |
| 12 | 18 | GPIO18 / PCM CLK / PWM |
| 13 | 27 | GPIO27 |
| 14 | — | GND |
| 15 | 22 | GPIO22 |
| 16 | 23 | GPIO23 |
| 17 | — | 3V3 |
| 18 | 24 | GPIO24 |
| 19 | 10 | SPI0 MOSI |
| 20 | — | GND |
| 21 | 9 | SPI0 MISO |
| 22 | 25 | GPIO25 |
| 23 | 11 | SPI0 SCLK |
| 24 | 8 | SPI0 CE0 |
| 25 | — | GND |
| 26 | 7 | SPI0 CE1 |
| 27 | 0 | ID_SD (HAT EEPROM) — avoid for general IO |
| 28 | 1 | ID_SC (HAT EEPROM) — avoid for general IO |
| 29 | 5 | GPIO5 |
| 30 | — | GND |
| 31 | 6 | GPIO6 |
| 32 | 12 | GPIO12 / PWM0 |
| 33 | 13 | GPIO13 / PWM1 |
| 34 | — | GND |
| 35 | 19 | GPIO19 / PCM FS |
| 36 | 16 | GPIO16 |
| 37 | 26 | GPIO26 |
| 38 | 20 | GPIO20 / PCM DIN |
| 39 | — | GND |
| 40 | 21 | GPIO21 / PCM DOUT |

On Armbian/libgpiod, BCM N is usually `gpiochip0` line N. Confirm with `gpioinfo` before driving a pin.

Prefer BCM numbers in code and physical numbers on technical sheets so the user can see the header.
