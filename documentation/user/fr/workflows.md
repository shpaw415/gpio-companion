# Flux utilisateur

## Quotidien : travailler avec l’agent sur la carte

Ouvrez T3 Code (tunneled) ou OpenCode sur le Pi. L’agent charge :

- `opencode/preferences` — il contrôle ce système GPIO
- `opencode/skills` — y compris `gpio-pinout-raspberrypi` ou `gpio-pinout-orangepi` depuis `/etc/gpio-companion/config.json`

Sur Raspberry Pi, utilisez les numéros de broches **physiques** (les emplacements de l’en-tête). gpio-companion pilote ces numéros ; BCM n’est qu’une étiquette. Logique 3,3 V seulement. Évitez les broches EEPROM ID 27–28 pour le GPIO général.

Sur Orange Pi, **les numéros GPIO SoC ne sont pas BCM**. Orange Pi 3 LTS est un en-tête **26 broches** (ignorez 27–40). Parlez en numéros physiques.

Les cartes SD et clés USB supplémentaires apparaissent sous `~/storage/<label>` dans le home utilisateur T3. Ouvrez ce dossier pour les projets sur la clé ; voir [storage.md](./storage.md).

Le micrologiciel Arduino est du **C**, gravé en USB via `http://127.0.0.1:4150/v1/flash` (dossier de croquis absolu avec `.c` ou `.ino`). Projet peut lancer le même travail via l’API web ou Bluetooth. Appareils peut **Graver Arduino comme proxy** pour que la carte USB devienne un esclave Firmata : GPIO en direct sur Projet bascule Compagnon | Arduino, Exécuter sur la carte peut lancer des croquis `arduino-proxy-*` qui commandent les broches MCU depuis le compagnon, et les cartes breadboard peuvent inclure un en-tête `gpio-arduino-proxy` (Uno/Mega/Nano/…) à côté de l’en-tête compagnon.

L’agent sur la carte vérifie `GET /v1/arduino-proxy` avant un clignotement ou un breadboard. Si le proxy Arduino USB est connecté, il écrit du C `host/arduino-proxy-*` (numéros de broches Arduino) et une pièce `gpio-arduino-proxy` dans `breadboard/diagram.json` (compétence `gpio-arduino-proxy`). Sinon il pilote l’en-tête de cette carte en C (`POST /v1/run`, compétence `gpio-host`) — pas de PUT GPIO direct sauf tests ponctuels. Les broches d’en-tête sont des numéros physiques. Vous démarrez et arrêtez ce travail sur Projet **Exécuter sur la carte** en choisissant un nom de croquis (pas en curlant le Pi ni en tapant un chemin). `Serial.print` de ce croquis s’affiche en direct sur le même panneau. Après **Graver Arduino**, le `Serial` USB s’affiche sur ce panneau (Ouvrir le série si vous devez attacher sans graver).

## Les projets vivent dans GitHub

Un dépôt git par projet électronique. Le tableau de bord ne liste que les dépôts avec un fichier `.gpio-companion` à la racine. Créez un projet depuis le tableau de bord, ou demandez à Code sur la carte — les nouveaux dépôts doivent inclure ce filigrane.

La carte clone ces dépôts dans `~/projects/<name>` et les ajoute à T3 Code. Si la carte est en ligne quand vous créez un projet, c’est immédiat. Si elle est hors ligne, rien n’est mis en file — le clone s’exécute au prochain démarrage de gpio-companion (et toutes les 15 minutes tant qu’il tourne). Les dossiers existants sont laissés tels quels.

Pendant qu’une fonctionnalité PCB, breadboard, fiche technique ou croquis C est en cours, l’agent **pousse une branche de fonctionnalité** (`feat/<kebab>`), puis demande si vous voulez **enregistrer** (fusionner dans `main`). Il fusionne `main` seulement si vous dites oui :

| Dossier | Fichiers attendus |
| --- | --- |
| `pcb/` | `circuit.json`, `preview.svg` si possible |
| `breadboard/` | `diagram.json` (carte Wokwi), `preview.svg` facultatif |
| `technical/` | fiches |
| `host/<name>/` | C gpio-host (`.c` / `.ino`) exécuté sur l’en-tête de cette carte |
| `host/arduino-proxy-<name>/` | C gpio-arduino-proxy quand le proxy Arduino USB est connecté |
| `firmware/<name>/` | C Arduino USB gravé en USB |

Le tableau de bord `/project` lit les chemins visuels depuis GitHub, par défaut la branche au commit le plus récent (visionneuse PCB pour `pcb/circuit.json` / `pcb/preview.svg`, visionneuse breadboard pour `breadboard/diagram.json`). Un sélecteur de branche change ce checkout. Les croquis hôte/micrologiciel sont listés depuis la carte sélectionnée. Le lancement utilise la copie de la carte, pas un chemin Pi saisi. Projet **Enregistrer sur GitHub** valide et pousse le clone `~/projects/<name>` sur la branche extraite (pas une fusion vers `main`), puis recharge la branche au commit le plus récent. Demandez à l’agent sur la carte d’enregistrer quand vous voulez fusionner la branche de fonctionnalité dans `main`.

## Changer le WiFi plus tard

Toujours connecté `/devices/wifi`, à tout moment — choisissez l’appareil associé dans le menu, puis le même flux Bluetooth Chrome ou collage iOS. Le tableau de bord ne signera pas un UUID qui n’est pas associé à votre compte.

## Changer GitHub plus tard

Profil → GitHub (`/profile/github`) → Connecter GitHub (installer l’application GitHub gpio-companion). Les cartes associées créent un jeton à chaque git push ; vous ne collez pas de PAT. Si une carte a été hors ligne plus d’une heure, poussez à nouveau une fois qu’elle a Internet. `/devices/keys` redirige toujours là.

## Mises à jour de la carte

Vous ne faites pas de git-pull à la main sauf si vous le voulez. `gpio-companion-update.timer` tire `main` (ou `/etc/gpio-companion/branch`) au démarrage et toutes les 24 h, rafraîchit compétences/préférences, et redémarre l’API appareil quand l’arbre serveur a changé.

`gpio-companion-cleanup.timer` s’exécute au démarrage et toutes les heures. Les journaux restent 24 heures puis sont compactés ; les fichiers apt/tmp/cache restants sont nettoyés pour que les cartes eMMC 8 Go ne se remplissent pas. Journald ne transmet pas à rsyslog. Appareils → Débogage montre l’espace disque libre et peut charger un extrait de journal des 24 dernières heures caviardé (pas un dump complet).

## GPIO

L’agent sur la carte pilote l’en-tête de cette carte avec des croquis C (`POST /v1/run`, compétence `gpio-host`) sauf si un proxy Arduino USB est connecté — alors `host/arduino-proxy-*` et compétence `gpio-arduino-proxy`. Le `PUT /v1/gpio` direct est pour les tests ponctuels seulement. L’en-tête GPIO en direct de la page Projet du tableau de bord peut encore piloter la même carte (Compagnon | Arduino quand un proxy est actif). Alimentation/GND et broches Raspberry Pi 27–28 sont refusées. Orange Pi 3 LTS utilise la carte 26 broches ; les autres modèles Orange Pi ne pilotent que les broches que le compagnon peut résoudre.

Gravez l’Arduino USB depuis Projet **Graver Arduino** (nom de croquis depuis `firmware/` sur la carte). Une seconde gravure pendant qu’une tourne renvoie 409.

Exécutez du C sur le GPIO compagnon depuis Projet **Exécuter sur la carte** (nom de croquis depuis `host/` sur la carte). Une seconde exécution pendant qu’une tourne renvoie 409.

Projet **Vérifier le circuit** pulse les cavaliers depuis `breadboard/diagram.json` sur la carte. Un overlay vert/rouge (ou une liste de puces sur mobile) montre réussite/échec. Un filet LED isolé reste inconnu — cet en-tête n’a pas d’ADC. Vérifier et Exécuter ne peuvent pas tourner en même temps.

## Sécurité

- N’injectez pas 5 V dans un GPIO
- Ne court-circuitez pas 3V3 vers 5V
- L’agent peut piloter les broches et l’USB ; restez au banc pour le matériel d’alimentation
- La clé d’association et le jeton GitHub sont des secrets ; ne les validez pas
