---
name: gpio-breadboard
description: >-
  Generate a Wokwi-style breadboard diagram.json so the gpio-companion dashboard
  can show how to plug parts and jumpers. Use when wiring a breadboard, mapping
  GPIO header pins to holes, or finishing a bench test circuit.
---

# gpio-breadboard

Write a plug map the dashboard can render. Do **not** use tscircuit for this file (tscircuit is for `pcb/`).

## Output

When a breadboard wiring task is done, write and `git push`:

- `breadboard/diagram.json` (required) — Wokwi [diagram.json](https://docs.wokwi.com/diagram-format) plus gpio-companion header
- `breadboard/preview.svg` (optional)

## diagram.json

```json
{
  "version": 1,
  "editor": "gpio-companion",
  "parts": [
    { "id": "bb1", "type": "wokwi-breadboard-half", "left": 80, "top": 0 },
    {
      "id": "header",
      "type": "gpio-companion-header",
      "left": 0,
      "top": 40,
      "attrs": { "hardware": "raspberrypi" }
    },
    {
      "id": "led1",
      "type": "wokwi-led",
      "left": 200,
      "top": 140,
      "attrs": { "color": "red" }
    }
  ],
  "connections": [
    ["header:11", "bb1:10a", "yellow", ["h20"]],
    ["led1:A", "bb1:10e", "green", []],
    ["led1:C", "bb1:11e", "green", []],
    ["header:6", "bb1:tn.1", "black", []]
  ],
  "steps": [
    { "text": "LED anode in row 10 column e, cathode in row 11", "highlight": ["led1"] }
  ]
}
```

## Rules

- Load `gpio-pinout-raspberrypi` or `gpio-pinout-orangepi` from `/etc/gpio-companion/config.json` `hardware` before placing jumpers.
- `gpio-companion-header` pins are **physical** 1–40. `attrs.hardware` must be `raspberrypi` or `orangepi`.
- Always include one `wokwi-breadboard-half` (30 rows), `wokwi-breadboard` (63), or `wokwi-breadboard-mini`.
- Breadboard holes: `{row}{column}` such as `10a` … `10e` / `10f` … `10j`. Rails: `tp.1`, `tn.1`, `bp.1`, `bn.1`.
- Part types for components: `wokwi-led`, `wokwi-resistor`, `wokwi-pushbutton`, and other `@wokwi/elements` names.
- Connections are `[from, to, color, wires]`. Endpoints are `partId:pin`.
- 3.3V logic only. Never wire header 5V (physical 2, 4 on Pi-layout boards) into a GPIO pin.
- On Orange Pi, SoC line numbers are not BCM — confirm with `gpioinfo`.
- `steps` are plug instructions the dashboard highlights.

Then `git add breadboard/`, commit, `git push`.
