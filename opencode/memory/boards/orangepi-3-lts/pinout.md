# Orange Pi 3 LTS 26-pin header pinout

Orient the board with the header on the board edge; pin 1 (3V3) is top-left. **26 pins only** — ignore anything you may remember about Pi header positions 27-40.

| Physical | SoC line | libgpiod | Default mux / notes |
| ---: | --- | --- | --- |
| 1 | — | — | 3V3 power |
| 2 | — | — | 5V power |
| 3 | PD26 | main PIO line 122 | TWI0 SDA (I2C) |
| 4 | — | — | 5V power |
| 5 | PD25 | main PIO line 121 | TWI0 SCL (I2C) |
| 6 | — | — | GND |
| 7 | PD22 | main PIO line 118 | GPIO |
| 8 | PL2 | R-PIO line 2 | S-UART TX (often the Armbian serial console — check before reuse) |
| 9 | — | — | GND |
| 10 | PL3 | R-PIO line 3 | S-UART RX (often the Armbian serial console — check before reuse) |
| 11 | PD24 | main PIO line 120 | TWI2 SDA (I2C) |
| 12 | PD18 | main PIO line 114 | GPIO (PWM capable per pinmux) |
| 13 | PD23 | main PIO line 119 | TWI2 SCL (I2C) |
| 14 | — | — | GND |
| 15 | PL10 | R-PIO line 10 | GPIO (R-PIO domain) |
| 16 | PD15 | main PIO line 111 | GPIO |
| 17 | — | — | 3V3 power |
| 18 | PD16 | main PIO line 112 | GPIO |
| 19 | PH5 | main PIO line 229 | SPI1 MOSI or TWI1 SCL |
| 20 | — | — | GND |
| 21 | PH6 | main PIO line 230 | SPI1 MISO or TWI1 SDA |
| 22 | PD21 | main PIO line 117 | GPIO |
| 23 | PH4 | main PIO line 228 | SPI1 CLK |
| 24 | PH3 | main PIO line 227 | SPI1 CS |
| 25 | — | — | GND |
| 26 | PL8 | R-PIO line 8 | GPIO (R-PIO domain) |

GND pins: 6, 9, 14, 20, 25. Power: 3V3 on 1 and 17; 5V on 2 and 4.

I2C pairs: pins 3/5 = TWI0 (SDA on 3, SCL on 5), pins 11/13 = TWI2 (SDA on 11, SCL on 13) — verify polarity on your running image with `i2cdetect -y <bus>` before wiring. SPI1 group: pins 19/21/23/24 (MOSI/MISO/CLK/CS); TWI1 shares pins 19/21 with SPI1 — the Armbian device tree decides which is active.

Sources: WiringOP `physToGpio_3` / `ORANGEPI_PIN_MASK_3` tables (the same data `gpio readall` shows on this board) and mainline sun50i-h6 pinmux definitions.
