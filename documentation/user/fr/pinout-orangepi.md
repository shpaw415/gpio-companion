# Brochage GPIO Orange Pi

Utilisez ce plan chaque fois qu’un circuit se branche sur un Orange Pi. Les modèles diffèrent : vérifiez d’abord le modèle exact affiché dans **Appareils**.

## Les deux règles à retenir

1. Le GPIO utilise une logique **3,3 V**. N’envoyez jamais 5 V dans un GPIO et ne reliez jamais directement 3,3 V au 5 V.
2. gpio-companion utilise les **numéros de broches physiques**, c’est-à-dire les trous numérotés visibles. Les noms Orange Pi comme `PD22` ne sont pas des numéros BCM de Raspberry Pi.

Le gpio-companion **Orange Pi 3 LTS** possède un connecteur à **26 broches**. Son plan apparaît ci-dessous. Pour un autre modèle, lisez [Autres cartes Orange Pi](#autres-cartes-orange-pi) avant de câbler.

## Sécurité

- Commencez une LED sur la broche physique **7**, avec une résistance de **220 Ω à 1 kΩ** en série vers GND (broche 6 ou 9).
- N’utilisez pas les broches **8** et **10** pour les projets — elles sont souvent la console série.
- Cet en-tête 26 broches n’a **pas d’entrée analogique**. analogRead n’est pas disponible.

## Essayez votre première LED

Carte hors tension :

1. Reliez la broche physique **7** à une résistance.
2. Reliez la résistance à la longue patte de la LED.
3. Reliez la courte patte de la LED à GND sur la broche physique **9**.
4. Comparez le montage au schéma de breadboard fourni par l’agent.
5. Rétablissez l’alimentation et utilisez **Exécuter sur la carte** pour démarrer le clignotement.

Si la LED ne s’allume pas, coupez l’alimentation et retournez-la. Une LED ne laisse passer le courant que dans un sens.

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

## Usages courants

- **Entrée ou sortie numérique ordinaire :** commencez par 7, 12, 16, 18 ou 22.
- **Capteurs et écrans I2C :** broches 3/5 ou 11/13.
- **Périphériques SPI :** broches 19, 21, 23 et 24.
- **Masse :** 6, 9, 14, 20 ou 25.
- **Alimentation 3,3 V :** 1 ou 17. **Alimentation 5 V :** 2 ou 4 ; ne la reliez jamais à un GPIO.

Dans **Projet → Outils de la carte → GPIO en direct**, choisissez **Compagnon** pour afficher les noms détectés sur ce connecteur. Touchez un GPIO sûr pour ouvrir ses commandes de test temporaire. Utilisez **Exécuter sur la carte** pour un comportement durable comme le PWM ou une tonalité.

## Autres cartes Orange Pi

Sur les en-têtes 2×20 style Pi, **les emplacements d’alimentation et de masse physiques correspondent au Raspberry Pi**. Les fonctions GPIO non — n’utilisez jamais les numéros BCM.

Certains modèles sont **26 broches** (ou 26+13). Si la sérigraphie s’arrête à 26, ignorez les physiques 27–40.

Utilisez GPIO en direct dans Projet, ou demandez à l’agent, pour obtenir le plan de *votre* modèle. Une broche marquée comme non résolue ne peut pas être pilotée en sécurité.
