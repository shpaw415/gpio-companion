# gpio-companion

Read `PRODUCT.md` first. On-device OpenCode/T3Code agents also load:

- `opencode/preferences/`
- `opencode/skills/`

Bun for web and scripts. Header GPIO is C-first (`gpio-host` `/v1/run`) after `GET /v1/arduino-proxy`; if the proxy is connected, `gpio-arduino-proxy` (`host/arduino-proxy-<name>/`) wins. `PUT /v1/gpio` is testing-only. Arduino firmware in C over USB. USB Arduino proxy is Firmata (`/v1/flash/proxy`). GitHub for per-project git. tscircuit for breadboard/PCB. Vision is raw until the user locks more.

Dashboard feature parity (locked 2026-09-14): `apps/dashboard`, `apps/desktop`, and `apps/mobile` ship the same features. Do not land a feature or UX fix on only one platform. Mirror UX; do not share React files.
