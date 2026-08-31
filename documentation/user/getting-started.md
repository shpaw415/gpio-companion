# Getting started (user)

Do this in order. OpenCode API key and GitHub token are **not** typed on the Pi; they come from the dashboard after pair.

## 1. Power the board

HDMI/serial if you need the console. First boot clones the repo to `/opt/gpio-companion` and runs first-setup (root, interactive).

Choose **raspberrypi** or **orangepi**. Enter the host’s Cloudflare API token, account ID, and zone ID so first-setup can create this board’s tunnel (`api-…` and `t3-…` on gpio-companion.com).

**Write down** the printed **pairing UUID** and **pairing key**, or pull UUID, key, and Device URL on `/pair` over Bluetooth (Chrome) / LightBlue paste (iOS). They also live in `/etc/gpio-companion/pairing.env` (root).

## 2. Network

If the Pi already has Ethernet, skip to sign-in.

If it has no WiFi yet:

1. Sign in to the dashboard on a phone or laptop that **does** have internet
2. Open **WiFi** (`/wifi`) — see [wifi-bluetooth.md](./wifi-bluetooth.md)
3. After the Pi joins WiFi, continue pairing with the device URL

Ethernet and the Pi TTY (`nmcli`) always work.

## 3. Sign in

Dashboard `/` stepper: **Sign in → Pair Pi → GitHub → Overview**.

Use `/login`. Continue with GitHub; you land on `/callback` then home.

## 4. Pair the board

Page `/pair` (or stepper step 2).

| Field | Where it comes from |
| --- | --- |
| Device URL | Bluetooth (first-setup `apiHostname`) or `https://api-<uuid>.gpio-companion.com` |
| Pairing UUID | Bluetooth or first-setup printout |
| Pairing key | Bluetooth or first-setup printout |

The dashboard **signs** the claim, starts **T3 Code** (`t3 start`), and shows a web pairing URL (`app.t3.codes/pair?host=https://t3-…`). Open it, finish T3 pairing; the dashboard then runs `t3 service install`. If this board already belongs to someone, you wait until they **Accept** on `/notifications` (ownership transfers; their T3 Code session is revoked). One active owner per board.

## 5. GitHub

1. Use **your** GitHub account (create one if needed)
2. Create a **classic PAT** with the `repo` scope at https://github.com/settings/tokens
3. Dashboard **Keys**: GitHub username, token, optional OpenCode API key
4. Save — the dashboard stores the token for `/projects` and signs `PUT /v1/config/github` and `PUT /v1/config/secrets` to **your** paired Pi

The agent uses `/etc/gpio-companion/secrets.env` on the Pi. Tokens are not stored in the dashboard form after save.

## 6. Overview

When GitHub is marked ready on the device, `/` shows the overview and `/projects` lists **your** repos (pcb / breadboard / technical). T3 Code pairing is the URL shown on `/pair` after hardware claim.

## If something fails

- `device 401` / missing signature: host signing secret not set, or you are on an old image
- `pairing uuid mismatch` / `pairing key mismatch`: wrong printout or wrong board
- `already paired`: another dashboard user claimed this UUID
- `pair a device first` on Keys: finish `/pair` before Keys
- Health check only: `http://<pi>:4150/health` is public; everything else is signed
