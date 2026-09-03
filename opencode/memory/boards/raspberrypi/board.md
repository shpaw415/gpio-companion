# Board: Raspberry Pi (family)

This gpio-companion device is a **Raspberry Pi** (exact model string: read `/proc/device-tree/model`). The header is a 2x20, 40-pin GPIO header with **BCM GPIO numbering** and 3.3 V logic.

## Line mapping (libgpiod)

- **Pi 3 / Pi 4 (and older):** BCM `N` is `gpiochip0` line `N`. Example: BCM 17 = `gpiochip0` line 17.
- **Pi 5:** the GPIO controller is RP1. Lines are **named** `GPIO25` etc. — prefer named lookup (`gpiofind "GPIO25"`). Raw line numbers are offset (BCM 25 lives on `gpiochip4` at line 437); confirm with `gpioinfo` before driving a pin raw.
- Always confirm with `gpioinfo` before first use on a board you have not driven before.

## Safety

- 3.3 V logic only. Never feed 5 V into a GPIO. Never short 3V3 to 5V.
- Pins 27/28 (BCM 0/1) are reserved for HAT EEPROM ID_SD/ID_SC — avoid for general IO.
- Pins 8/10 (BCM 14/15) carry the serial console by default; disable the console (or use `raspi-config`) before reusing them.

## Numbering conventions

- Use **BCM** numbers in code (libgpiod, Python `gpiozero`, tscircuit firmwares).
- Label **physical** pin numbers on wiring sheets and technical documents for the user.
- Machine-readable map: `pinout.json` next to the `gpio-pinout-raspberrypi` skill; the full table is in `pinout.md` beside this file.
