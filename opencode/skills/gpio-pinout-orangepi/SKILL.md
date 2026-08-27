---
name: gpio-pinout-orangepi
description: >-
  Orange Pi GPIO header mapping for gpio-companion. Use when hardware is
  orangepi. Power/GND on 40-pin boards match Raspberry Pi physical positions;
  SoC GPIO lines are NOT BCM numbers — resolve live with gpioinfo / WiringOP.
---

# Orange Pi GPIO pinout

Load this skill when `/etc/gpio-companion/config.json` has `"hardware": "orangepi"`, or `/proc/device-tree/model` contains Orange Pi.

Board SKUs are not locked. **Do not use Raspberry Pi BCM numbers** on Orange Pi.

## Detect this board

```sh
tr -d '\0' < /proc/device-tree/model
gpioinfo
command -v gpio && gpio readall
```

`gpioinfo` (libgpiod) is the source of truth for linux line names (`gpiochipN` + line). WiringOP `gpio readall` maps physical header pins when installed.

Machine-readable power/GND skeleton: `pinout.json` next to this file. Every `"resolve": "live"` pin must be filled from `gpioinfo` / `gpio readall` for the model you are on.

Logic is **3.3V**. Do not feed 5V into a GPIO. Do not short 3V3 to 5V.

## 40-pin header — power and ground

On Orange Pi boards that use a Raspberry Pi-style 2×20 header, **physical power and ground seats match the Pi**. GPIO functions on those seats do not.

```
 3V3  (1)  (2)  5V
SDA   (3)  (4)  5V
SCL   (5)  (6)  GND
GPIO  (7)  (8)  TXD
 GND  (9) (10)  RXD
GPIO (11) (12) GPIO
GPIO (13) (14) GND
GPIO (15) (16) GPIO
 3V3 (17) (18) GPIO
MOSI (19) (20) GND
MISO (21) (22) GPIO
SCLK (23) (24) CE0
 GND (25) (26) CE1
GPIO (27) (28) GPIO
GPIO (29) (30) GND
GPIO (31) (32) GPIO
GPIO (33) (34) GND
GPIO (35) (36) GPIO
GPIO (37) (38) GPIO
 GND (39) (40) GPIO
```

| Physical | Role on 40-pin OPi |
| ---: | --- |
| 1, 17 | 3V3 |
| 2, 4 | 5V |
| 6, 9, 14, 20, 25, 30, 34, 39 | GND |
| 3, 5 | typically I2C SDA/SCL — confirm with `gpioinfo` |
| 8, 10 | typically UART TX/RX — confirm |
| 19, 21, 23, 24, 26 | typically SPI — confirm |
| others | GPIO — resolve live |

Some Orange Pi models use a **26-pin** header (or 26+13). If `gpio readall` or the silkscreen is 26-pin, ignore physical 27–40.

## Technical sheets

Label wires by **physical pin** plus the **linux line** you resolved (`gpiochip0 line 12`), never a Pi BCM number.

If WiringOP is missing, install is optional (`wiringpi` / `wiringop` packages in `scripts/install-orangepi.sh`).
