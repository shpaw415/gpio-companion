---
name: gpio-pwm
description: >-
  Testing-only analogWrite, tone, and analogRead via PUT /v1/gpio. Prefer
  analogWrite/tone in a C sketch (gpio-host). Use this path only for a one-shot
  pin test (fade an LED, probe a buzzer) on Orange Pi or Raspberry Pi.
---

# gpio-pwm

Prefer `analogWrite` / `tone` in a C sketch (skill `gpio-host`). Use this PUT
API only for a one-shot test the user asked for.

When testing, drive PWM and tone through `http://127.0.0.1:4150/v1/gpio`. Do
**not** shell `gpio-pwm`, pyA20, orangepwm.py, or `gpioset` for analogWrite.

Load the pinout skill first (`gpio-pinout-orangepi` or `gpio-pinout-raspberrypi`).
Use **physical** pins 1–40. Refuse power, GND, Raspberry Pi 27–28, and unresolved
Orange Pi lines.

## analogWrite (software PWM)

Any driveable GPIO. Duty is Arduino 0–255 at ~490 Hz.

```sh
curl -s -X PUT http://127.0.0.1:4150/v1/gpio \
  -H 'content-type: application/json' \
  -d '{"physical":7,"dir":"pwm","analog":128}'
```

0 = solid low, 255 = solid high. Live GPIO websocket accepts the same JSON.

## tone / noTone

```sh
curl -s -X PUT http://127.0.0.1:4150/v1/gpio \
  -H 'content-type: application/json' \
  -d '{"physical":7,"op":"tone","hz":440}'
curl -s -X PUT http://127.0.0.1:4150/v1/gpio \
  -H 'content-type: application/json' \
  -d '{"physical":7,"op":"notone"}'
```

`hz` must be 31–65535.

## digital

Unchanged: `{ "physical": 11, "dir": "out", "value": 1 }` or `{ "dir": "in" }`.
Digital in/out stops PWM/tone on that pin.

## analogRead

`GET /v1/gpio` snapshot. A pin only has `adc` if the kernel exposes IIO GPADC.
Orange Pi 3 LTS 26-pin header has **no ADC** — do not invent a number. Tell the
user analogRead is unavailable on that header.

## Orange Pi 3 LTS

Hardware PWM1 in the device tree is PB19 (not on the header). `pwmchip0` exists
but header PWM is **software PWM** via the companion helper. Snapshot names use
SoC lines (PD22, …). Do not assume Raspberry Pi BCM or sysfs PWM0/PWM1 seats.

## Do not

- Use this PUT path for lasting PWM/tone — write C and `POST /v1/run` instead
- Spawn `/usr/local/lib/gpio-companion/gpio-pwm` yourself
- Use Python orangepwm / pyA20
- Treat header pin 7 as hardware PWM unless the snapshot shows `analog` or `pwm`
