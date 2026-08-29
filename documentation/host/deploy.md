# Deploy (host)

Deploy order: **device keys → dashboard (auth + KV + secret) → Gitea (optional) → tell users the URLs**. Boards can boot before Gitea exists; they cannot accept signed dashboard commands until the public key on the image matches the private key you installed on Cloudflare.

## Prerequisites

- Bun 1.2+ (1.3+ for the dashboard template)
- Cloudflare account (Pages, KV, Wrangler)
- An [openauthster](https://github.com/shpaw415) / OpenAuthster issuer the dashboard can use (`PUBLIC_AUTH_ISSUER`, `PUBLIC_AUTH_CLIENT_ID`, `AUTH_SECRET`)
- This repo cloned; `bun install` at the monorepo root

```sh
bun install
bun test
bun run typecheck
```

## 1. Device Ed25519 pair

Generate once per environment (staging vs production). Private PEM must never be committed.

```sh
bun run keys:device -- --write-public
```

Writes:

- `.device-keys/gpio-companion-v1.private.pem` (gitignored, mode 0600)
- `.device-keys/gpio-companion-v1.public.pem`
- `packages/core/src/device-public-key.ts` (committed public key the Pi binary trusts)

Push the public-key commit **before** shipping images that must verify production signatures.

Upload the private key as a Pages secret (from `apps/dashboard`):

```sh
bun run keys:device -- --write-public --wrangler
```

Or:

```sh
cd apps/dashboard
printf '%s' "$(cat ../../.device-keys/gpio-companion-v1.private.pem)" | wrangler pages secret put GPIO_COMPANION_DEVICE_PRIVATE_KEY --project-name gpio-companion-dashboard
```

Optional secret / var: `GPIO_COMPANION_DEVICE_KEY_ID` (default `gpio-companion-v1`).

Local dashboard: put the PEM in `apps/dashboard/.dev.vars` or `.env` as `GPIO_COMPANION_DEVICE_PRIVATE_KEY` (see `apps/dashboard/.env.exemple`).

## 2. Dashboard (Cloudflare Pages)

App: `apps/dashboard`. Wrangler project name: `gpio-companion-dashboard`. Frame Master template `cloudflare-nextjs`.

### KV

Create a KV namespace and replace `<kv-binding-id>` in `apps/dashboard/wrangler.jsonc` (`DYNAMIC_PAGE_KV`). Pairing records are stored as `device:<userId>` and `pair:<uuid>`.

### Vars (wrangler.jsonc and/or Pages)

Committed `vars` override dashboard-only values if they are empty strings. Set real origins in wrangler (or stop shipping empty baked vars).

| Name | Role |
| --- | --- |
| `PUBLIC_AUTH_CLIENT_ID` | OpenAuthster client (default `__gpio_companion__`) |
| `PUBLIC_AUTH_ISSUER` | Auth issuer URL |
| `PUBLIC_AUTH_REDIRECT_URI` | Must match the deployed origin + `/callback` |
| `AUTH_SECRET` | OpenAuthster client secret (secret, not a public var) |
| `PUBLIC_GITEA_URL` / `GITEA_URL` | Shown on Keys / onboarding for registration |
| `GITEA_TOKEN` | Dashboard server token to list/read project files (secret) |
| `GPIO_COMPANION_DEVICE_PRIVATE_KEY` | Ed25519 PKCS8 PEM (secret) |
| `GPIO_COMPANION_DEVICE_KEY_ID` | `gpio-companion-v1` |

`PUBLIC_*` is injected into the browser. Never put the device private key or `AUTH_SECRET` under a `PUBLIC_` name.

### Local

```sh
cp apps/dashboard/.env.exemple apps/dashboard/.env
# set WRANGLER_PORT, AUTH_*, GPIO_COMPANION_DEVICE_PRIVATE_KEY, GITEA_*
bun run dev:dashboard
```

Dev server: http://localhost:3000 (proxies Wrangler). New page files need a restart.

### Production

```sh
bun run build:dashboard
bun run deploy:dashboard
```

`deploy` runs `bun run build` then `wrangler pages deploy .frame-master/build --project-name gpio-companion-dashboard`.

Confirm:

- Sign-in at `/login` → `/callback`
- `/pair`, `/wifi`, `/keys`, `/projects` load while authenticated
- A signed `PUT /v1/config/wifi` or pairing claim against a lab Pi succeeds (401/403 from the Pi means key mismatch or unsigned call)

## 3. Gitea (optional host service)

Worker: `apps/workers/gitea-container`. Commands:

```sh
bun run dev:gitea
bun run deploy:gitea
```

Limits (do not hide these from users):

- Disk is **ephemeral**. Sleep, host move, or redeploy wipes `/var/lib/gitea`.
- Git over **HTTPS only** (no inbound SSH).
- First request cold-starts (can take a minute). Complete the install wizard in the browser.
- Set `vars.GITEA_ROOT_URL` in that worker’s `wrangler.jsonc` to a stable public origin before deploy.

Point dashboard `PUBLIC_GITEA_URL` / `GITEA_URL` at that origin. Users **create their own Gitea account**. The host does not auto-provision Gitea users from pairing.

A dashboard `GITEA_TOKEN` (admin or read token) is what `/projects` uses to list repos and raw `pcb/` / `breadboard/` / `technical/` files. The **Pi** gets a **user** token via Keys (`PUT /v1/config/gitea`), stored only on-device in `/etc/gpio-companion/secrets.env` (mode 600).

## 4. Cloudflare tunnel (T3 Code)

Each board’s T3 Code tunnel is a **cloudflared replica**. The host (or the user, if you hand them a token) creates a Cloudflare Tunnel and hostname.

- First-setup on the Pi can collect token + hostname, **or** they can be applied later with signed `PUT /v1/config/tunnel`.
- Replica env on device: `/etc/gpio-companion/cloudflared.env`
- T3 pairing stays on the dashboard, not first-setup.

Do not put OpenCode API keys into first-setup. Those go through dashboard Keys after pair.

## 5. What users need from you

Give every desk user:

1. Dashboard origin (and that they must use Chrome/Edge for in-browser Bluetooth)
2. Gitea origin (if you host it)
3. How to get a Cloudflare tunnel token/hostname if first-setup asks
4. That pairing UUID + key are printed **on the Pi console** at first-setup — you do not email those
