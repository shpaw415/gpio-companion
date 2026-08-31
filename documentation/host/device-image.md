# Device image and on-metal install (host)

The board is Armbian with T3 Code + OpenCode. Exact image SKUs are **not locked**. What is locked: per-hardware install scripts and the snapshot first-boot path.

## Snapshot first boot

`scripts/snapshot/gpio-companion-first-boot.sh` is copied onto the image as `/usr/local/sbin/gpio-companion-first-boot`.

On first boot (no `/etc/gpio-companion/first-setup-complete`):

1. Installs `git` + `ca-certificates`
2. Clones `GPIO_COMPANION_REPO_URL` (default this GitHub repo) to `GPIO_COMPANION_REPO` (default `/opt/gpio-companion`), branch `GPIO_COMPANION_BRANCH` (default `main`)
3. `exec`s interactive `scripts/first-setup.sh`

Optional unit: `scripts/snapshot/gpio-companion-first-boot.service` on tty1 until the marker exists.

The clone does **not** bake a production public key. First-setup fetches it from `GET ${GPIO_COMPANION_DASHBOARD_URL:-https://gpio-companion.com}/api/device-public-key` and writes `/etc/gpio-companion/device-auth.json`. The dashboard must already have `GPIO_COMPANION_DEVICE_PRIVATE_KEY` set.

## First-setup (what the script does)

`scripts/first-setup.sh` (root, TTY unless env is fully set):

1. Hardware: `raspberrypi` or `orangepi` (guessed from `/proc/device-tree/model`)
2. Cloudflare API token, account ID, and zone ID (creates a per-Pi tunnel; token is not written to disk)
3. Runs `scripts/install-raspberrypi.sh` or `scripts/install-orangepi.sh`
4. Generates pairing UUID + key into `/etc/gpio-companion/pairing.env` (mode 600) if unset
5. Creates `gpio-<uuid>` on Cloudflare with `api-<slug>` → :4150 and `t3-<slug>` → :3773
6. Writes `/etc/gpio-companion/config.json` and `cloudflared.env`, enables the replica
7. Fetches the dashboard Ed25519 public key into `/etc/gpio-companion/device-auth.json` (fails closed if the dashboard is unreachable)
8. Writes `/etc/gpio-companion/first-setup-complete`

It does **not** collect OpenCode or GitHub secrets. It does **not** run `t3 service install` (dashboard does that after T3 pairing).

Prints pairing UUID/key plus `https://api-…` and `https://t3-…`. Treat that console output as a physical possession secret.

Non-interactive: `GPIO_COMPANION_HARDWARE`, `GPIO_COMPANION_CF_API_TOKEN`, `GPIO_COMPANION_CF_ACCOUNT_ID`, `GPIO_COMPANION_CF_ZONE_ID`, optional `GPIO_COMPANION_DASHBOARD_URL` (default `https://gpio-companion.com`).

Force re-run: `GPIO_COMPANION_FORCE_SETUP=1`.

## Install scripts

Shared work: `scripts/lib.sh` → `install_common`.

Packages include: git, zip/unzip, bun, build-essential, node-gyp toolchain, libgpiod, Arduino USB (`avrdude`, `picocom`, …), cloudflared, OpenCode, T3 Code, **bluez**, **python3-dbus**, **python3-gi** (BLE GATT).

- Raspberry Pi extras: optional `pigpio` / `raspi-gpio`
- Orange Pi extras: optional WiringOP — SoC lines are **not** BCM; agents must use `gpioinfo`

Device binary: compiled `gpio-companion` on PATH (`/usr/local/bin/gpio-companion`).

Systemd:

- `gpio-companion.service` — `gpio-companion serve` on port **4150**, after network + bluetooth
- `gpio-companion-update.timer` — updater OnBootSec=2min and every 24h (`Persistent=true`)

Env the unit loads:

- `GPIO_COMPANION_CONFIG=/etc/gpio-companion/config.json`
- `GPIO_COMPANION_SECRETS=/etc/gpio-companion/secrets.env`
- `GPIO_COMPANION_PAIRING=/etc/gpio-companion/pairing.json`
- `EnvironmentFile=-/etc/gpio-companion/pairing.env` (`GPIO_COMPANION_PAIRING_UUID`, `GPIO_COMPANION_PAIRING_KEY`)
- `GPIO_COMPANION_HARDWARE=raspberrypi|orangepi`

The binary also reads `/etc/gpio-companion/device-auth.json` (`keyId`, `publicKeyPem`) written by first-setup / the updater.

## Device API (what you are exposing)

`gpio-companion serve` binds `0.0.0.0:4150` (override `GPIO_COMPANION_PORT`).

| Route | Auth |
| --- | --- |
| `GET /health` | none |
| `GET /v1/status`, pairing, config, secrets, github, **wifi**, **t3** | Ed25519 dashboard signature |
| `POST /v1/pairing/claim` | signature **and** pairing UUID + key |
| `POST /v1/t3/start`, `POST /v1/t3/service-install` | signature |

Signature headers: `X-Gpio-Key-Id`, `X-Gpio-Timestamp`, `X-Gpio-Nonce`, `X-Gpio-Signature`. 60s skew. Canonical version `gpio-companion-device-v1`.

If the board is on a tunnel URL, that origin must only be reachable as you intend (Cloudflare Access is an open host choice — not locked).

## Bluetooth WiFi (on-device)

`gpio-companion serve` starts `scripts/ble-gatt-server.py` unless `GPIO_COMPANION_BLE=0`. No adapter → skip.

| Item | Value |
| --- | --- |
| Advertised name | `gpio-companion` |
| Service | `a1c15e00-6f10-4c9a-9c31-47b0c15e0001` |
| Info (read) | pairing UUID, hardware |
| Command (write) | length-prefixed frames **or** UTF-8 JSON starting with `{` |
| Status (notify) | device API JSON |

Python forwards the signed envelope to `http://127.0.0.1:4150` (still verified). `PUT /v1/config/wifi` requires body UUID = local pairing UUID, then `nmcli device wifi connect`.

Script path, first existing file: env `GPIO_COMPANION_BLE_SCRIPT` (unit default `/usr/local/lib/gpio-companion/ble-gatt-server.py`), then that installed copy, then `$repo/scripts/ble-gatt-server.py` from `/etc/gpio-companion/repo.path`, then `/opt/gpio-companion/scripts/ble-gatt-server.py`, then a source-tree relative path (dev). Install copies `scripts/ble-gatt-server.py` next to the binary helper dir. Missing script → skip (`gpio-companion ble: script not found, skipping`).

## Updater

`scripts/update-script.sh` (timer):

- `git fetch` + `reset --hard origin/<branch>` (`/etc/gpio-companion/branch` or `main`)
- Copies `opencode/skills` and `opencode/preferences` into the device OpenCode config
- Fetches `GET /api/device-public-key` and writes `/etc/gpio-companion/device-auth.json` if it changed
- Rebuilds/restarts `gpio-companion` if `binary/`, `packages/core/`, the unit file, or lockfile changed, or if the registered public key changed

Public-key rotations are **dashboard-only** (new Pages secret); Pis pick them up on the next updater run without a git commit. Fetch failure keeps the current file.
