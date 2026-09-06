---
name: gpio-arduino
description: >-
  Flash Arduino C firmware over USB from a gpio-companion Pi. Use when compiling
  or uploading a .c/.ino sketch with arduino-cli via the device flash API.
---

# gpio-arduino

Do **not** shell `avrdude` or `arduino-cli` directly. Use the loopback flash API.

## API

```sh
curl -s http://127.0.0.1:4150/v1/flash/ports
curl -s -X POST http://127.0.0.1:4150/v1/flash \
  -H 'content-type: application/json' \
  -d '{"fqbn":"arduino:avr:uno","dir":"/home/gpio/blink"}'
curl -s http://127.0.0.1:4150/v1/flash
```

- `GET /v1/flash/ports` — USB boards (`address`, optional `fqbn`)
- `POST /v1/flash` `{ fqbn, dir, port? }` — starts compile+upload, returns `{ started: true }`
- `GET /v1/flash` — `{ running, last }`

`dir` is an absolute path on this Pi and must contain a `.c` or `.ino`. Firmware is **C**. Unsigned loopback only without Ed25519 headers; dashboard/BLE flash is signed.

Poll `GET /v1/flash` until `running` is false. Do not start a second job while one is running (409).
