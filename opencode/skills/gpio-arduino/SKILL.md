---
name: gpio-arduino
description: >-
  Flash Arduino C firmware over USB from a gpio-companion Pi. USB Arduino only
  — this board's header is C-first via gpio-host POST /v1/run, not flash and
  not PUT /v1/gpio. Use when compiling or uploading a .c/.ino via /v1/flash.
---

# gpio-arduino

USB Arduino only (`POST /v1/flash`). This board's GPIO header is C-first via
skill `gpio-host` (`POST /v1/run`), not flash and not `PUT /v1/gpio`.

Do **not** shell `avrdude` or `arduino-cli` directly. Use the loopback flash API.

You call that API yourself. **Never** tell the user to `curl` `127.0.0.1:4150`.
If the user should flash: dashboard **Project → Flash Arduino** (pick the sketch
name). Do not ask them for a Pi path.

## API (agent only)

```sh
curl -s http://127.0.0.1:4150/v1/flash/ports
curl -s -X POST http://127.0.0.1:4150/v1/flash \
  -H 'content-type: application/json' \
  -d '{"fqbn":"arduino:avr:uno","dir":"/home/gpio/blink"}'
curl -s http://127.0.0.1:4150/v1/flash
```

- `GET /v1/flash/ports` — USB boards (`address`, optional `fqbn`)
- `GET /v1/flash/sketches` — USB sketches under `~/projects/<repo>/firmware/`
- `POST /v1/flash` `{ fqbn, dir, port? }` — starts compile+upload, returns `{ started: true }`
- `GET /v1/flash` — `{ running, last }`

`dir` is an absolute path on this Pi and must contain a `.c` or `.ino`. Firmware is **C**. Put each sketch in `~/projects/<repo>/firmware/<name>/` (one directory per sketch) and `git push` `firmware/` on a **feature branch**. Ask to save; merge `main` only when the user says yes (skill `gpio-companion` **Project git**). The dashboard lists those names from the board copy. Host GPIO sketches stay under `host/` and are not USB drop-ins. Unsigned loopback only without Ed25519 headers; dashboard/BLE flash is signed.

Poll `GET /v1/flash` until `running` is false. Do not start a second job while one is running (409).

After a successful flash with `port` set, the board opens that USB serial and streams `Serial.print` to Project **Flash Arduino**. Users can also Open/Close serial there. Do not tell the user to curl `/v1/console`.
