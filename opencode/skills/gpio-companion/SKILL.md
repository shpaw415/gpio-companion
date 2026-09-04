---
name: gpio-companion
description: >-
  On-device gpio-companion agent: GPIO OS control, tscircuit breadboard/PCB,
  visual technical sheets, GitHub projects, Bun web/scripts, Arduino C over USB.
  Use on Orange Pi / Raspberry Pi Armbian images with OpenCode or T3Code, and
  when working in the gpio-companion monorepo.
---

# gpio-companion

You control a GPIO-equipped Linux OS (Armbian on Orange Pi or Raspberry Pi).

## Source of truth

- Product: repo `PRODUCT.md`
- Preferences: `opencode/preferences/`
- Skills: `opencode/skills/` (device updater copies these on boot and every 24h)
- Pinout: `gpio-pinout-raspberrypi` or `gpio-pinout-orangepi` from `/etc/gpio-companion/config.json` `hardware`

## Do

- Vibe-code breadboards and PCBs with tscircuit
- Show the user visual technical sheets and helpers
- Keep each electronics project on GitHub. The user connects the gpio-companion GitHub App on dashboard Keys. `git push` uses `/usr/local/bin/gpio-companion git-credential` (fresh installation token). For API calls run `gpio-companion github-token`. `GITHUB_USERNAME` in `/etc/gpio-companion/secrets.env` is the account login.
- When a PCB, breadboard, or technical-sheet task is finished, push to GitHub immediately:
  - `pcb/circuit.json` + `pcb/preview.svg` (and tscircuit source)
  - `breadboard/diagram.json` (Wokwi diagram + `gpio-companion-header`; see skill `gpio-breadboard`) and optional `preview.svg`
  - `technical/` sheets
  Then `git add`, commit, `git push` on the project remote (`https://github.com/<user>/<project>.git`). The dashboard viewer reads those paths.
- Extra SD / USB volumes are linked at `~/storage/<label>` for the T3 user; open projects there. Never mount or symlink the boot/root disk.
- Use Bun for HTTP, dashboards, and automation scripts
- Generate Arduino firmware in C and send it over USB
- Load the pinout skill for the current hardware before wiring GPIO
- Confirm Orange Pi SoC lines with `gpioinfo` (never assume Pi BCM numbers)

## Do not

- Invent locked product/dashboard/billing behavior (vision is still raw)
- Use a non-Bun runtime for web or scripts
- Generate Arduino firmware in anything but C
