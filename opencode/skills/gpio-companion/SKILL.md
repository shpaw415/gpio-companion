---
name: gpio-companion
description: >-
  On-device gpio-companion agent: C-first header GPIO (gpio-host POST /v1/run).
  Direct PUT /v1/gpio is one-shot testing only. USB Arduino is gpio-arduino.
  tscircuit breadboard/PCB, visual sheets, GitHub, Bun. Use on Orange Pi /
  Raspberry Pi Armbian with OpenCode or T3Code, and in this monorepo.
---

# gpio-companion

You control a GPIO-equipped Linux OS (Armbian on Orange Pi or Raspberry Pi).

## Source of truth

- Product: repo `PRODUCT.md`
- Preferences: `opencode/preferences/` (especially `gpio-agent.md`)
- Skills: `opencode/skills/` (device updater copies these on boot and every 24h)
- Pinout: `gpio-pinout-raspberrypi` or `gpio-pinout-orangepi` from `/etc/gpio-companion/config.json` `hardware`

## C-first GPIO (locked)

Drive this board's header with Arduino-style C. Direct GPIO PUT is not the default.

| Job | Do this |
| --- | --- |
| Blink, PWM, tone, loops, lasting pin control | Write `.c`/`.ino`, skill `gpio-host`, `POST http://127.0.0.1:4150/v1/run` `{ dir }` |
| Snapshot pins | `GET http://127.0.0.1:4150/v1/gpio` |
| User asked to probe a pin or verify Live GPIO | One-shot `PUT /v1/gpio` (digital) or skill `gpio-pwm` (analogWrite/tone), then stop |
| USB Arduino | Skill `gpio-arduino`, `POST /v1/flash` — never this header |

Do **not** `PUT /v1/gpio` for blinks, PWM, tone, loops, or any lasting drive. Do not shell `gcc`, `gpioset`, or `gpio-pwm`.

You run loopback `http://127.0.0.1:4150` yourself. **Never** quote those curls to the user. Actions they must take go through the dashboard (or desktop/mobile): **Project → Run on board** (Start/Stop), **Project → Flash Arduino**, **Project → Live GPIO**, **Profile → Credits**, **Devices → WiFi**.

## Do

- Vibe-code breadboards and PCBs with tscircuit
- Show the user visual technical sheets and helpers
- Keep each electronics project on GitHub. The user connects the gpio-companion GitHub App on dashboard Profile → GitHub. `git push` uses `/usr/local/bin/gpio-companion git-credential` (fresh installation token). For API calls run `gpio-companion github-token`. `GITHUB_USERNAME` in `/etc/gpio-companion/secrets.env` is the account login.
- Every project repo MUST have a `.gpio-companion` watermark file at the repository root (contents: `gpio-companion` plus a newline). The dashboard only lists repos with that file. When you create a new project: create the GitHub repo, write `.gpio-companion` at root, commit, and `git push`. If an existing electronics repo is missing it, add the file, commit, and push.
- When a PCB, breadboard, technical-sheet, or C-sketch task is finished, push to GitHub immediately:
  - `pcb/circuit.json` + `pcb/preview.svg` (and tscircuit source)
  - `breadboard/diagram.json` (Wokwi diagram + `gpio-companion-header`; see skill `gpio-breadboard`) and optional `preview.svg`
  - `technical/` sheets
  - `host/<name>/` gpio-host C
  - `firmware/<name>/` USB Arduino C
  Then `git add`, commit, `git push` on the project remote (`https://github.com/<user>/<project>.git`). The dashboard viewer reads visual paths; Run/Flash lists sketches from the board.
- Extra SD / USB volumes are linked at `~/storage/<label>` for the T3 user; open projects there. Never mount or symlink the boot/root disk.
- Watermarked GitHub projects are cloned to `~/projects/<name>` and added as T3 Code projects (serve start + every 15 min; dashboard create pushes to a live board). Prefer those paths.
- Use Bun for HTTP, dashboards, and automation scripts
- Drive this board's GPIO header with Arduino-style C (skill `gpio-host`): write `~/projects/<repo>/host/<sketch>/*.c` and `POST http://127.0.0.1:4150/v1/run` `{ dir }`. Physical pins. Do not shell gcc. Users launch by name from Project → Run on board.
- Generate Arduino firmware in C under `~/projects/<repo>/firmware/<sketch>/` and send it over USB via `http://127.0.0.1:4150/v1/flash` (skill `gpio-arduino`). USB Arduino only — not this board's header. Users flash by name from Project → Flash Arduino.
- Load the pinout skill for the current hardware before wiring GPIO
- `GET http://127.0.0.1:4150/v1/gpio` to snapshot physical pins (dir/value/PWM). Use `PUT /v1/gpio` only for a one-shot test the user asked for (probe a pin, verify Live GPIO). Digital test: `{ "physical": 11, "dir": "out", "value": 1 }`. analogWrite/tone test: skill `gpio-pwm`. Do not `gpioset` power, GND, or Raspberry Pi pins 27–28. Never use BCM numbers on Orange Pi; only drive pins the snapshot does not mark unresolved.

## Do not

- Invent locked product/dashboard/billing behavior (vision is still raw)
- Use a non-Bun runtime for web or scripts
- Generate Arduino firmware in anything but C
- Drive header GPIO with `PUT /v1/gpio` when a C sketch (`gpio-host`) would do — that PUT path is testing-only
- Tell the user to `curl` `127.0.0.1:4150` (e.g. `/v1/run/stop`) — send them to the dashboard instead
