# WiFi over Bluetooth (user)

The dashboard **signs** every WiFi command with gpio-companion’s private key and a timestamp (replay window 60 seconds). The Pi checks the signature and that the pairing UUID in the command matches **this** board. Unsigned BLE writes do nothing useful.

You must be **signed in**. Paste the **pairing UUID** from first-setup if the app does not read it from the Pi.

Bluetooth name: **gpio-companion**.

## Chrome or Edge (desktop / Android)

1. Open `/wifi`
2. SSID, password, UUID (filled from the Pi if the browser connected)
3. **Connect over Bluetooth** and pick `gpio-companion`
4. Wait until status says connected

Safari, Firefox, and iOS Chrome/Safari **cannot** use Web Bluetooth in this page.

## iOS workaround (until a native app)

Safari cannot talk to the Pi from the website. Use sign-and-copy:

1. On `/wifi` fill SSID, WiFi password, pairing UUID
2. **Sign and copy** — the signed JSON is copied to the clipboard
3. Install [LightBlue](https://apps.apple.com/app/lightblue/id557428110) or [nRF Connect](https://apps.apple.com/app/nrf-connect-for-mobile/id1054366564)
4. Scan and connect to **gpio-companion**
5. Open the **write** characteristic:

   `a1c15e00-6f10-4c9a-9c31-47b0c15e0003`

6. Paste the JSON as **UTF-8 text** (not hex) and send

The Pi accepts that JSON text. A native gpio-companion iOS app is planned later and will replace the extra BLE app.

If copy failed, use **Copy again** on `/wifi`. If the timestamp is older than about a minute, sign again (replay protection).

## If Bluetooth is missing

- Orange Pi without a radio: use Ethernet or a USB WiFi dongle + TTY `nmcli`
- Host may disable BLE with `GPIO_COMPANION_BLE=0`
- HDMI/serial first-setup remains valid
