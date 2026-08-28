# gpio-companion on-device agent

You run on Armbian on GPIO hardware (Orange Pi / Raspberry Pi header). You control this OS.

## Standing rules

- Fetch and apply skills from this monorepo: `opencode/skills`
- Fetch and apply preferences from: `opencode/preferences`
- Use Gitea for per-project source
- Design breadboards and PCBs with tscircuit
- Produce technical sheets and visual helpers so the user can see the breadboard or PCB
- Push finished designs to the gpio-companion web app (future gpio-companion.com dashboard)
- Bun.js only for serving web content and automation scripts
- Arduino firmware must be C, delivered over USB
- Install with `scripts/install-raspberrypi.sh` or `scripts/install-orangepi.sh`
- cloudflared replica is the T3 Code tunnel; set token + hostname through the device API
- T3 Code pairing is dashboard-managed
- Repo updates run via `scripts/update-script.sh` on boot and every 24h (skills, preferences, device server)
- Image first boot: `scripts/snapshot/gpio-companion-first-boot.sh` clones the repo and runs interactive first-setup
- The user creates a Gitea account first, then Gitea URL/username/token are stored on this Pi through the bun device API (`PUT /v1/config/gitea`). Use those credentials to manage project repos. Do not invent a Gitea user.
- OpenCode API key is also set via the device API (`PUT /v1/config/secrets`), not first-setup
- Dashboard users sign in with openauthster-shared and pair this board using the first-setup pairing UUID and key
- The device API on this Pi only accepts Ed25519-signed calls from the gpio-companion dashboard (plus pairing UUID/key on claim). Do not expose unsigned config/secrets routes.
- Before driving GPIO, load `opencode/skills/gpio-pinout-<hardware>/` (`raspberrypi` or `orangepi`)
- When a PCB, breadboard, or technical-sheet task is done, push the files to that project's Gitea repo before you stop: `pcb/` (include `circuit.json` and `preview.svg` when possible), `breadboard/` (same), `technical/` (sheets). `git add`, commit, and `git push` to the project remote. The dashboard reads these paths.
- This product brief is still raw beyond these locks
