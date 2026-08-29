# User workflows

## Daily: work with the on-device agent

Open T3 Code (tunneled) or OpenCode on the Pi. The agent loads:

- `opencode/preferences` — it controls this GPIO OS
- `opencode/skills` — including `gpio-pinout-raspberrypi` or `gpio-pinout-orangepi` from `/etc/gpio-companion/config.json`

On Raspberry Pi use **BCM** in code and **physical** pin numbers on sheets. 3.3V logic only. Confirm lines with `gpioinfo` before driving pins. Avoid ID EEPROM pins 27–28 for general GPIO.

On Orange Pi, power/GND seats match the 40-pin Pi layout; **SoC GPIO numbers are not BCM**. Resolve with `gpioinfo` / WiringOP.

Arduino firmware is **C**, flashed over USB. No other MCU language unless the product locks one.

## Projects live in Gitea

One git repo per electronics project. When a PCB, breadboard, or technical-sheet task is done, the agent must **push**:

| Directory | Expected files |
| --- | --- |
| `pcb/` | `circuit.json`, `preview.svg` when possible |
| `breadboard/` | `circuit.json`, `preview.svg` when possible |
| `technical/` | sheets |

Dashboard `/projects` reads those paths (plus PCB viewer for `pcb/circuit.json` / `pcb/preview.svg`). If the agent only left files on the Pi disk, the dashboard will look empty.

## Change WiFi later

Still signed-in `/wifi`, anytime — same Chrome Bluetooth or iOS paste flow. UUID must stay this board’s pairing UUID.

## Change keys later

`/keys` again (OpenCode key and/or Gitea URL/user/token). Requires an existing pair. The dashboard talks to the stored device URL, not a URL you type after pair.

## Board updates

You do not git-pull by hand unless you want to. `gpio-companion-update.timer` pulls `main` (or `/etc/gpio-companion/branch`) on boot and every 24h, refreshes skills/preferences, and restarts the device API when the server tree changed.

## Safety

- Do not put 5V into GPIO
- Do not short 3V3 to 5V
- The agent may drive pins and USB; stay at the bench for power hardware
- Pairing key and Gitea token are secrets; do not commit them
