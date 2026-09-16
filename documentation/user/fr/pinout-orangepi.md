# Brochage GPIO Orange Pi

La logique est **3,3 V**. N’injectez pas 5 V dans un GPIO. Ne court-circuitez pas 3V3 vers 5V.

Les numéros de broches sont **physiques** (les emplacements de l’en-tête que vous voyez). Ce **ne sont pas** des numéros BCM Raspberry Pi.

gpio-companion **Orange Pi 3 LTS** utilise un en-tête **26 broches**. Cette carte est ci-dessous. Autres modèles Orange Pi : voir [Autres cartes Orange Pi](#autres-cartes-orange-pi).

## Sécurité

- Commencez une LED sur la physique **7** avec une résistance série vers GND (broche 6 ou 9).
- N’utilisez pas les broches **8** et **10** pour les projets — elles sont souvent la console série.
- Cet en-tête 26 broches n’a **pas d’entrée analogique**. analogRead n’est pas disponible.
- PWM et tonalité (faire fondre une LED, piloter un buzzer) appartiennent à un croquis C (compétence `gpio-host`). `PUT /v1/gpio` / compétence `gpio-pwm` sont des tests ponctuels seulement.

## Orange Pi 3 LTS — en-tête 26 broches

Orientez la carte avec l’en-tête sur le bord. La broche 1 (3V3) est en haut à gauche. Il n’y a **pas de broches 27–40**.

```
 3V3  (1)  (2)  5V
SDA   (3)  (4)  5V
SCL   (5)  (6)  GND
GPIO  (7)  (8)  TXD
 GND  (9) (10)  RXD
GPIO (11) (12) GPIO
GPIO (13) (14) GND
GPIO (15) (16) GPIO
 3V3 (17) (18) GPIO
MOSI (19) (20) GND
MISO (21) (22) GPIO
SCLK (23) (24) CS
 GND (25) (26) GPIO
```

| Physique | Nom | Notes |
| ---: | --- | --- |
| 1 | 3V3 | Alimentation |
| 2 | 5V | Alimentation — jamais dans un GPIO |
| 3 | PD26 | I2C SDA (TWI0) |
| 4 | 5V | Alimentation — jamais dans un GPIO |
| 5 | PD25 | I2C SCL (TWI0) |
| 6 | GND | Masse |
| 7 | PD22 | GPIO — bonne première LED / cavalier |
| 8 | PL2 | UART TX — souvent la console série ; éviter |
| 9 | GND | Masse |
| 10 | PL3 | UART RX — souvent la console série ; éviter |
| 11 | PD24 | I2C SDA (TWI2) |
| 12 | PD18 | GPIO |
| 13 | PD23 | I2C SCL (TWI2) |
| 14 | GND | Masse |
| 15 | PL10 | GPIO |
| 16 | PD15 | GPIO |
| 17 | 3V3 | Alimentation |
| 18 | PD16 | GPIO |
| 19 | PH5 | SPI MOSI (partagé avec TWI1 SCL) |
| 20 | GND | Masse |
| 21 | PH6 | SPI MISO (partagé avec TWI1 SDA) |
| 22 | PD21 | GPIO |
| 23 | PH4 | SPI CLK |
| 24 | PH3 | SPI CS |
| 25 | GND | Masse |
| 26 | PL8 | GPIO |

GND : 6, 9, 14, 20, 25. 3V3 : 1, 17. 5V : 2, 4.

I2C : broches 3/5 et 11/13. SPI : 19/21/23/24. Bons cavaliers : **7, 12, 16, 18, 22**.

Sur Projet, GPIO en direct affiche ces noms sur l’en-tête. Touchez une broche pour la commander.

## Autres cartes Orange Pi

Sur les en-têtes 2×20 style Pi, **les emplacements d’alimentation et de masse physiques correspondent au Raspberry Pi**. Les fonctions GPIO non — n’utilisez jamais les numéros BCM.

Certains modèles sont **26 broches** (ou 26+13). Si la sérigraphie s’arrête à 26, ignorez les physiques 27–40.

Utilisez GPIO en direct sur Projet (ou demandez à l’agent sur la carte) pour la carte de *cette* carte. Les broches que le compagnon ne peut pas résoudre ne peuvent pas être commandées.

## Pour l’agent sur la carte

Charger lorsque `/etc/gpio-companion/config.json` a `"hardware": "orangepi"`, ou que `/proc/device-tree/model` contient Orange Pi.

1. `GET http://127.0.0.1:4150/v1/gpio` d’abord — cet instantané est la carte live (physique, nom, dir, valeur, PWM). Ne redécouvrez pas avec WiringOP ou `gpioset`.
2. **C d’abord :** `GET /v1/arduino-proxy` d’abord. Si connecté, compétence `gpio-arduino-proxy` (broches Arduino, `host/arduino-proxy-<name>/`) — pas cet en-tête. Sinon pilotez le GPIO d’en-tête avec un croquis C (compétence `gpio-host`, broches **physiques**). Jamais BCM. Clignotement/PWM/tonalité/boucles vont à `POST /v1/run`. `PUT /v1/gpio` seulement pour un test ponctuel demandé par l’utilisateur : `{ "physical": 7, "dir": "out", "value": 1 }`. analogWrite/tone en C, ou compétence `gpio-pwm` pour un test. Breadboard : `gpio-breadboard`.
3. Fiches techniques : **broche physique + nom** (broche 7 / PD22), jamais un numéro BCM Pi. Poussez `technical/` et `breadboard/diagram.json`.
4. Refusez alimentation, GND, et broches `unresolved`. Sur 3 LTS ignorez 27–40. analogRead seulement si l’instantané a `adc` (l’en-tête 3 LTS n’en a pas).
5. Cartes de la famille sans carte SKU : ne pilotez que les broches que l’instantané ne marque pas unresolved.
