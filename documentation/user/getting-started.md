# Getting started (user)

Do this in order. GitHub token is **not** typed on the Pi; it comes from dashboard Keys after pair. OpenCode uses a baked gpio-companion AI key and dashboard credits.

## 1. Power the board

HDMI/serial if you need the console. First boot clones the repo to `/opt/gpio-companion` and runs first-setup (root, interactive).

Choose **raspberrypi** or **orangepi**. Enter the host’s Cloudflare API token, account ID, and zone ID so first-setup can create this board’s tunnel (`api-…` and `t3-…` on gpio-companion.com).

**Write down** the printed **pairing UUID** and **pairing key**, or pull UUID, key, and Device URL on `/pair` over Bluetooth (Chrome) / LightBlue paste (iOS). They also live in `/etc/gpio-companion/pairing.env` (root).

## 2. Network

If the Pi already has Ethernet, skip to sign-in.

If it has no WiFi yet, pair over Bluetooth first (step 4), then set WiFi from **WiFi** (`/devices/wifi`) — see [wifi-bluetooth.md](./wifi-bluetooth.md). The dashboard only signs WiFi for a board already paired to your account.

Ethernet and the Pi TTY (`nmcli`) always work.

## 3. Sign in

Dashboard `/` stepper: **Sign in → Pair Pi → GitHub → Overview**.

Use `/login`. Continue with GitHub; you land on `/callback` then home.

## 4. Pair the board

Page `/devices/pair` (or stepper step 2). You can pair more than one board.

| Field | Where it comes from |
| --- | --- |
| Device URL | Bluetooth (first-setup `apiHostname`) or `https://api-<uuid>.gpio-companion.com` |
| Pairing UUID | Bluetooth or first-setup printout |
| Pairing key | Bluetooth or first-setup printout |

The dashboard **signs** the claim, then you **Start T3 pairing** (also on Devices overview for a board already claimed). That runs `t3 start` and shows a one-click URL (`app.t3.codes/pair?host=https://t3-…#token=…`). Open it, finish T3 pairing; the dashboard then runs `t3 service install`. If this board already belongs to someone, you wait until they **Accept** on `/notifications` (ownership transfers; their T3 Code session is revoked). One active owner per board.

## 5. GitHub

1. Use **your** GitHub account (create one if needed)
2. Dashboard **Keys**: **Connect GitHub** and install the gpio-companion GitHub App on your account (all or selected repos)
3. Paired Pis mint a fresh token at `git push`. You do not paste a PAT. If the board was offline for more than an hour, just push again once it has internet — do not reopen Keys.

OpenCode uses `/profile/credits` (USD balance billed from Workers AI tokens), not a GitHub token. `gpio-companion github-token` prints a live token for API calls.

## 6. Overview

When GitHub is marked ready on the device, `/` shows the overview and `/projects` lists **your** repos (pcb / breadboard / technical). T3 Code pairing is **Start T3 pairing** on `/devices` (or `/devices/pair`): open the one-click `app.t3.codes` URL with host + token.

## If something fails

- `device 401` / missing signature: host signing secret not set, or you are on an old image
- `pairing uuid mismatch` / `pairing key mismatch`: wrong printout or wrong board
- `already paired`: another dashboard user claimed this UUID
- `pair a device first` on Keys: finish `/pair` before Keys
- Health check only: `http://<pi>:4150/health` is public; everything else is signed
