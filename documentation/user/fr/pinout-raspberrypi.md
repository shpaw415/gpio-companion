# Brochage GPIO Raspberry Pi

La logique est **3,3 V**. N’injectez pas 5 V dans un GPIO. Ne court-circuitez pas 3V3 vers 5V.

Les numéros de broches sont **physiques** (les emplacements de l’en-tête que vous voyez). gpio-companion pilote les broches par ces numéros. BCM n’est qu’une étiquette.

Orientez la carte avec l’en-tête 40 broches à droite (USB/Ethernet généralement vers vous sur un Pi 4/5). La broche 1 est 3V3, en haut à gauche de l’en-tête.

## Sécurité

- Commencez une LED sur la broche physique **11** ou **7** avec une résistance série vers GND (broche 6 ou 9).
- N’utilisez pas les broches **27** et **28** — ce sont l’EEPROM HAT.
- Les broches **8** et **10** sont UART TX/RX — souvent la console série ; évitez-les pour les projets.
- Le 5 V est sur les broches 2 et 4 — ne le câblez jamais dans un GPIO.

## En-tête 40 broches

```
 3V3  (1)  (2)  5V
SDA   (3)  (4)  5V
SCL   (5)  (6)  GND
GPIO4 (7)  (8)  TXD
 GND  (9) (10)  RXD
GPIO17(11) (12) GPIO18
GPIO27(13) (14) GND
GPIO22(15) (16) GPIO23
 3V3 (17) (18) GPIO24
MOSI (19) (20) GND
MISO (21) (22) GPIO25
SCLK (23) (24) CE0
 GND (25) (26) CE1
ID_SD(27) (28) ID_SC
GPIO5(29) (30) GND
GPIO6(31) (32) GPIO12
GPIO13(33) (34) GND
GPIO19(35) (36) GPIO16
GPIO26(37) (38) GPIO20
 GND (39) (40) GPIO21
```

| Physique | Nom | Notes |
| ---: | --- | --- |
| 1 | 3V3 | Alimentation |
| 2 | 5V | Alimentation — jamais dans un GPIO |
| 3 | GPIO2 | I2C SDA (BCM 2) |
| 4 | 5V | Alimentation — jamais dans un GPIO |
| 5 | GPIO3 | I2C SCL (BCM 3) |
| 6 | GND | Masse |
| 7 | GPIO4 | GPIO (BCM 4) — bon premier cavalier |
| 8 | GPIO14 | UART TX (BCM 14) — souvent console ; éviter |
| 9 | GND | Masse |
| 10 | GPIO15 | UART RX (BCM 15) — souvent console ; éviter |
| 11 | GPIO17 | GPIO (BCM 17) — bonne première LED |
| 12 | GPIO18 | GPIO / PWM (BCM 18) |
| 13 | GPIO27 | GPIO (BCM 27) |
| 14 | GND | Masse |
| 15 | GPIO22 | GPIO (BCM 22) |
| 16 | GPIO23 | GPIO (BCM 23) |
| 17 | 3V3 | Alimentation |
| 18 | GPIO24 | GPIO (BCM 24) |
| 19 | GPIO10 | SPI MOSI (BCM 10) |
| 20 | GND | Masse |
| 21 | GPIO9 | SPI MISO (BCM 9) |
| 22 | GPIO25 | GPIO (BCM 25) |
| 23 | GPIO11 | SPI SCLK (BCM 11) |
| 24 | GPIO8 | SPI CE0 (BCM 8) |
| 25 | GND | Masse |
| 26 | GPIO7 | SPI CE1 (BCM 7) |
| 27 | GPIO0 | EEPROM HAT — ne pas utiliser |
| 28 | GPIO1 | EEPROM HAT — ne pas utiliser |
| 29 | GPIO5 | GPIO (BCM 5) |
| 30 | GND | Masse |
| 31 | GPIO6 | GPIO (BCM 6) |
| 32 | GPIO12 | GPIO / PWM (BCM 12) |
| 33 | GPIO13 | GPIO / PWM (BCM 13) |
| 34 | GND | Masse |
| 35 | GPIO19 | GPIO / PWM (BCM 19) |
| 36 | GPIO16 | GPIO (BCM 16) |
| 37 | GPIO26 | GPIO (BCM 26) |
| 38 | GPIO20 | GPIO (BCM 20) |
| 39 | GND | Masse |
| 40 | GPIO21 | GPIO (BCM 21) |

GND : 6, 9, 14, 20, 25, 30, 34, 39. 3V3 : 1, 17. 5V : 2, 4.

I2C : 3/5. SPI : 19/21/23/24/26. Emplacements PWM matériel : 12, 32, 33. Le PWM logiciel compagnon et la tonalité fonctionnent sur n’importe quel GPIO.

Sur Projet, GPIO en direct affiche cet en-tête. Touchez une broche pour la commander.

## Pour l’agent sur la carte

Charger lorsque `/etc/gpio-companion/config.json` a `"hardware": "raspberrypi"`, ou que `/proc/device-tree/model` contient Raspberry Pi.

1. `GET http://127.0.0.1:4150/v1/gpio` d’abord — cet instantané est la carte live (physique, nom, dir, valeur, PWM).
2. **C d’abord :** `GET /v1/arduino-proxy` d’abord. Si connecté, compétence `gpio-arduino-proxy` (broches Arduino, `host/arduino-proxy-<name>/`) — pas cet en-tête. Sinon pilotez le GPIO d’en-tête avec un croquis C (compétence `gpio-host`, broches **physiques**). Jamais BCM dans le corps. Clignotement/PWM/tonalité/boucles vont à `POST /v1/run`. `PUT /v1/gpio` seulement pour un test ponctuel demandé par l’utilisateur : `{ "physical": 11, "dir": "out", "value": 1 }`. analogWrite/tone en C, ou compétence `gpio-pwm` pour un test. Breadboard : `gpio-breadboard`.
3. Fiches techniques : **broche physique + nom** pour que l’utilisateur voie l’en-tête. Poussez `technical/` et `breadboard/diagram.json`.
4. Refusez alimentation, GND, et physiques 27–28. Ne pas `gpioset`.
