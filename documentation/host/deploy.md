# Deploy (host)

Deploy order: **device keys → dashboard (auth + KV + secret) → tell users the URLs**. Boards can boot before a user has a GitHub PAT; they cannot accept signed dashboard commands until first-setup has fetched `GET /api/device-public-key` for the private key you installed on Cloudflare.

## Prerequisites

- Bun 1.2+ (1.3+ for the dashboard template)
- Cloudflare account (Pages, KV, Wrangler)
- An [openauthster](https://github.com/shpaw415) / OpenAuthster issuer the dashboard can use (`PUBLIC_AUTH_ISSUER`, `PUBLIC_AUTH_CLIENT_ID`, `AUTH_SECRET`). Enable the GitHub provider; dashboard `/login` only offers GitHub.
- This repo cloned; `bun install` at the monorepo root

```sh
bun install
bun test
bun run typecheck
```

## 1. Device Ed25519 pair

Generate once per environment (staging vs production). Private PEM must never be committed.

```sh
bun run keys:device
```

Writes:

- `.device-keys/gpio-companion-v1.private.pem` (gitignored, mode 0600)
- `.device-keys/gpio-companion-v1.public.pem`

Do **not** commit the public key. Pis register it at first-setup from `GET /api/device-public-key` (derived from this private secret).

Upload the private key as a Pages secret (from `apps/dashboard`):

```sh
bun run keys:device -- --wrangler
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

Create a KV namespace and replace `<kv-binding-id>` in `apps/dashboard/wrangler.jsonc` (`DYNAMIC_PAGE_KV`). Pairing records are stored as `device:<userId>` and `pair:<uuid>`. Per-user GitHub PATs for `/projects` are stored as `github:<userId>`. AI credits are `credits:<userId>`; Pi OpenCode keys hash to `ai:<sha256>`. Enable the `AI` Workers AI binding in wrangler.

### Vars (wrangler.jsonc and/or Pages)

Committed `vars` override dashboard-only values if they are empty strings. Set real origins in wrangler (or stop shipping empty baked vars).

| Name | Role |
| --- | --- |
| `PUBLIC_AUTH_CLIENT_ID` | OpenAuthster client (default `__gpio_companion__`) |
| `PUBLIC_AUTH_ISSUER` | Auth issuer URL |
| `PUBLIC_AUTH_REDIRECT_URI` | Must match the deployed origin + `/callback` |
| `AUTH_SECRET` | OpenAuthster client secret (secret, not a public var) |
| `GPIO_COMPANION_DEVICE_PRIVATE_KEY` | Ed25519 PKCS8 PEM (secret) |
| `GPIO_COMPANION_DEVICE_KEY_ID` | `gpio-companion-v1` |

`PUBLIC_*` is injected into the browser. Never put the device private key or `AUTH_SECRET` under a `PUBLIC_` name.

### Local

```sh
cp apps/dashboard/.env.exemple apps/dashboard/.env
# set WRANGLER_PORT, AUTH_*, GPIO_COMPANION_DEVICE_PRIVATE_KEY
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

## 3. GitHub (user accounts)

The host does **not** run Gitea. Each dashboard user uses **their GitHub account**.

- Keys: GitHub username + classic PAT (`repo` scope) at https://github.com/settings/tokens
- Dashboard stores the PAT in KV (`github:<userId>`) so `/projects` lists that user's repos
- The same save signs `PUT /v1/config/github` to the Pi; on-device `/etc/gpio-companion/secrets.env` (mode 600) plus `git-credentials`

If an old `gitea-container` Worker is still deployed, delete it (`wrangler delete gitea-container`).

## 4. Cloudflare tunnel (T3 Code)

Each board gets its **own remotely-managed Cloudflare Tunnel** at first-setup (not a shared replica). Zone: `gpio-companion.com`.

First-setup prompts for:

- Cloudflare API token (Account Cloudflare Tunnel Edit + Zone DNS Edit) — **not stored on the Pi**
- Account ID
- Zone ID

It creates `gpio-<pairing-uuid>`, publishes:

- `api-<uuid>.gpio-companion.com` → `http://127.0.0.1:4150`
- `t3-<uuid>.gpio-companion.com` → `http://127.0.0.1:3773`

`<uuid>` is the pairing UUID with dashes stripped. Replica token lives in `/etc/gpio-companion/cloudflared.env`. Signed `PUT /v1/config/tunnel` can still rewrite it.

T3 pairing stays on the dashboard: after claim it runs `t3 start`, shows `https://app.t3.codes/pair?host=https://t3-…`, then `t3 service install`.

first-setup bakes `GPIO_AI_KEY` and the OpenCode provider pointing at `/api/ai/v1`. Do not paste OpenCode or Cloudflare tokens on Keys. GitHub PAT still goes through Keys after pair.

## 5. What users need from you

Give every desk user:

1. Dashboard origin (and that they must use Chrome/Edge for in-browser Bluetooth)
2. That projects live on **their GitHub** (classic PAT with `repo`)
3. Cloudflare API token / account ID / zone ID for first-setup (Tunnel Edit + DNS Edit on `gpio-companion.com`)
4. That pairing UUID + key and the `api-` / `t3-` URLs are printed **on the Pi console** at first-setup — you do not email those
