---
name: gpio-arduino-proxy
description: >-
  USB Arduino as a Firmata slave/proxy on gpio-companion. Use for blinks, LEDs,
  PWM, sketches, breadboard, circuit, Arduino, Firmata, or proxy pin drive.
  Always GET /v1/arduino-proxy first; if connected write host/arduino-proxy-<name>/
  C, POST /v1/run, and add gpio-arduino-proxy to breadboard/diagram.json. Flash
  proxy firmware via POST /v1/flash/proxy. I2C/SPI/UART buses included.
---

# gpio-arduino-proxy

When a USB Arduino (AVR Uno/Nano/Mega, SAMD, or ESP32) is a **proxy**, this
companion drives every pin over Firmata. The MCU firmware stays the proxy.
Sketches run **on this Pi** (`POST /v1/run`), not as `/v1/flash` uploads.

Check first — before any blink, LED, sketch, breadboard, or pin drive:

```sh
curl -s http://127.0.0.1:4150/v1/arduino-proxy
```

You call loopback yourself. **Never** tell the user to curl it.

If `connected` is true:

1. Write C in `~/projects/<repo>/host/arduino-proxy-<kebab>/` (prefix required).
2. Use **Arduino pin numbers** (13 = LED_BUILTIN, A0 = 14 on Uno). Not companion header seats.
   `analogRead(A0)`, `analogRead(14)`, and `analogRead(0)` all read A0 on Uno (0–1023 AVR). Live GPIO `dir:in` on analog pins reports `adc`.
3. `POST /v1/run` `{ dir }` with that absolute folder.
4. Write `breadboard/diagram.json` with a `gpio-arduino-proxy` part (`attrs.board`
   from `fqbn`, e.g. `uno`). Wires use Arduino pins (`uno:13`, `uno:A0`, `uno:GND`).
   Skill `gpio-breadboard`. Do **not** map that circuit to `gpio-companion-header`.
5. Do **not** flash a project sketch unless the user asked — that replaces the proxy.
6. Skip D0/D1 on UART-USB AVR (Uno/Nano/Mega). SAMD/ESP32 native USB may use Serial1.

If not connected: skill `gpio-host` for this companion header. If a USB board is
present and the user wants a proxy: user flashes from dashboard
**Devices → Flash Arduino as proxy**. You may `POST /v1/flash/proxy`
`{ fqbn?, port? }` yourself. First flash of a family installs only that
`arduino-cli` core (`arduino:avr`, `arduino:samd`, or `esp32:esp32`) — never
install cores during companion update. Supported FQBNs: `arduino:avr:uno`,
`arduino:avr:nano`, `arduino:avr:mega`, `arduino:samd:nano_33_iot`,
`arduino:samd:mkrwifi1010`, `arduino:samd:mkrzero`, `arduino:samd:mzero`,
`esp32:esp32:esp32`, `esp32:esp32:esp32s3`, `esp32:esp32:esp32c3`.

## Voltage

- AVR Uno/Nano/Mega: **5V** — do not jumper to this board's 3.3V header.
- SAMD and ESP32: **3.3V**.

## APIs

- `GET /v1/arduino-proxy` — `{ connected, protocol: "firmata", fqbn, pins, buses }`
- `POST /v1/flash/proxy` `{ fqbn?, port? }` — bundled ConfigurableFirmata-compatible firmware
- Live GPIO WS `{ target: "arduino-proxy", physical, dir, value }` and bus ops
  `i2c-scan` / `i2c-read` / `i2c-write` / `spi-xfer` / `uart-write`
- User UI: **Devices → Flash Arduino as proxy**, **Project → Live GPIO**
  (Companion | Arduino), **Project → Run on board** (`arduino-proxy-*`)

Project git: same feature-branch flow; push `host/arduino-proxy-<name>/` and
`breadboard/`.
