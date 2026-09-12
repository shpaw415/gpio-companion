# User workflows

## Daily: work with the on-device agent

Open T3 Code (tunneled) or OpenCode on the Pi. The agent loads:

- `opencode/preferences` — it controls this GPIO OS
- `opencode/skills` — including `gpio-pinout-raspberrypi` or `gpio-pinout-orangepi` from `/etc/gpio-companion/config.json`

On Raspberry Pi use **physical** pin numbers (the seats on the header). gpio-companion drives those numbers; BCM is only a label. 3.3V logic only. Avoid ID EEPROM pins 27–28 for general GPIO.

On Orange Pi, **SoC GPIO numbers are not BCM**. Orange Pi 3 LTS is a **26-pin** header (ignore 27–40). Talk physical pin numbers.

Extra SD cards and USB sticks show up as `~/storage/<label>` in the T3 user home. Open that folder for projects on the stick; see [storage.md](./storage.md).

Arduino firmware is **C**, flashed over USB through `http://127.0.0.1:4150/v1/flash` (absolute sketch dir with `.c` or `.ino`). Project can start the same job over the web API or Bluetooth.

The on-device agent drives this board's header with C (`POST /v1/run`, skill `gpio-host`) — not direct GPIO PUT except one-shot tests. Pins are physical header numbers. You start and stop that job on Project **Run on board** (not by curling the Pi).

## Projects live in GitHub

One git repo per electronics project. The dashboard only lists repos with a `.gpio-companion` file at the repo root. Create a project from the dashboard, or ask Code on the board — new repos must include that watermark.

The board clones those repos to `~/projects/<name>` and adds them to T3 Code. If the board is online when you create a project, it happens immediately. If it is offline, nothing is queued — the clone runs the next time gpio-companion starts (and every 15 minutes while it is up). Existing folders are left alone.

When a PCB, breadboard, or technical-sheet task is done, the agent must **push**:

| Directory | Expected files |
| --- | --- |
| `pcb/` | `circuit.json`, `preview.svg` when possible |
| `breadboard/` | `diagram.json` (Wokwi plug map), optional `preview.svg` |
| `technical/` | sheets |

Dashboard `/projects` reads those paths (PCB viewer for `pcb/circuit.json` / `pcb/preview.svg`, breadboard viewer for `breadboard/diagram.json`). If the agent only left files on the Pi disk, the dashboard will look empty.

## Change WiFi later

Still signed-in `/devices/wifi`, anytime — pick the paired device from the dropdown, then the same Chrome Bluetooth or iOS paste flow. The dashboard will not sign a UUID that is not paired to your account.

## Change GitHub later

Profile → GitHub (`/profile/github`) → Connect GitHub (install the gpio-companion GitHub App). Paired boards mint a token at git push; you do not paste a PAT. If a board was offline for more than an hour, push again after it has internet. `/devices/keys` still redirects there.

## Board updates

You do not git-pull by hand unless you want to. `gpio-companion-update.timer` pulls `main` (or `/etc/gpio-companion/branch`) on boot and every 24h, refreshes skills/preferences, and restarts the device API when the server tree changed.

`gpio-companion-cleanup.timer` runs on boot and every hour. Journals stay for 24 hours then vacuum; leftover apt/tmp/cache files are pruned so 8GB eMMC boards do not fill up. Journald does not forward to rsyslog. Devices → Debug shows disk free and can load a redacted last-24h journal excerpt (not a full log dump).

## GPIO

The on-device agent drives this board's header with C sketches (`POST /v1/run`, skill `gpio-host`). Direct `PUT /v1/gpio` is for one-shot tests only. The dashboard Project page Live GPIO header can still drive the same map. Power/GND and Raspberry Pi pins 27–28 are refused. Orange Pi 3 LTS uses the 26-pin map; other Orange Pi models only drive pins the companion can resolve.

Flash USB Arduino with `POST /v1/flash` then poll `GET /v1/flash`. A second flash while one is running returns 409.

Run C on the companion GPIO with `POST /v1/run` then poll `GET /v1/run` or `POST /v1/run/stop`. A second run while one is running returns 409.

## Safety

- Do not put 5V into GPIO
- Do not short 3V3 to 5V
- The agent may drive pins and USB; stay at the bench for power hardware
- Pairing key and GitHub token are secrets; do not commit them
