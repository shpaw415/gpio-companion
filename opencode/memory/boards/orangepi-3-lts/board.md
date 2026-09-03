# Board: Orange Pi 3 LTS (Allwinner H6)

This gpio-companion device is an **Orange Pi 3 LTS** (exact model string: read `/proc/device-tree/model`, e.g. `Orange Pi 3 LTS`). SoC: Allwinner H6. The expansion header is a **2x13, 26-pin** header — NOT the Raspberry Pi 40-pin layout. Physical power and ground seats in the first 26 positions match the Pi, but **SoC lines are Allwinner sunxi pins, never BCM numbers**.

## Line mapping (libgpiod on Armbian/mainline H6)

- Main PIO = `gpiochip0`, using the legacy sunxi numbering: line = 32 x bank index + pin. Banks on the header: **PD** (bank 3 → lines 96-127), **PH** (bank 7 → lines 224-255).
- CPUS / R-PIO (PL pins) = `gpiochip1`; its line numbering restarts at zero (**PL0 = gpiochip1 line 0**, so PL2 = line 2, PL10 = line 10).
- Examples: pin 7 (PD22) = `gpiochip0` line 118. Pin 8 (PL2) = `gpiochip1` line 2.
- WiringOP `gpio readall` matches this table when installed.
- Always confirm with `gpioinfo` before first use — the active pinmux (Armbian device tree) decides the function actually muxed on each pin.

## Safety and board quirks

- 3.3 V logic only. Never feed 5 V into a GPIO. Never short 3V3 to 5V.
- No RTC: a fresh/offline board has a wrong wall clock until NTP syncs (BLE-signed requests then fail the timestamp window until then).
- Pins 8/10 (PL2/PL3) mux to the S-UART (R_UART) — on Armbian images this is frequently the serial console. Check `cat /proc/cmdline` / `dmesg` before reusing them for projects.
- The full 26-pin table is in `pinout.md` beside this file (machine-readable: `pinout.json`).
