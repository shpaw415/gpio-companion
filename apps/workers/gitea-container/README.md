# Gitea on Cloudflare Containers

Runs [Gitea's official rootless image](https://docs.gitea.com/installation/install-with-docker-rootless) (`gitea/gitea:1.27.2-rootless`) as a single Cloudflare Container, proxied by a Worker.

The Gitea repo Dockerfile is a **source build** and needs the full Gitea tree. This project uses the published image instead.

## Limits

- Disk is **ephemeral**. Sleep, host move, or redeploy wipes `/var/lib/gitea` (repos + SQLite).
- Git over **HTTPS only**. Inbound SSH/TCP is not available on Containers.
- `sleepAfter` is 24h of idle traffic; a platform stop still resets disk.

## Commands

```bash
bun install
bun run cf-typegen
bun run dev
bun run deploy
```

First request cold-starts Gitea (can take a minute). Complete the install wizard in the browser.

Optional: set `vars.GITEA_ROOT_URL` in `wrangler.jsonc` to a stable public origin before deploy.
