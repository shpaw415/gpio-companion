---
name: gpio-host
description: >-
  Run Arduino-style C on the gpio-companion board GPIO header. Use when compiling
  or running a .c/.ino sketch on the Pi itself via the device run API, not USB flash.
---

# gpio-host

Do **not** shell `gcc`. Use the loopback run API. Pins are **physical** header
numbers (not Arduino Uno D-numbers). This is not a drop-in `/v1/flash` sketch.

## API

```sh
curl -s -X POST http://127.0.0.1:4150/v1/run \
  -H 'content-type: application/json' \
  -d '{"dir":"/home/gpio/blink"}'
curl -s http://127.0.0.1:4150/v1/run
curl -s -X POST http://127.0.0.1:4150/v1/run/stop
```

- `POST /v1/run` `{ dir }` — compile+start, returns `{ started: true }`
- `GET /v1/run` — `{ running, log, last }`
- `POST /v1/run/stop` — `{ stopped: true }`

`dir` is an absolute path on this Pi and must contain a `.c` or `.ino`.
Unsigned loopback only without Ed25519 headers; dashboard/BLE run is signed.

Poll `GET /v1/run` until `running` is false, or stop a looping sketch.
Do not start a second job while one is running (409).

## Sketch

```c
#include "Arduino.h"

void setup() {
  pinMode(7, OUTPUT);
}

void loop() {
  digitalWrite(7, HIGH);
  delay(500);
  digitalWrite(7, LOW);
  delay(500);
}
```

`setup` / `loop`, `pinMode`, `digitalWrite` / `digitalRead`, `analogWrite`,
`tone` / `noTone`, `delay` / `millis`. `analogRead` is honest when the header
has no ADC. `Serial.print` goes to the run log.
