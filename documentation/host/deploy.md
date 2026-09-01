# Deploy (host)

Deploy order: **device keys → dashboard (auth + KV + secret) → tell users the URLs**. Boards can boot before a user connects the GitHub App; they cannot accept signed dashboard commands until first-setup has fetched `GET /api/device-public-key` for the private key you installed on Cloudflare.

## Prerequisites

- Bun 1.2+ (1.3+ for the dashboard template)
- Cloudflare account (Pages, KV, Wrangler)
- An [openauthster](https://github.com/shpaw415) / OpenAuthster issuer the dashboard can use (`PUBLIC_AUTH_ISSUER`, `PUBLIC_AUTH_CLIENT_ID`, `AUTH_SECRET`). Enable the GitHub provider; dashboard `/login` only offers GitHub.
- OpenAuthster project roles: `user` and `admin`. New logins are `user`. Promote operators in the OpenAuthster WebUI Users page (`setUserRoleById`). Admins can open dashboard `/devices/admin` to read status and send T3/WiFi to any account’s Pi. After promoting, the user should sign in again (the first access token always carries `role: "user"` until refresh).
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

Create a KV namespace and replace `<kv-binding-id>` in `apps/dashboard/wrangler.jsonc` (`DYNAMIC_PAGE_KV`). Pairing records are stored as `device:<userId>` (array) and `pair:<uuid>`. GitHub App installs are `github-app:<userId>`. Legacy PATs may still exist as `github:<userId>`. AI credits are `credits:<userId>` as `{v:2,micros}` (USD microdollars; legacy integer credits migrate at $0.01 each); Pi OpenCode keys hash to `ai:<sha256>`. Enable the `AI` Workers AI binding in wrangler. Set `GPIO_AI_MARKUP` (default `1.25`). GLM-5.3 (`@cf/zai-org/glm-5.3`) requires Workers Paid or AI Gateway prepaid credits.

### GitHub App (required)

Users do **not** paste a PAT. Each signed-in user installs **your** GitHub App from dashboard `/devices/keys`. The Pi never stores a long-lived token: `git push` calls `gpio-companion git-credential`, which hits loopback `GET /v1/github-token`, which `POST`s pairing uuid+key to `https://gpio-companion.com/api/github-credentials`. The dashboard mints a 1-hour installation token (`ghs_…`) and git uses username `x-access-token`.

If a board is offline for more than an hour, the user does nothing except push again once it has internet.

#### Create the App (once per environment)

1. GitHub (org or user that owns gpio-companion) → **Settings → Developer settings → GitHub Apps → New GitHub App**.
2. Fill:

   | Field | Value |
   | --- | --- |
   | GitHub App name | `gpio-companion` (or `gpio-companion-staging`). This becomes the **slug** in `https://github.com/apps/<slug>`. |
   | Homepage URL | `https://gpio-companion.com` |
   | Callback URL | `https://gpio-companion.com/devices/keys` (unused for OAuth; required by the form) |
   | Expire user authorization tokens | leave default |
   | Request user authorization (OAuth) during installation | **unchecked** |
   | Setup URL (Post installation) | `https://gpio-companion.com/devices/keys` |
   | Redirect on update | **checked** so GitHub returns `?installation_id=&setup_action=&state=` |
   | Webhook | **unchecked** (inactive). This App does not consume webhooks. |
   | Where can this GitHub App be installed? | **Any account** |

3. Repository permissions (only these):

   | Permission | Access | Why |
   | --- | --- | --- |
   | **Contents** | Read and write | clone / commit / `git push` |
   | **Metadata** | Read-only | mandatory with Contents |
   | **Administration** | Read and write | agent **creates** repos under the installer account |

   Leave all other repository, organization, and account permissions **No access**.

4. Create the App. On the app page copy:

   - **App ID** — integer, e.g. `123456` → `GITHUB_APP_ID`
   - **Public link** `/apps/<slug>` → `GITHUB_APP_SLUG` (the path segment only, e.g. `gpio-companion`)
5. **Generate a private key**. GitHub downloads `*.pem` (`-----BEGIN RSA PRIVATE KEY-----` or `BEGIN PRIVATE KEY`). Store it outside git (mode 0600). This is `GITHUB_APP_PRIVATE_KEY`. You cannot re-download it; generate a new key if lost.
6. Optional: set the app logo. Do not enable “Expire user authorization tokens” workflows; we mint **installation** tokens, not user-to-server OAuth.

Staging: repeat as a second App (`gpio-companion-staging`) with Setup URL `http://localhost:3010/devices/keys` (or your tunnel). Do not reuse production keys.

#### Put credentials on Cloudflare Pages

From `apps/dashboard` (`--project-name gpio-companion-dashboard`):

```sh
# public identifiers — vars are fine
npx wrangler pages secret put GITHUB_APP_ID
# paste the numeric App ID

npx wrangler pages secret put GITHUB_APP_SLUG
# paste the slug only, e.g. gpio-companion

# private PEM — never commit, never PUBLIC_
printf '%s' "$(cat /path/to/gpio-companion.private-key.pem)" | npx wrangler pages secret put GITHUB_APP_PRIVATE_KEY
```

Local (`apps/dashboard/.dev.vars` or `.env`, see `.env.exemple`):

```
GITHUB_APP_ID=123456
GITHUB_APP_SLUG=gpio-companion
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
```

Newlines in `.dev.vars` can be literal; Wrangler accepts a PEM block. Never prefix these with `PUBLIC_`.

#### Runtime map

| Piece | Location |
| --- | --- |
| App install record | KV `github-app:<userId>` = `{ installationId, login }` |
| Install CSRF | KV `github-app-state:<uuid>` (TTL 15 min) |
| Dashboard mint | `GET`/`POST` `/api/github-app` (signed-in user) |
| Pi mint | `POST /api/github-credentials` body `{ uuid, key }` (pairing secret, TLS) |
| Git on the Pi | `/etc/gitconfig` helper `!/usr/local/bin/gpio-companion git-credential` |
| Agent API token | `gpio-companion github-token` (same mint path) |

`/projects` lists **installation** repos (`GET /installation/repositories`), not `/user/repos`. Legacy KV `github:<userId>` PATs still work if present; Keys no longer collects them.

#### Confirm

1. Dashboard `/devices/keys` while signed in shows **Connect GitHub** (not a PAT form). If you see `github app is not configured`, the three secrets are missing on that Wrangler environment.
2. Install the App on a test GitHub account (all repos or selected).
3. Redirect lands on `/devices/keys` with `installation_id` + `state`; page shows **Connected as @login**.
4. On a paired Pi: `curl -sS http://127.0.0.1:4150/v1/github-token` (loopback only) returns `token` starting `ghs_`. `git push` to a repo the App can access succeeds without a PAT.

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
| `GITHUB_APP_ID` | GitHub App id (secret/var) |
| `GITHUB_APP_PRIVATE_KEY` | GitHub App private PEM (secret) |
| `GITHUB_APP_SLUG` | GitHub App slug for `/apps/{slug}/installations/new` |

`PUBLIC_*` is injected into the browser. Never put `GPIO_COMPANION_DEVICE_PRIVATE_KEY`, `AUTH_SECRET`, or `GITHUB_APP_PRIVATE_KEY` under a `PUBLIC_` name.

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

The host does **not** run Gitea. Each dashboard user uses **their GitHub account** by installing **your** GitHub App (section 2). You do not collect PATs.

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

T3 pairing stays on the dashboard: first-setup runs `t3 service install`; after claim the dashboard runs `t3 pair` and shows the pair code/QR and `https://t3-…/pair#token=…`.

first-setup bakes `GPIO_AI_KEY` and the OpenCode provider pointing at `/api/ai/v1` with default model `@cf/zai-org/glm-5.3`. `POST /api/ai/v1/chat/completions` forwards OpenAI `tools`/`tool_calls` and bills Cloudflare list in/out (cached-in when present) × `GPIO_AI_MARKUP`. Do not paste OpenCode or Cloudflare tokens on Keys. GitHub access is the App install on Keys, not a PAT.

## 5. What users need from you

Give every desk user:

1. Dashboard origin (and that they must use Chrome/Edge for in-browser Bluetooth)
2. That projects live on **their GitHub**; after pair they **Connect GitHub** on `/devices/keys` (install your App — no PAT)
3. Cloudflare API token / account ID / zone ID for first-setup (Tunnel Edit + DNS Edit on `gpio-companion.com`)
4. That pairing UUID + key and the `api-` / `t3-` URLs are printed **on the Pi console** at first-setup — you do not email those
