# Stockage amovible (SD / USB)

Branchez une carte SD ou une clé USB dans la carte. gpio-companion la monte et place un raccourci dans le home utilisateur T3 Code :

`~/storage/<label>`

Ouvrez ce dossier dans T3 Code pour ajouter ou gérer des projets. Vous n’avez pas besoin de parcourir `/media` ni de créer le lien vous-même.

`<label>` est le nom du volume s’il en a un, sinon `USB-…` ou `SD-…`. Un second disque du même nom devient `<label>-2`.

Débranchez la carte ou la clé : le montage disparaît et ce lien symbolique est retiré. `~/storage` reste.

## Ce qui n’est pas lié

Le disque depuis lequel le système démarre déjà n’est jamais monté ainsi :

- Raspberry Pi : la SD de démarrage
- Orange Pi : eMMC interne

Seuls les médias amovibles supplémentaires sont liés.

## Systèmes de fichiers

FAT / exFAT / NTFS / ext4 sont montés lorsque les outils sont sur l’image. Laissez la carte en place tant que T3 a des fichiers ouverts dessus.
