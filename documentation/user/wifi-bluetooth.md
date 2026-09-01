# WiFi over Bluetooth (user)

The dashboard **signs** every WiFi command with gpio-companion’s private key and a timestamp (replay window 60 seconds). The Pi checks the signature and that the pairing UUID in the command matches **this** board. Unsigned BLE writes do nothing useful.

A fresh board with no RTC (typical Orange Pi) often has a clock far behind Cloudflare. While it is offline (NTP not synced), the Pi accepts each signed BLE command **once** (`X-Gpio-Nonce`) and does not use the 60-second window. The first valid command may also set the clock. After NTP (or that clock set) the 60-second window applies; a reused nonce is always rejected.

You must be **signed in**, and the board must already be **paired** to your account. Choose it from the paired-device dropdown. The dashboard will not sign a WiFi command for any other UUID.

Bluetooth name: **gpio-companion**.

## Chrome or Edge (desktop / Android)

1. Pair the board on `/devices/pair` if you have not already
2. Open `/devices/wifi`
3. Select the paired device, then SSID and password
4. **Connect over Bluetooth** and pick `gpio-companion`
5. Wait until status says connected

Safari, Firefox, and iOS Chrome/Safari **cannot** use Web Bluetooth in this page. Use the native apps instead: `apps/mobile` (iOS/Android) or `apps/desktop` (Windows/Linux/macOS).

Chrome’s chooser uses **this computer’s** Bluetooth (not the Pi’s). Quit `bluetoothctl` first. Android Chrome needs Location allowed for BLE scans. nRF Connect can see the board even when the dashboard chooser is empty if the advert has no service UUID.

## Native desktop (Windows / Linux / macOS)

The Tauri app in `apps/desktop` signs in with GitHub, then pairs and sends WiFi over native Bluetooth (not Web Bluetooth).

```sh
cd apps/desktop
bun install
bun run tauri:dev
```

Linux: install WebKitGTK/GTK build deps (see `apps/desktop/README.md`) and join the `bluetooth` group. Quit `bluetoothctl` while scanning.

## iOS workaround (until using the native app)

Safari cannot talk to the Pi from the website. Use sign-and-copy:

1. On `/devices/wifi` choose the paired device, then fill SSID and WiFi password
2. **Sign and copy** — the signed JSON is shown in a copy block (and copied to the clipboard)
3. Install [LightBlue](https://apps.apple.com/app/lightblue/id557428110) or [nRF Connect](https://apps.apple.com/app/nrf-connect-for-mobile/id1054366564)
4. Scan and connect to **gpio-companion** (copy the Bluetooth name from the page)
5. Open the **write** characteristic (copy it from the page)
6. Paste the JSON as **UTF-8 text** (not hex) and send
7. Read the **status** characteristic — `{ "connected": true, "ssid": "…" }` on success, or `{ "error": "…", "reason": "ssid-not-found"|"password"|"no-device"|"failed" }` on failure

The Pi accepts that JSON text. Prefer `apps/mobile` (iOS/Android) or `apps/desktop` (Windows/Linux/macOS) instead of a third-party BLE app.

If copy failed, use **Copy to clipboard** on `/devices/wifi`. If the timestamp is older than about a minute, sign again (replay protection). The first successful paste may also set the board clock.

## If Bluetooth is missing

- Orange Pi without a radio: use Ethernet or a USB WiFi dongle + TTY `nmcli`
- Host may disable BLE with `GPIO_COMPANION_BLE=0`
- HDMI/serial first-setup remains valid
