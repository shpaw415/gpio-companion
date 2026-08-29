# gpio-companion

Status: raw idea. Details will firm up; do not treat unspecified product choices as locked.

## Platform

On-device agent OS (Orange Pi / Raspberry Pi GPIO header) plus a web dashboard.

## Users

A person vibe-coding electronics at a desk: breadboard experiments, then PCBs, with an AI agent that can see and drive the board.

## Product Purpose

**gpio-companion** is a pre-configured Armbian image (T3Code + OpenCode) that boots on GPIO hardware and gives an AI agent control of that OS so the user can develop breadboards and PCBs with visual guidance.

The agent:

- Fetches skills from this monorepo at `opencode/skills`
- Loads standing rules from `opencode/preferences`
- Uses Gitea (per-project git) to manage code
- Designs breadboards and PCBs with [tscircuit](https://tscircuit.com)
- Produces technical sheets the user can see on a breadboard or PCB
- Guides development with visual helpers
- Pushes designs to the web app (future [gpio-companion.com](https://gpio-companion.com) dashboard: projects, PCBs, sheets, subscription)
- Flashes Arduino over USB with **C** firmware

## Positioning

Not a generic SBC image. The board is a GPIO-capable coworker: the agent owns the OS, the bench, and the project git.

## Operating Context

- Hardware: Orange Pi or Raspberry Pi (or compatible) sharing a GPIO header
- OS: Armbian, preloaded with T3Code and OpenCode
- On-device git: Gitea account (this monorepo hosts `apps/workers/gitea-container`)
- Web: Bun only for serving content and automation scripts
- Firmware to MCU: C, sent over USB to Arduino
- Cloud dashboard: `apps/dashboard` (cloudflare-nextjs on Cloudflare Pages; future gpio-companion.com)
- On-device Bun API (`gpio-companion serve`, port 4150) sets runtime config after install
- `cloudflared` replica is for the T3 Code tunnel; custom endpoint + token are applied at OS config time via the device API
- T3 Code pairing, OpenCode API key, and Gitea token are managed from the dashboard, not first-setup
- Dashboard is multi-user and authenticates with `openauthster-shared`
- Dashboard home is a mui-lite stepper: sign in → pair Pi → Gitea setup → overview
- Hardware pairing: config-time `GPIO_COMPANION_PAIRING_UUID` + `GPIO_COMPANION_PAIRING_KEY` on the Pi; dashboard `/pair` claims the board for the signed-in user
- Device API auth: dashboard signs requests with Ed25519 (`GPIO_COMPANION_DEVICE_PRIVATE_KEY`); the Pi verifies the bundled public key. Browser never calls the Pi. Pairing UUID/key remain required on claim.
- WiFi over Bluetooth: a logged-in dashboard user (Chrome/Edge) connects to the Pi GATT peripheral; the dashboard signs `PUT /v1/config/wifi` with timestamp/nonce; the Pi verifies then runs nmcli. Safari/iOS: sign-and-copy into LightBlue or nRF Connect as UTF-8 text (native gpio-companion app later). Ethernet/TTY still work.
- Gitea: the user creates an account on Gitea first; Pi/agent credentials (URL, username, token) are then set through the device bun API `PUT /v1/config/gitea`

## Capabilities and Constraints

**Confirmed direction**

- Agent controls a GPIO-equipped OS for vibe-coding electronics
- Skills and preferences live in this repo and can be fetched to update the on-device agent
- tscircuit for breadboard/PCB design
- Visual technical sheets and guided helpers
- Gitea for per-project code
- Web app receives pushed designs; later a dashboard + subscription
- Bun.js for all web-related work and automation scripts
- Arduino programming language is C
- Per-hardware Armbian install scripts: `scripts/install-raspberrypi.sh`, `scripts/install-orangepi.sh`
- Installs cloudflared, git, zip, unzip, bun, build-essential, node-gyp, GPIO libs, Arduino USB tooling, OpenCode, T3 Code
- Device API `PUT /v1/config/tunnel` writes the cloudflared replica token and hostname, then enables the replica
- On-device updater `scripts/update-script.sh` pulls the repo, refreshes `opencode/skills` and `opencode/preferences`, and rebuilds/restarts the gpio-companion server when those trees change
- Updater runs on boot and every 24h (`gpio-companion-update.timer`)
- OS snapshot ships `scripts/snapshot/gpio-companion-first-boot.sh`: install git, clone this repo, run interactive `scripts/first-setup.sh`
- First setup collects per-hardware choice and the cloudflared tunnel token/hostname
- After the user registers on Gitea, dashboard Keys pushes Gitea URL/username/token to the Pi via `PUT /v1/config/gitea`; OpenCode key via `PUT /v1/config/secrets`
- Dashboard app: `apps/dashboard` (Frame Master `cloudflare-nextjs`, Cloudflare Pages project `gpio-companion-dashboard`)
- Dashboard `/projects` shows per-Gitea-repo `pcb/`, `breadboard/`, and `technical/` files plus a PCB viewer (`pcb/circuit.json` / `pcb/preview.svg`)
- Pairing UUID/key are generated (or taken from env) at first-setup; `POST /v1/pairing/claim` on the device API completes the bind
- Generate the dashboard/Pi Ed25519 pair with `bun run keys:device -- --write-public` (optional `--wrangler`); private key is never committed
- Pi `gpio-companion serve` accepts unsigned `GET /health` only; all other device API routes require a valid dashboard Ed25519 signature
- `PUT /v1/config/wifi` applies SSID/PSK only when the signed body UUID matches the Pi pairing UUID; BLE GATT (`scripts/ble-gatt-server.py`) forwards signed envelopes to localhost
- When a PCB, breadboard, or technical-sheet task is done, the agent must `git push` those folders to the project Gitea repo
- Per-hardware GPIO pinout skills: `opencode/skills/gpio-pinout-raspberrypi`, `opencode/skills/gpio-pinout-orangepi`

**Open / not locked**

- Exact image build and Orange Pi board SKUs (SoC GPIO lines resolved live; 40-pin power/GND map is in `opencode/skills/gpio-pinout-orangepi`)
- How skills/preferences are versioned beyond git pull of this repo
- Dashboard UX beyond hardware, keys, projects/PCB viewer, billing, pairing UI details, and gpio-companion.com stack
- Breadboard visual helper format beyond `breadboard/circuit.json` and `preview.svg`
- How far the agent may go unattended on GPIO/USB

## Product Principles

1. **The agent is on the metal** — it runs on the GPIO machine and may drive the OS, pins, and USB.
2. **See the circuit** — breadboard and PCB work must stay visual (sheets + helpers), not text-only.
3. **Bun for the web, C for the MCU** — no substitute runtimes for those jobs unless the user locks a change.
4. **Projects live in Gitea** — one git home per electronics project.
5. **Raw until locked** — this brief is a sketch; do not invent product claims beyond it.
