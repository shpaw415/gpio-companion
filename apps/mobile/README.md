# gpio-companion mobile

BLE-first companion. GitHub login uses the OpenAuthster iOS/Android SDKs (`modules/openauthster`). Pair and WiFi talk to `https://gpio-companion.com/api/mobile/*` with a Bearer token; the dashboard still signs Pi envelopes.

Project, GitHub App Keys, and credits stay on the web dashboard.

```sh
cd apps/mobile
bun install
npx expo prebuild
npx expo run:ios
# or
npx expo run:android
```

Register an OpenAuthster **public** client (`clientType: "public"`) with redirect `gpio-companion://auth/callback` and GitHub enabled. Set `app.json` `extra.issuerUrl` / `authClientId` to that project.

Needs a dev build (not Expo Go): Bluetooth + native OpenAuthster modules.

Windows / Linux / macOS: `apps/desktop` (Tauri). Same `/api/mobile/*` API and GATT protocol.
