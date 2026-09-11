# Board: Orange Pi 3 LTS (Allwinner H6)

This gpio-companion device is an **Orange Pi 3 LTS** (exact model string: read `/proc/device-tree/model`, e.g. `Orange Pi 3 LTS`). SoC: Allwinner H6. The expansion header is a **2x13, 26-pin** header — NOT the Raspberry Pi 40-pin layout. Physical power and ground seats in the first 26 positions match the Pi, but **SoC lines are Allwinner sunxi pins, never BCM numbers**.

## Line mapping (libgpiod on Armbian/mainline H6)

- Character-device `gpiochipN` numbers follow kernel probe order and are **not stable**. On the live 3 LTS image, R-PIO (`7022000.pinctrl`, 64 lines) is `/dev/gpiochip0` and main PIO (`300b000.pinctrl`, 256 lines) is `/dev/gpiochip1`.
- Main PIO uses legacy sunxi numbering: line = 32 × bank index + pin. Header banks: **PD** (bank 3 → lines 96-127), **PH** (bank 7 → lines 224-255).
- CPUS / R-PIO (PL pins) numbering restarts at zero (**PL0 = line 0**, so PL2 = line 2, PL10 = line 10) on the 64-line chip.
- Examples on the live image: pin 7 (PD22) = `gpiochip1` line 118. Pin 8 (PL2) = `gpiochip0` line 2.
- Companion GPIO resolves pio vs rpio from `gpioinfo` chip sizes, not a hardcoded gpiochip index.
- Always confirm with `gpioinfo` before first use — the active pinmux (Armbian device tree) decides the function actually muxed on each pin.

## Safety and board quirks

- 3.3 V logic only. Never feed 5 V into a GPIO. Never short 3V3 to 5V.
- No RTC: a fresh/offline board has a wrong wall clock until NTP syncs (BLE-signed requests then fail the timestamp window until then).
- Pins 8/10 (PL2/PL3) mux to the S-UART (R_UART) — on Armbian images this is frequently the serial console. Check `cat /proc/cmdline` / `dmesg` before reusing them for projects.
- The full 26-pin table is in `pinout.md` beside this file (machine-readable: `pinout.json`).
