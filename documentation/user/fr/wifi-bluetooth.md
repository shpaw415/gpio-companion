# WiFi en Bluetooth (utilisateur)

Le tableau de bord **signe** chaque commande WiFi avec la clé privée gpio-companion et un horodatage (fenêtre de rejeu 60 secondes). Le Pi vérifie la signature et que l’UUID d’association dans la commande correspond à **cette** carte. Les écritures BLE non signées ne font rien d’utile.

Une carte neuve sans RTC (Orange Pi typique) a souvent une horloge très en retard sur Cloudflare. Tant qu’elle est hors ligne (NTP non synchronisé), le Pi accepte chaque commande BLE signée **une fois** (`X-Gpio-Nonce`) et n’utilise pas la fenêtre de 60 secondes. La première commande valide peut aussi régler l’horloge. Après NTP (ou ce réglage d’horloge) la fenêtre de 60 secondes s’applique ; un nonce réutilisé est toujours refusé.

Vous devez être **connecté**, et la carte doit déjà être **associée** à votre compte. Choisissez-la dans le menu des appareils associés. Le tableau de bord ne signera pas une commande WiFi pour un autre UUID.

Nom Bluetooth : **gpio-companion**.

## Chrome ou Edge (bureau / Android)

1. Associez la carte sur `/devices/pair` si ce n’est pas déjà fait
2. Ouvrez `/devices/wifi`
3. Sélectionnez l’appareil associé, puis un réseau connu ou saisissez le SSID et le mot de passe
4. **Connecter en Bluetooth** et choisissez `gpio-companion`
5. Attendez que l’état indique connecté

Safari, Firefox et Chrome/Safari iOS **ne peuvent pas** utiliser le Web Bluetooth sur cette page. Utilisez plutôt les applications natives : `apps/mobile` (iOS/Android) ou `apps/desktop` (Windows/Linux/macOS).

Le sélecteur Chrome utilise le Bluetooth de **cet ordinateur** (pas celui du Pi). Quittez `bluetoothctl` d’abord. Chrome Android a besoin de la localisation autorisée pour les scans BLE. nRF Connect peut voir la carte même si le sélecteur du tableau de bord est vide si l’annonce n’a pas d’UUID de service.

## Bureau natif (Windows / Linux / macOS)

L’application Tauri dans `apps/desktop` se connecte avec GitHub, puis associe et envoie le WiFi en Bluetooth natif (pas Web Bluetooth).

Sur **WiFi**, choisissez un **Réseau enregistré** pour remplir automatiquement le SSID et le mot de passe :

- **Bureau :** profils WiFi enregistrés de cet ordinateur (mot de passe si l’OS le permet) plus les réseaux déjà envoyés depuis l’application. Le réseau actuel est marqué *(cet ordinateur)*.
- **Mobile :** réseaux déjà envoyés depuis cette application (iOS/Android ne peuvent pas lire les mots de passe WiFi de l’OS).

Si le réseau n’est pas listé, choisissez **Saisir manuellement** et tapez le SSID et le mot de passe. Les champs restent modifiables après un remplissage. Les envois réussis sont mémorisés sur cet appareil seulement (pas téléversés). La déconnexion ne les efface pas.

```sh
cd apps/desktop
bun install
bun run tauri:dev
```

Linux : installez les dépendances de compilation WebKitGTK/GTK (voir `apps/desktop/README.md`) et rejoignez le groupe `bluetooth`. Quittez `bluetoothctl` pendant le scan.

## Contournement iOS (en attendant l’application native)

Safari ne peut pas parler au Pi depuis le site. Utilisez signer-et-copier :

1. Sur `/devices/wifi` choisissez l’appareil associé, puis remplissez le SSID et le mot de passe WiFi
2. **Signer et copier** — le JSON signé s’affiche dans un bloc de copie (et est copié dans le presse-papiers)
3. Installez [LightBlue](https://apps.apple.com/app/lightblue/id557428110) ou [nRF Connect](https://apps.apple.com/app/nrf-connect-for-mobile/id1054366564)
4. Scannez et connectez-vous à **gpio-companion** (copiez le nom Bluetooth depuis la page)
5. Ouvrez la caractéristique d’**écriture** (copiez-la depuis la page)
6. Collez le JSON en **texte UTF-8** (pas hex) et envoyez
7. Lisez la caractéristique d’**état** — `{ "connected": true, "ssid": "…" }` en succès, ou `{ "error": "…", "reason": "ssid-not-found"|"password"|"no-device"|"failed" }` en échec

Le Pi accepte ce texte JSON. Préférez `apps/mobile` (iOS/Android) ou `apps/desktop` (Windows/Linux/macOS) plutôt qu’une application BLE tierce.

Si la copie a échoué, utilisez **Copier dans le presse-papiers** sur `/devices/wifi`. Si l’horodatage a plus d’environ une minute, signez à nouveau (protection contre le rejeu). Le premier collage réussi peut aussi régler l’horloge de la carte.

## Si le Bluetooth manque

- Orange Pi sans radio : utilisez Ethernet ou une clé WiFi USB + TTY `nmcli`
- L’hôte peut désactiver le BLE avec `GPIO_COMPANION_BLE=0`
- Le first-setup HDMI/série reste valable
