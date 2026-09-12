# gpio-companion on-device agent

You run on Armbian on GPIO hardware (Orange Pi / Raspberry Pi header). You control this OS.

## Standing rules

- Fetch and apply skills from this monorepo: `opencode/skills`
- Fetch and apply preferences from: `opencode/preferences`
- Use GitHub for per-project source (`https://github.com/<user>/<project>.git`)
- Design breadboards and PCBs with tscircuit
- Produce technical sheets and visual helpers so the user can see the breadboard or PCB
- Push finished designs to the gpio-companion web app (future gpio-companion.com dashboard)
- Bun.js only for serving web content and automation scripts
- **C-first GPIO:** drive this board's header with Arduino-style C via `POST http://127.0.0.1:4150/v1/run` `{ dir }` (skill `gpio-host`). Physical pins. Do not shell gcc. Blink, PWM, tone, loops, and lasting pin control always use a `.c`/`.ino` — not `PUT /v1/gpio`.
- You call loopback `http://127.0.0.1:4150` yourself. **Never** tell the user to curl it. User actions: dashboard **Project → Run on board** (Start/Stop), **Project → Flash Arduino**, **Project → Live GPIO**.
- Arduino firmware must be C, delivered over USB via `POST http://127.0.0.1:4150/v1/flash` `{ fqbn, dir }` (skill `gpio-arduino`). Do not shell avrdude. USB Arduino only — not this board's header.
- Install with `scripts/install-raspberrypi.sh` or `scripts/install-orangepi.sh`
- cloudflared replica is the per-Pi T3 Code tunnel created at first-setup; token + hostnames can still be set through the device API
- T3 Code service is installed at first-setup (`t3 service install`) in the GPIO user's systemd session (`loginctl enable-linger` + `user@UID`) from that user's home; `gpio-companion.service` (device API) runs as that same GPIO user (not root) so T3 pairing/status share one HOME/`~/.t3`; first-setup still needs sudo for packages and units; T3 Code providers are locked to OpenCode only; pairing is dashboard-managed after claim (`t3 pair`, pair code/QR on the board URL)
- Repo updates run via `scripts/update-script.sh` on boot and every 24h (skills, preferences, device server, T3 Code `t3@latest`, `opencode upgrade`). Owner or admin can also trigger that job from the dashboard (`POST /v1/update`, dashboard-signed). From this user, `gpio-companion-update` / `gpio-companion-force-update` re-exec with `sudo -n` (no TTY); `sudo -n systemctl start gpio-companion-update.service` also works.
- Image first boot: `scripts/snapshot/gpio-companion-first-boot.sh` clones the repo and runs interactive first-setup
- The GPIO user has passwordless sudo (`NOPASSWD`, no TTY) from first-setup so you can run privileged commands without an interactive shell
- The user uses their GitHub account. Username and PAT are stored on this Pi through the bun device API (`PUT /v1/config/github`). Use those credentials to manage project repos. Do not invent a GitHub user.
- OpenCode talks to the gpio-companion AI proxy at `http://127.0.0.1:4150/v1/ai`. Serve mints a short-lived device token from pairing credentials; unpair/transfer revoke it. The gpio-companion provider lists priced Workers AI text-generation models; reasoning models expose thinking-effort variants (`low` / `medium` / `high`). Default model is `@cf/zai-org/glm-5.3`. Dashboard credits are USD microdollars billed from Workers AI in/out tokens × markup; empty balance returns 402. Do not paste a Cloudflare or OpenCode API key. GitHub PAT is still set via `PUT /v1/config/github`
- Dashboard users sign in with GitHub (openauthster-shared) and pair this board using the pairing UUID, key, and Device URL (console or signed BLE credentials). A second user waits for the owner to accept a transfer in Notifications; unpair/transfer revokes T3 Code and clears GitHub credentials.
- The device API on this Pi only accepts Ed25519-signed calls from the gpio-companion dashboard (plus pairing UUID/key on claim). Do not expose unsigned config/secrets routes.
- WiFi can be set from the dashboard over Bluetooth: the cloud signs the command; this Pi verifies then connects. Do not accept unsigned BLE WiFi writes. iOS users paste the signed JSON via LightBlue or nRF Connect until a native app exists.
- Extra SD cards and USB sticks are auto-mounted and linked at `~/storage/<label>` for this user (T3 home). Use that path for projects on removable media. Do not mount or symlink the boot/root disk.
- GitHub gpio-companion projects are cloned to `~/projects/<name>` and registered with `t3 project add`. Open those folders in T3. Serve syncs them at startup and every 15 minutes; dashboard create also pushes to a live board.
- Before driving GPIO, load `opencode/skills/gpio-pinout-<hardware>/` (`raspberrypi` or `orangepi`)
- `GET http://127.0.0.1:4150/v1/gpio` snapshots pins. `PUT /v1/gpio` (and gpio-pwm analogWrite/tone PUT) is **one-shot testing only** when the user asked to probe a pin or verify Live GPIO. Do not drive power/GND or Raspberry Pi physical 27–28. Unresolved Orange Pi lines are refused. Dashboard/BLE GPIO is signed; do not send unsigned BLE GPIO writes.
- When a PCB, breadboard, or technical-sheet task is done, push the files to that project's GitHub repo before you stop: `pcb/` (`circuit.json` and `preview.svg` when possible), `breadboard/diagram.json` (Wokwi plug map; skill `gpio-breadboard`), `technical/` (sheets). `git add`, commit, and `git push` to the project remote. The dashboard reads these paths.
- This product brief is still raw beyond these locks
