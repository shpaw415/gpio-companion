# User documentation

This tree is for the person at the desk: Orange Pi or Raspberry Pi on the bench, dashboard in the browser, AI agent on the board. Operators who deploy Cloudflare and images: [`../host/`](../host/).

## Documents

| Doc | Contents |
| --- | --- |
| [getting-started.md](./getting-started.md) | Power on → WiFi → sign in → pair → GitHub → Keys |
| [wifi-bluetooth.md](./wifi-bluetooth.md) | Chrome Bluetooth and iOS LightBlue / nRF Connect paste |
| [workflows.md](./workflows.md) | Daily agent work, projects, PCB/breadboard folders, Arduino C |

## What you have

- A GPIO board running gpio-companion (Armbian, OpenCode, T3 Code)
- A dashboard account (email / Google / passkey — whatever the host enabled)
- Your GitHub account (pairing does not create one)

The agent on the Pi owns the OS, pins, and USB. You steer it from T3 Code / OpenCode and from the dashboard.
