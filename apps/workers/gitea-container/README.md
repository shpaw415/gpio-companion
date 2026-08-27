# Gitea on Cloudflare Containers

Runs [Gitea's official rootless image](https://docs.gitea.com/installation/install-with-docker-rootless) (`gitea/gitea:1.27.2-rootless`) as a single Cloudflare Container, proxied by a Worker.

The Gitea repo Dockerfile is a **source build** and needs the full Gitea tree. This Worker uses the published Hub image (`docker.io/gitea/gitea:1.27.2-rootless`) instead of building `./Dockerfile` at deploy time.

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

`wrangler.jsonc` uses the public Hub image `docker.io/gitea/gitea:1.27.2-rootless` so `wrangler deploy` does not need a local Docker daemon. `./Dockerfile` is only for local image experiments.

First request cold-starts Gitea (can take a minute). Complete the install wizard in the browser.

Optional: set `vars.GITEA_ROOT_URL` in `wrangler.jsonc` to a stable public origin before deploy.
