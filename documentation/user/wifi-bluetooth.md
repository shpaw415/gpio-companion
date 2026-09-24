# WiFi and Bluetooth

Bluetooth gives a nearby phone or computer a private way to pair a board and send WiFi details before the board is online.

The Bluetooth device is named **gpio-companion**.

## Before you begin

- Keep the board powered and nearby.
- Turn on Bluetooth for your phone or computer.
- Allow Bluetooth and nearby-device permissions when asked.
- Close LightBlue, nRF Connect, `bluetoothctl`, or any other app already connected to the board.

Only one app can usually use the board's Bluetooth connection at a time.

## Native desktop or mobile app

This is the simplest option on Windows, Linux, macOS, iPhone, and Android.

1. Open **Devices → WiFi**.
2. Choose your paired board.
3. Pick a saved network or choose **Enter manually**.
4. Enter the network name and password.
5. Choose **Send to board** and select **gpio-companion** if prompted.
6. Wait for the connected message.

Desktop may offer WiFi networks saved on that computer. Mobile remembers networks previously sent from the app, but iPhone and Android do not reveal passwords saved by the operating system.

To share this phone's connection, choose **Open hotspot settings** on the mobile WiFi screen. Android opens the system hotspot panel so you can turn it on; then send that hotspot name and password to the board over Bluetooth. iPhone cannot open Personal Hotspot from an app — use **Settings → Personal Hotspot**, then return and send the details.

## Chrome or Edge

Web Bluetooth works in supported versions of Chrome or Edge on desktop and Android.

1. Open **Devices → WiFi** in the dashboard.
2. Select your board and enter the WiFi details.
3. Choose **Connect over Bluetooth**.
4. Select **gpio-companion** in the browser chooser.
5. Keep the page open until it reports success.

The chooser uses the Bluetooth radio in the device running the browser. Android may require Location or Nearby devices permission before it can scan.

Safari, Firefox, and browsers on iPhone do not provide Web Bluetooth for this page. Use the gpio-companion mobile app or the fallback below.

## iPhone fallback with LightBlue or nRF Connect

Use this only when the native gpio-companion app is unavailable.

1. In the dashboard, open **Devices → WiFi** and fill in the network details.
2. Choose **Sign and copy**.
3. Open [LightBlue](https://apps.apple.com/app/lightblue/id557428110) or [nRF Connect](https://apps.apple.com/app/nrf-connect-for-mobile/id1054366564).
4. Scan for and connect to **gpio-companion**.
5. Open the write characteristic shown by the dashboard.
6. Paste the copied message as **UTF-8 text**, not hexadecimal, and send it.
7. Read the status characteristic to see whether the board connected.

The copied message expires quickly for safety. If it fails after waiting, return to the dashboard and choose **Sign and copy** again.

## Ethernet and console fallback

Ethernet needs no Bluetooth setup: connect the cable and wait for the board to appear online.

If the board has no working Bluetooth radio, use Ethernet or connect a display/serial console and configure networking locally. Ask the person who prepared the image for help if you are unfamiliar with the console.

## Fix common problems

| Problem | Try this |
| --- | --- |
| Board is not in the Bluetooth list | Move closer, restart Bluetooth, and make sure another app is not connected |
| Browser has no Bluetooth button | Use Chrome/Edge or the native app |
| Android finds nothing | Allow Location and Nearby devices, then scan again |
| Password is rejected | Re-enter it carefully; WiFi passwords are case-sensitive |
| Network is not found | Check the exact network name and move the board closer to the access point |
| Board connected but remains offline | Wait one minute, reload Devices, and verify the network has internet access |
| Bluetooth is never available | Use Ethernet; some Orange Pi models need a USB Bluetooth or WiFi adapter |

Do not put a WiFi password, pairing key, or copied signed message in a GitHub project or chat screenshot.
