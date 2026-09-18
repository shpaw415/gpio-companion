# WiFi et Bluetooth

Le Bluetooth permet à un téléphone ou un ordinateur proche d’associer la carte et de lui envoyer les informations WiFi avant qu’elle soit en ligne.

L’appareil Bluetooth s’appelle **gpio-companion**.

## Avant de commencer

- Gardez la carte alimentée et à proximité.
- Activez le Bluetooth du téléphone ou de l’ordinateur.
- Autorisez le Bluetooth et les appareils à proximité lorsque l’application le demande.
- Fermez LightBlue, nRF Connect, `bluetoothctl` ou toute autre application déjà connectée à la carte.

Une seule application peut généralement utiliser la connexion Bluetooth de la carte à la fois.

## Application de bureau ou mobile

C’est l’option la plus simple sur Windows, Linux, macOS, iPhone et Android.

1. Ouvrez **Appareils → WiFi**.
2. Choisissez votre carte associée.
3. Sélectionnez un réseau enregistré ou **Saisir manuellement**.
4. Saisissez le nom du réseau et le mot de passe.
5. Choisissez **Envoyer à la carte**, puis **gpio-companion** si nécessaire.
6. Attendez le message de connexion.

L’application de bureau peut proposer les réseaux enregistrés sur l’ordinateur. L’application mobile mémorise les réseaux déjà envoyés, mais iPhone et Android ne donnent pas accès aux mots de passe enregistrés par le système.

## Chrome ou Edge

Web Bluetooth fonctionne dans les versions compatibles de Chrome ou Edge sur ordinateur et Android.

1. Ouvrez **Appareils → WiFi** dans le tableau de bord.
2. Sélectionnez la carte et saisissez les informations WiFi.
3. Choisissez **Connecter en Bluetooth**.
4. Sélectionnez **gpio-companion** dans la fenêtre du navigateur.
5. Gardez la page ouverte jusqu’au message de réussite.

Le navigateur utilise le Bluetooth de l’appareil sur lequel il s’exécute. Android peut demander l’autorisation de localisation ou d’accès aux appareils à proximité.

Safari, Firefox et les navigateurs sur iPhone ne proposent pas Web Bluetooth pour cette page. Utilisez l’application mobile gpio-companion ou la solution ci-dessous.

## Solution iPhone avec LightBlue ou nRF Connect

Utilisez-la seulement si l’application mobile gpio-companion n’est pas disponible.

1. Dans le tableau de bord, ouvrez **Appareils → WiFi** et saisissez les informations du réseau.
2. Choisissez **Signer et copier**.
3. Ouvrez [LightBlue](https://apps.apple.com/app/lightblue/id557428110) ou [nRF Connect](https://apps.apple.com/app/nrf-connect-for-mobile/id1054366564).
4. Recherchez **gpio-companion** et connectez-vous.
5. Ouvrez la caractéristique d’écriture indiquée par le tableau de bord.
6. Collez le message en **texte UTF-8**, et non en hexadécimal, puis envoyez-le.
7. Lisez la caractéristique d’état pour vérifier la connexion.

Le message copié expire rapidement par sécurité. Après une attente, revenez au tableau de bord et choisissez de nouveau **Signer et copier**.

## Ethernet et console

Ethernet ne nécessite aucun réglage Bluetooth : branchez le câble et attendez que la carte apparaisse en ligne.

Si la carte ne possède pas de Bluetooth fonctionnel, utilisez Ethernet ou branchez un écran ou une console série pour configurer le réseau localement. Demandez de l’aide à la personne qui a préparé l’image si la console ne vous est pas familière.

## Résoudre les problèmes courants

| Problème | À essayer |
| --- | --- |
| La carte n’apparaît pas en Bluetooth | Rapprochez-vous, redémarrez le Bluetooth et vérifiez qu’aucune autre application n’est connectée |
| Le navigateur ne propose pas Bluetooth | Utilisez Chrome, Edge ou l’application native |
| Android ne trouve rien | Autorisez la localisation et les appareils à proximité, puis recommencez |
| Le mot de passe est refusé | Saisissez-le à nouveau ; les majuscules et minuscules comptent |
| Le réseau est introuvable | Vérifiez son nom exact et rapprochez la carte du point d’accès |
| La carte est connectée mais reste hors ligne | Attendez une minute, actualisez Appareils et vérifiez l’accès à Internet |
| Le Bluetooth n’est jamais disponible | Utilisez Ethernet ; certains Orange Pi ont besoin d’un adaptateur USB Bluetooth ou WiFi |

N’ajoutez jamais un mot de passe WiFi, une clé d’association ou un message signé copié dans un projet GitHub ou une capture d’écran de discussion.
