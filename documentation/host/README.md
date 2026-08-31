# Host documentation

This tree is for **operators**: people who deploy gpio-companion cloud services, sign device commands, and ship Armbian images. Desk users (pairing a board, WiFi, GitHub, agent work) live in [`../user/`](../user/).

gpio-companion is still a raw product (`PRODUCT.md`). Do not treat unspecified choices as locked.

## Who you are

You run:

- The Cloudflare Pages dashboard (`apps/dashboard`, project `gpio-companion-dashboard`)
- Users host electronics projects on **their own GitHub** accounts (dashboard Keys PAT)
- Ed25519 device-signing keys (private key never in git or the browser)
- Armbian image / first-boot clone of this repo onto Orange Pi and Raspberry Pi boards

You do **not** sit at the GPIO bench. The on-device agent and the signed-in dashboard user do.

## Documents

| Doc | Contents |
| --- | --- |
| [deploy.md](./deploy.md) | Dashboard, auth, KV, device private key, GitHub PAT flow, local vs production |
| [device-image.md](./device-image.md) | Snapshot first-boot, per-hardware install, systemd, BLE GATT, device API |
| [workflows.md](./workflows.md) | Day-two ops: updates, key rotation, pairing support, secrets ownership |

## Trust model (host side)

```
Dashboard (Cloudflare, private Ed25519)
    signs METHOD + PATH + timestamp + nonce + body hash
        → HTTP (after the Pi has a URL) or BLE envelope (no WiFi yet)
Pi (bundled public key)
    verifies signature; pairing UUID/key still required on claim
```

- Unsigned on the Pi: `GET /health` only
- Private key: Cloudflare secret `GPIO_COMPANION_DEVICE_PRIVATE_KEY`
- Public key: `packages/core/src/device-public-key.ts` (key id `gpio-companion-v1`)
- Browser never holds the private key and never calls the Pi API directly for config
