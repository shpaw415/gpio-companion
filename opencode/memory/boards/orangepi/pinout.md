# Board: Orange Pi (family fallback)

This gpio-companion device is an **Orange Pi** model without an exact SKU seed in memory (exact model string: read `/proc/device-tree/model`). Only this family guidance is seeded — **there is no pin table for your exact board**, so resolve lines live and never answer pinout questions from memory or Raspberry Pi knowledge.

## How to resolve the pinout live

```sh
tr -d '\0' < /proc/device-tree/model
gpioinfo
command -v gpio && gpio readall
```

- `gpioinfo` (libgpiod) is the source of truth for linux line names (`gpiochipN` + line).
- WiringOP `gpio readall` maps physical header pins when installed.
- On Allwinner SoCs, lines follow the legacy sunxi numbering (main PIO: line = 32 x bank + pin; R-PIO PL pins are a separate gpiochip).

## Rules that hold across Orange Pi boards

- **Never use Raspberry Pi BCM numbers** on Orange Pi — SoC lines are not BCM.
- On boards with a Pi-style 2x20 header, physical power/GND seats match the Pi; GPIO functions do not.
- Some models use a **26-pin** header (or 26+13). If the silkscreen or `gpio readall` shows 26 pins, ignore physical 27-40.
- Logic is 3.3 V. Never feed 5 V into a GPIO. Never short 3V3 to 5V.
- Label wires by **physical pin plus the linux line you resolved** (`gpiochip0 line 118`), never a BCM number.
- Machine-readable power/GND skeleton: `pinout.json` next to the `gpio-pinout-orangepi` skill; every `"resolve": "live"` pin must be filled from `gpioinfo` / `gpio readall` for the model you are on.
