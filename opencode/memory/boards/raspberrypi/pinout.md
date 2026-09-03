# Raspberry Pi 40-pin header pinout (BCM)

Orient the board with the 40-pin header on the right edge; pin 1 (3V3) is top-left of the header.

| Physical | BCM | Name | Alt functions |
| ---: | ---: | --- | --- |
| 1 | — | 3V3 | power |
| 2 | — | 5V | power |
| 3 | 2 | GPIO2 | I2C1 SDA |
| 4 | — | 5V | power |
| 5 | 3 | GPIO3 | I2C1 SCL |
| 6 | — | GND | ground |
| 7 | 4 | GPIO4 | GPCLK0 |
| 8 | 14 | GPIO14 | UART0 TXD |
| 9 | — | GND | ground |
| 10 | 15 | GPIO15 | UART0 RXD |
| 11 | 17 | GPIO17 | — |
| 12 | 18 | GPIO18 | PWM0, PCM_CLK |
| 13 | 27 | GPIO27 | — |
| 14 | — | GND | ground |
| 15 | 22 | GPIO22 | — |
| 16 | 23 | GPIO23 | — |
| 17 | — | 3V3 | power |
| 18 | 24 | GPIO24 | — |
| 19 | 10 | GPIO10 | SPI0 MOSI |
| 20 | — | GND | ground |
| 21 | 9 | GPIO9 | SPI0 MISO |
| 22 | 25 | GPIO25 | — |
| 23 | 11 | GPIO11 | SPI0 SCLK |
| 24 | 8 | GPIO8 | SPI0 CE0 |
| 25 | — | GND | ground |
| 26 | 7 | GPIO7 | SPI0 CE1 |
| 27 | 0 | GPIO0 | ID_SD / HAT EEPROM |
| 28 | 1 | GPIO1 | ID_SC / HAT EEPROM |
| 29 | 5 | GPIO5 | — |
| 30 | — | GND | ground |
| 31 | 6 | GPIO6 | — |
| 32 | 12 | GPIO12 | PWM0 |
| 33 | 13 | GPIO13 | PWM1 |
| 34 | — | GND | ground |
| 35 | 19 | GPIO19 | PWM1, SPI1 MISO, PCM_FS |
| 36 | 16 | GPIO16 | SPI1 CE2 |
| 37 | 26 | GPIO26 | — |
| 38 | 20 | GPIO20 | SPI1 MOSI, PCM_DIN |
| 39 | — | GND | ground |
| 40 | 21 | GPIO21 | SPI1 SCLK, PCM_DOUT |

Source: pinout.xyz mapping, shipped as `opencode/skills/gpio-pinout-raspberrypi/pinout.json`.
