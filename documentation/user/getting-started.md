# Getting started (user)

Do this in order. OpenCode API key and Gitea token are **not** typed on the Pi; they come from the dashboard after pair.

## 1. Power the board

HDMI/serial if you need the console. First boot clones the repo to `/opt/gpio-companion` and runs first-setup (root, interactive).

Choose **raspberrypi** or **orangepi**. Optionally paste a Cloudflare tunnel token and hostname for T3 Code (skip if the host applies it later).

**Write down** the printed **pairing UUID** and **pairing key**. You need both on `/pair`. They also live in `/etc/gpio-companion/pairing.env` (root).

## 2. Network

If the Pi already has Ethernet, skip to sign-in.

If it has no WiFi yet:

1. Sign in to the dashboard on a phone or laptop that **does** have internet
2. Open **WiFi** (`/wifi`) — see [wifi-bluetooth.md](./wifi-bluetooth.md)
3. After the Pi joins WiFi, continue pairing with the device URL

Ethernet and the Pi TTY (`nmcli`) always work.

## 3. Sign in

Dashboard `/` stepper: **Sign in → Pair Pi → Gitea → Overview**.

Use `/login`. After OAuth/passkey you land on `/callback` then home.

## 4. Pair the board

Page `/pair` (or stepper step 2).

| Field | Where it comes from |
| --- | --- |
| Device URL | `https://<your-tunnel-host>:4150` or `http://<pi-lan-ip>:4150` |
| Pairing UUID | first-setup printout |
| Pairing key | first-setup printout |
| Gitea account | suggested from your email; must match the account you will create on Gitea |

The dashboard **signs** the claim (you never call the Pi from the browser with a raw key for later APIs). The Pi checks UUID + key and binds your user. One board per user in the current KV model (`device:<your user id>`).

## 5. Gitea

1. Open Gitea (link on Keys / onboarding if the host set `PUBLIC_GITEA_URL`)
2. **Register** a user yourself
3. Create a **token** (repo read/write so the agent can `git push`)
4. Dashboard **Keys**: Gitea URL, username, token, optional OpenCode API key
5. Save — the dashboard signs `PUT /v1/config/gitea` and `PUT /v1/config/secrets` to **your** paired Pi

The agent uses `/etc/gpio-companion/secrets.env` on the Pi. Tokens are not stored in the dashboard form after save.

## 6. Overview

When Gitea is marked ready on the device, `/` shows the overview and `/projects` lists repos (pcb / breadboard / technical). T3 Code pairing stays on the dashboard.

## If something fails

- `device 401` / missing signature: host signing secret not set, or you are on an old image
- `pairing uuid mismatch` / `pairing key mismatch`: wrong printout or wrong board
- `already paired`: another dashboard user claimed this UUID
- `pair a device first` on Keys: finish `/pair` before Keys
- Health check only: `http://<pi>:4150/health` is public; everything else is signed
