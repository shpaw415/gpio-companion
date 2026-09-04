# Removable storage (SD / USB)

Plug an SD card or USB stick into the board. gpio-companion mounts it and puts a shortcut in the T3 Code user home:

`~/storage/<label>`

Open that folder in T3 Code to add or manage projects. You do not need to browse `/media` or create the link yourself.

`<label>` is the volume name when it has one, otherwise `USB-…` or `SD-…`. A second disk with the same name becomes `<label>-2`.

Unplug the card or stick: the mount goes away and that symlink is removed. `~/storage` stays.

## What is not linked

The disk the OS already boots from is never mounted this way:

- Raspberry Pi: the boot SD
- Orange Pi: internal eMMC

Only extra removable media is linked.

## Filesystems

FAT / exFAT / NTFS / ext4 are mounted when the tools are on the image. Leave the card in while T3 has files open on it.
