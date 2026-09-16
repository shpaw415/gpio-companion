# Démarrage (utilisateur)

Faites ceci dans l’ordre. Le jeton GitHub **n’est pas** saisi sur le Pi ; il vient du tableau de bord Profil → GitHub après l’association. OpenCode utilise les crédits du tableau de bord via un proxy gpio-companion local (aucune clé IA à coller).

## 1. Allumer la carte

HDMI/série si vous avez besoin de la console. Le premier démarrage clone le dépôt dans `/opt/gpio-companion` et lance first-setup (root, interactif).

Choisissez **raspberrypi** ou **orangepi**. Saisissez le jeton API Cloudflare de l’hôte, l’ID de compte et l’ID de zone pour que first-setup crée le tunnel de cette carte (`api-…` et `t3-…` sur gpio-companion.com).

**Notez** l’**UUID d’association** et la **clé d’association** imprimés, ou récupérez l’UUID, la clé et l’URL de l’appareil sur `/pair` en Bluetooth (Chrome) / collage LightBlue (iOS). Ils se trouvent aussi dans `/etc/gpio-companion/pairing.env` (root).

## 2. Réseau

Si le Pi a déjà de l’Ethernet, passez à la connexion.

S’il n’a pas encore de WiFi, associez d’abord en Bluetooth (étape 4), puis configurez le WiFi depuis **WiFi** (`/devices/wifi`) — voir [wifi-bluetooth.md](./wifi-bluetooth.md). Tant que la carte est hors ligne (horloge non synchronisée NTP), le Pi accepte une commande BLE signée une fois par nonce au lieu de la fenêtre de 60 secondes. Le tableau de bord ne signe le WiFi que pour une carte déjà associée à votre compte.

L’Ethernet et le TTY du Pi (`nmcli`) fonctionnent toujours.

## 3. Connexion

Assistant du tableau de bord `/` : **Connexion → Associer une carte → GitHub → Prêt**.

Utilisez `/login`. Continuez avec GitHub ; vous arrivez sur `/callback` puis l’accueil.

## 4. Associer la carte

Page `/devices` (ou étape 2 de l’assistant). Vous pouvez associer plusieurs cartes.

| Champ | Provenance |
| --- | --- |
| URL de l’appareil | Bluetooth (`apiHostname` de first-setup) ou `https://api-<uuid>.gpio-companion.com` |
| UUID d’association | Bluetooth ou impression first-setup |
| Clé d’association | Bluetooth ou impression first-setup |

Dans l’aperçu Appareils vous pouvez poser un **libellé** facultatif sur une carte associée à tout moment (nommez-la pour le banc). Il sert seulement à la reconnaissance dans le tableau de bord.

Le tableau de bord **signe** la réclamation, puis **Associer T3** (aussi dans l’aperçu Appareils pour une carte déjà réclamée). Cela lance `t3 pair` contre le service installé à first-setup et affiche un code, un QR et l’URL de la carte (`https://t3-…/pair#token=…`). Scannez ou ouvrez-la pour terminer l’association T3. Si cette carte appartient déjà à quelqu’un, attendez qu’il **Accepte** sur `/notifications` (le propriétaire change ; sa session T3 Code est révoquée). Un propriétaire actif par carte.

## 5. GitHub

1. Utilisez **votre** compte GitHub (créez-en un si besoin)
2. Tableau de bord **Profil → GitHub** : **Connecter GitHub** et installez l’application GitHub gpio-companion sur votre compte (tous les dépôts ou une sélection)
3. Les cartes associées créent un jeton frais à chaque `git push`. Vous ne collez pas de PAT. Si la carte a été hors ligne plus d’une heure, poussez à nouveau une fois qu’elle a Internet — ne rouvrez pas GitHub.

OpenCode utilise `/profile/credits` (solde USD facturé à partir des jetons Workers AI), pas un jeton GitHub. Achetez des packs 5 $ / 10 $ / 25 $ / 50 $ avec PayPal sur cette page (bureau/mobile ouvrent la même URL du tableau de bord). `gpio-companion github-token` affiche un jeton live pour les appels API.

## 6. Projet

L’accueil du tableau de bord est **Projet** (`/project` ; bureau et mobile s’ouvrent aussi ici). Créez d’abord un projet. Une carte en ligne le clone dans `~/projects/<name>` et l’ajoute dans T3 Code. Après la création, **Ouvrir Code** (Appareils → Code) est l’étape suivante pour discuter avec l’agent. GPIO en direct, Gravure, Exécution et Vérification restent sous **Outils de la carte** jusqu’à ce qu’un projet soit ouvert.

L’association T3 Code est **Associer T3** sur `/devices` (ou `/devices/pair`) : scannez le QR ou ouvrez l’URL d’association de la carte avec le code.

## Si quelque chose échoue

- `device 401` / signature manquante : secret de signature de l’hôte non défini, ou image trop ancienne
- `pairing uuid mismatch` / `pairing key mismatch` : mauvaise impression ou mauvaise carte
- `already paired` : un autre utilisateur du tableau de bord a réclamé cet UUID
- `pair a device first` sur GitHub : terminez d’abord l’association sur `/devices`
- Contrôle de santé seulement : `http://<pi>:4150/health` est public ; tout le reste est signé
