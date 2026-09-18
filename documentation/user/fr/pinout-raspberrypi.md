# Brochage GPIO Raspberry Pi

Utilisez ce plan chaque fois qu’un circuit se branche sur le connecteur du Raspberry Pi. Inutile de le mémoriser : trouvez le numéro physique, vérifiez son rôle et câblez hors tension.

## Les deux règles à retenir

1. Le GPIO utilise une logique **3,3 V**. N’envoyez jamais 5 V dans un GPIO et ne reliez jamais directement 3,3 V au 5 V.
2. gpio-companion utilise les **numéros de broches physiques**, c’est-à-dire les trous numérotés visibles. Le numéro BCM est seulement un autre nom du signal.

## Trouver la broche 1

Sur un Raspberry Pi 4 ou 5, placez le connecteur 40 broches à droite et les prises USB/Ethernet vers vous. La **broche 1** se trouve en haut à gauche du connecteur et fournit 3,3 V.

Les numéros physiques impairs descendent d’un côté et les pairs de l’autre. Vérifiez toujours l’orientation avant de compter.

## Sécurité

- Commencez une LED sur la broche physique **11** ou **7**, avec une résistance de **220 Ω à 1 kΩ** en série vers GND (broche 6 ou 9).
- N’utilisez pas les broches **27** et **28** — ce sont l’EEPROM HAT.
- Les broches **8** et **10** sont UART TX/RX — souvent la console série ; évitez-les pour les projets.
- Le 5 V est sur les broches 2 et 4 — ne le câblez jamais dans un GPIO.

## Essayez votre première LED

Carte hors tension :

1. Reliez la broche physique **11** à une résistance.
2. Reliez la résistance à la longue patte de la LED.
3. Reliez la courte patte de la LED à GND sur la broche physique **9**.
4. Comparez le montage au schéma de breadboard fourni par l’agent.
5. Rétablissez l’alimentation et utilisez **Exécuter sur la carte** pour démarrer le clignotement.

Si la LED ne s’allume pas, coupez l’alimentation et retournez-la. Une LED ne laisse passer le courant que dans un sens.

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

## Usages courants

- **Entrée ou sortie numérique ordinaire :** commencez par 7, 11, 13, 15, 16, 18, 22, 29, 31, 36, 37, 38 ou 40.
- **Capteurs et écrans I2C :** broches 3 et 5.
- **Périphériques SPI :** broches 19, 21, 23, 24 et parfois 26.
- **PWM matériel :** les broches 12, 32 et 33 sont pratiques.
- **Masse :** 6, 9, 14, 20, 25, 30, 34 ou 39.

Dans **Projet → Outils de la carte → GPIO en direct**, choisissez **Compagnon** pour afficher ce connecteur. Touchez un GPIO sûr pour ouvrir ses commandes de test temporaire. Utilisez **Exécuter sur la carte** pour un comportement durable.
