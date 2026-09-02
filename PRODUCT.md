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
- Uses GitHub (per-project git) to manage code
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
- On-device git: the user's GitHub account (classic PAT with `repo` scope)
- Web: Bun only for serving content and automation scripts
- Firmware to MCU: C, sent over USB to Arduino
- Cloud dashboard: `apps/dashboard` (cloudflare-nextjs on Cloudflare Pages; future gpio-companion.com)
- On-device Bun API (`gpio-companion serve`, port 4150) sets runtime config after install
- `cloudflared` replica is for the T3 Code tunnel; first-setup creates a per-Pi remotely-managed Cloudflare tunnel (API token + account ID + zone ID) with `api-<uuid>` (port 4150) and `t3-<uuid>` (port 3773) on `gpio-companion.com`
- T3 Code pairing and GitHub token are managed from the dashboard; OpenCode uses gpio-companion credits via a dashboard AI proxy (Workers AI binding, default `@cf/zai-org/glm-5.3`). first-setup bakes `GPIO_AI_KEY` and the OpenCode provider URL. Each call bills Cloudflare list USD in/out (cached-in when present) × `GPIO_AI_MARKUP` (default 1.25). Empty credits return 402. first-setup runs `t3 service install`. After claim the dashboard runs `t3 pair`, shows the pair code + QR and `https://t3-…/pair#token=…`
- Dashboard is multi-user and authenticates with `openauthster-shared` (GitHub login only)
- Dashboard home is a mui-lite stepper: sign in → pair Pi → GitHub setup → overview
- Hardware pairing: config-time `GPIO_COMPANION_PAIRING_UUID` + `GPIO_COMPANION_PAIRING_KEY` on the Pi; dashboard `/pair` claims the board for the signed-in user. UUID, key, and Device URL can be fetched over signed BLE (`GET /v1/pairing/credentials`, localhost-only; Device URL is the first-setup `apiHostname`). If the board is already owned, pairing is pending until the owner accepts a transfer in `/notifications`. Unpair/transfer revokes T3 Code auth and clears GitHub credentials on the Pi.
- Device API auth: dashboard signs requests with Ed25519 (`GPIO_COMPANION_DEVICE_PRIVATE_KEY`); the Pi verifies the public key fetched from `GET /api/device-public-key` at first-setup (and on `scripts/update-script.sh`). Browser never calls the Pi. Pairing UUID/key remain required on claim.
- WiFi over Bluetooth: a logged-in dashboard user (Chrome/Edge) connects to the Pi GATT peripheral; the dashboard signs `PUT /v1/config/wifi` with timestamp/nonce; the Pi verifies then runs nmcli. Safari/iOS: sign-and-copy into LightBlue or nRF Connect as UTF-8 text (native gpio-companion app later). Ethernet/TTY still work.
- GitHub: the user uses their GitHub account; Pi/agent credentials (username, PAT) are set through the device bun API `PUT /v1/config/github`. Dashboard `/projects` uses the same token stored per user in KV.

## Capabilities and Constraints

**Confirmed direction**

- Agent controls a GPIO-equipped OS for vibe-coding electronics
- Skills and preferences live in this repo and can be fetched to update the on-device agent
- tscircuit for breadboard/PCB design
- Visual technical sheets and guided helpers
- GitHub for per-project code
- Web app receives pushed designs; later a dashboard + subscription
- Bun.js for all web-related work and automation scripts
- Arduino programming language is C
- Per-hardware Armbian install scripts: `scripts/install-raspberrypi.sh`, `scripts/install-orangepi.sh`
- Installs cloudflared, git, zip, unzip, bun, build-essential, node-gyp, GPIO libs, Arduino USB tooling, OpenCode, T3 Code
- Device API `PUT /v1/config/tunnel` writes the cloudflared replica token and hostnames, then enables the replica
- Device API `POST /v1/t3/pair` and `GET /v1/t3/status` are signed dashboard routes for T3 Code pairing
- On-device updater `scripts/update-script.sh` pulls the repo, refreshes `opencode/skills` and `opencode/preferences`, fetches the dashboard device public key, upgrades T3 Code when npm `t3@latest` is ahead of the installed package (then `t3 service install`), and rebuilds/restarts the gpio-companion server when those trees or the registered public key change
- Updater runs on boot and every 24h (`gpio-companion-update.timer`)
- OS snapshot ships `scripts/snapshot/gpio-companion-first-boot.sh`: install git, clone this repo, run interactive `scripts/first-setup.sh`
- First setup collects per-hardware choice and Cloudflare API token + account ID + zone ID, then creates the per-Pi tunnel (API token is not stored) and registers the dashboard Ed25519 public key from `GET /api/device-public-key`
- After the user has a GitHub PAT, dashboard Keys pushes username/token to the Pi via `PUT /v1/config/github` and stores them in dashboard KV; OpenCode key via `PUT /v1/config/secrets`
- Dashboard app: `apps/dashboard` (Frame Master `cloudflare-nextjs`, Cloudflare Pages project `gpio-companion-dashboard`)
- Dashboard `/projects` shows per-GitHub-repo `pcb/`, `breadboard/`, and `technical/` files plus a PCB viewer (`pcb/circuit.json` / `pcb/preview.svg`) and a breadboard viewer (`breadboard/diagram.json` Wokwi diagram + `@wokwi/elements`)
- Pairing UUID/key are generated (or taken from env) at first-setup; `POST /v1/pairing/claim` on the device API completes the bind
- Generate the dashboard Ed25519 pair with `bun run keys:device` (optional `--wrangler`); private key is never committed; Pis fetch the matching public key from the dashboard, not from git
- Pi `gpio-companion serve` accepts unsigned `GET /health` only; all other device API routes require a valid dashboard Ed25519 signature
- `PUT /v1/config/wifi` applies SSID/PSK only when the signed body UUID matches the Pi pairing UUID; BLE GATT (`scripts/ble-gatt-server.py`) forwards signed envelopes to localhost
- When a PCB, breadboard, or technical-sheet task is done, the agent must `git push` those folders to the project GitHub repo
- Breadboard plug maps are Wokwi `diagram.json` (`breadboard/diagram.json`) with a `gpio-companion-header` (physical pins 1–40); the dashboard renders the board, header, `@wokwi/elements` parts, and jumper wires
- Per-hardware GPIO pinout skills: `opencode/skills/gpio-pinout-raspberrypi`, `opencode/skills/gpio-pinout-orangepi`
- Breadboard agent skill: `opencode/skills/gpio-breadboard`

**Open / not locked**

- Exact image build and Orange Pi board SKUs (SoC GPIO lines resolved live; 40-pin power/GND map is in `opencode/skills/gpio-pinout-orangepi`)
- How skills/preferences are versioned beyond git pull of this repo
- Dashboard UX beyond hardware, keys, projects/PCB/breadboard viewers, billing, pairing UI details, and gpio-companion.com stack
- How far the agent may go unattended on GPIO/USB

## Product Principles

1. **The agent is on the metal** — it runs on the GPIO machine and may drive the OS, pins, and USB.
2. **See the circuit** — breadboard and PCB work must stay visual (sheets + helpers), not text-only.
3. **Bun for the web, C for the MCU** — no substitute runtimes for those jobs unless the user locks a change.
4. **Projects live in GitHub** — one git home per electronics project, on the user's account.
5. **Raw until locked** — this brief is a sketch; do not invent product claims beyond it.
