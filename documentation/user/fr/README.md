# Documentation utilisateur

Cette arborescence s’adresse à la personne au bureau : Orange Pi ou Raspberry Pi sur le banc, tableau de bord dans le navigateur (ou le compagnon BLE natif), agent IA sur la carte. Opérateurs qui déploient Cloudflare et les images : [`../host/`](../host/).

## Documents

| Doc | Contenu |
| --- | --- |
| [getting-started.md](./getting-started.md) | Mise sous tension → WiFi → connexion → association → GitHub |
| [wifi-bluetooth.md](./wifi-bluetooth.md) | Bluetooth Chrome, applications natives iOS/Android/bureau, et collage iOS LightBlue / nRF Connect |
| [workflows.md](./workflows.md) | Travail quotidien avec l’agent, projets, dossiers PCB/breadboard, Arduino C |
| [storage.md](./storage.md) | SD / USB supplémentaires apparaissent dans T3 sous `~/storage/<label>` |

## Ce que vous avez

- Une carte GPIO qui exécute gpio-companion (Armbian, OpenCode, T3 Code)
- Un compte GitHub (la connexion au tableau de bord est GitHub uniquement ; l’association n’en crée pas)

L’agent sur le Pi possède le système, les broches et l’USB. Vous le pilotez depuis T3 Code / OpenCode et depuis le tableau de bord.
