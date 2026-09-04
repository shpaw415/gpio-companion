#!/usr/bin/env bash
set -euo pipefail

CONFIG_DIR="${GPIO_COMPANION_CONFIG_DIR:-/etc/gpio-companion}"
MEDIA_ROOT="${GPIO_STORAGE_MEDIA_ROOT:-/media/gpio-companion}"
STATE_DIR="${GPIO_STORAGE_STATE_DIR:-/run/gpio-companion-storage}"
MOUNTS_FILE="${GPIO_STORAGE_MOUNTS_FILE:-/proc/mounts}"

storage_log() {
	echo "gpio-companion storage: $*" >&2
}

storage_user() {
	local line value
	if [[ -n "${GPIO_USER:-}" ]]; then
		printf '%s\n' "$GPIO_USER"
		return
	fi
	if [[ -f "$CONFIG_DIR/update.env" ]]; then
		line="$(grep -E '^GPIO_USER=' "$CONFIG_DIR/update.env" | tail -n1 || true)"
		value="${line#GPIO_USER=}"
		value="${value%\"}"
		value="${value#\"}"
		if [[ -n "$value" ]]; then
			printf '%s\n' "$value"
			return
		fi
	fi
	printf '%s\n' root
}

storage_home() {
	local user
	if [[ -n "${GPIO_STORAGE_HOME:-}" ]]; then
		printf '%s\n' "$GPIO_STORAGE_HOME"
		return
	fi
	user="$(storage_user)"
	if [[ "$user" == root ]]; then
		printf '%s\n' /root
		return
	fi
	getent passwd "$user" | cut -d: -f6
}

storage_parent() {
	local name="$1"
	if [[ "$name" =~ ^(mmcblk[0-9]+)p[0-9]+$ ]]; then
		printf '%s\n' "${BASH_REMATCH[1]}"
	elif [[ "$name" =~ ^(nvme[0-9]+n[0-9]+)p[0-9]+$ ]]; then
		printf '%s\n' "${BASH_REMATCH[1]}"
	elif [[ "$name" =~ ^(sd[a-z]+)[0-9]+$ ]]; then
		printf '%s\n' "${BASH_REMATCH[1]}"
	else
		printf '%s\n' "$name"
	fi
}

storage_dev_on_disk() {
	local parent="$1" dev="$2"
	if [[ "$dev" == "/dev/$parent" ]]; then
		return 0
	fi
	if [[ "$parent" == mmcblk* || "$parent" == nvme* ]]; then
		[[ "$dev" == /dev/${parent}p* ]]
		return
	fi
	[[ "$dev" == /dev/${parent}[0-9]* ]]
}

storage_is_ignored_kernel() {
	local kernel="$1"
	case "$kernel" in
	loop* | ram* | zram* | sr* | dm-* | *boot* | *rpmb*)
		return 0
		;;
	esac
	return 1
}

storage_is_system() {
	local kernel="$1"
	local parent dev mp rest
	if storage_is_ignored_kernel "$kernel"; then
		return 0
	fi
	parent="$(storage_parent "$kernel")"
	while read -r dev mp rest; do
		if storage_dev_on_disk "$parent" "$dev"; then
			case "$mp" in
			/ | /boot | /boot/firmware | /usr)
				return 0
				;;
			esac
		fi
	done <"$MOUNTS_FILE"
	return 1
}

storage_sanitize() {
	local raw="${1:-}"
	raw="$(printf '%s' "$raw" | tr -c 'A-Za-z0-9._-' '-' )"
	raw="$(printf '%s' "$raw" | sed -E 's/-+/-/g; s/^-+//; s/-+$//')"
	raw="${raw:0:40}"
	if [[ -z "$raw" ]]; then
		raw="disk"
	fi
	printf '%s\n' "$raw"
}

storage_blkid_value() {
	local key="$1" dev="$2"
	if [[ -n "${GPIO_STORAGE_SKIP_MOUNT:-}" ]]; then
		case "$key" in
		TYPE) printf '%s\n' "${GPIO_STORAGE_FS_TYPE:-vfat}" ;;
		LABEL) printf '%s\n' "${GPIO_STORAGE_LABEL:-}" ;;
		UUID) printf '%s\n' "${GPIO_STORAGE_UUID:-}" ;;
		esac
		return 0
	fi
	blkid -o value -s "$key" "$dev" 2>/dev/null || true
}

storage_wait_fs() {
	local dev="$1" i fstype
	if [[ -n "${GPIO_STORAGE_SKIP_MOUNT:-}" ]]; then
		storage_blkid_value TYPE "$dev"
		return 0
	fi
	for i in $(seq 1 15); do
		fstype="$(blkid -o value -s TYPE "$dev" 2>/dev/null || true)"
		if [[ -n "$fstype" ]]; then
			printf '%s\n' "$fstype"
			return 0
		fi
		sleep 0.2
	done
	return 1
}

storage_fallback_label() {
	local kernel="$1"
	local uuid prefix
	uuid="$(storage_blkid_value UUID "/dev/$kernel")"
	uuid="${uuid//-/}"
	if [[ ${#uuid} -gt 8 ]]; then
		uuid="${uuid: -8}"
	fi
	if [[ "$kernel" == mmcblk* ]]; then
		prefix="SD"
	else
		prefix="USB"
	fi
	if [[ -n "$uuid" ]]; then
		storage_sanitize "${prefix}-${uuid}"
	else
		storage_sanitize "${prefix}-${kernel}"
	fi
}

storage_unique_label() {
	local base="$1" home="$2" media="$3"
	local candidate="$base" n=2
	local link dest
	while true; do
		link="$home/storage/$candidate"
		dest="$media/$candidate"
		if [[ -L "$link" && ! -e "$link" ]]; then
			rm -f "$link"
		fi
		if [[ -d "$dest" && ! -e "$link" ]]; then
			rmdir "$dest" 2>/dev/null || true
		fi
		if [[ ! -e "$link" && ! -e "$dest" ]]; then
			printf '%s\n' "$candidate"
			return
		fi
		if [[ -L "$link" ]]; then
			if [[ "$(readlink -f "$link" 2>/dev/null || true)" == "$(readlink -f "$dest" 2>/dev/null || true)" ]]; then
				printf '%s\n' "$candidate"
				return
			fi
		fi
		candidate="${base}-${n}"
		n=$((n + 1))
	done
}

storage_mount_opts() {
	local fstype="$1" uid="$2" gid="$3"
	case "$fstype" in
	vfat | msdos | fat | fat32 | exfat)
		printf '%s\n' "uid=${uid},gid=${gid},umask=0022,noatime,nosuid,nodev"
		;;
	ntfs | ntfs3 | fuseblk)
		printf '%s\n' "uid=${uid},gid=${gid},umask=0022,noatime,nosuid,nodev"
		;;
	*)
		printf '%s\n' "noatime,nosuid,nodev"
		;;
	esac
}

storage_chown() {
	local user="$1"
	shift
	if [[ "${GPIO_STORAGE_SKIP_CHOWN:-}" == 1 ]]; then
		return 0
	fi
	if [[ "$(id -u)" -ne 0 ]]; then
		return 0
	fi
	chown -h "${user}:${user}" "$@" 2>/dev/null || true
}

storage_findmnt() {
	local dev="$1"
	if [[ -n "${GPIO_STORAGE_SKIP_MOUNT:-}" ]]; then
		printf '%s\n' "${GPIO_STORAGE_EXISTING_MOUNT:-}"
		return 0
	fi
	findmnt -n -o TARGET "$dev" 2>/dev/null || true
}

storage_write_state() {
	local kernel="$1" mountpoint="$2" link="$3"
	install -d -m 0755 "$STATE_DIR"
	printf '%s\n%s\n' "$mountpoint" "$link" >"$STATE_DIR/$kernel"
}

storage_read_state() {
	local kernel="$1"
	if [[ -f "$STATE_DIR/$kernel" ]]; then
		cat "$STATE_DIR/$kernel"
	fi
}

storage_add() {
	local kernel="${1:-}"
	local dev user home uid gid fstype label mountpoint link existing opts
	if [[ -z "$kernel" ]]; then
		storage_log "add: missing kernel name"
		return 2
	fi
	kernel="${kernel#/dev/}"
	dev="/dev/$kernel"
	if storage_is_system "$kernel"; then
		storage_log "skip system disk $kernel"
		return 0
	fi
	user="$(storage_user)"
	home="$(storage_home)"
	if [[ -z "$home" || ! -d "$home" ]]; then
		storage_log "home missing for $user"
		return 1
	fi
	if [[ -e "$home/storage" && ! -d "$home/storage" ]]; then
		storage_log "$home/storage exists and is not a directory"
		return 1
	fi
	existing="$(storage_findmnt "$dev")"
	case "$existing" in
	/ | /boot | /boot/firmware | /usr)
		storage_log "skip system mount $kernel -> $existing"
		return 0
		;;
	esac
	if [[ -z "${GPIO_STORAGE_SKIP_MOUNT:-}" && ! -b "$dev" ]]; then
		storage_log "not a block device $dev"
		return 0
	fi
	if [[ -n "$existing" ]]; then
		label="$(storage_sanitize "$(basename "$existing")")"
		if [[ "$label" == disk ]]; then
			label="$(storage_fallback_label "$kernel")"
		fi
		label="$(storage_unique_label "$label" "$home" "$MEDIA_ROOT")"
		install -d -m 0755 "$home/storage"
		storage_chown "$user" "$home/storage"
		link="$home/storage/$label"
		ln -sfn "$existing" "$link"
		storage_chown "$user" "$link"
		storage_write_state "$kernel" "$existing" "$link"
		storage_log "linked existing $existing -> $link"
		return 0
	fi
	fstype="$(storage_wait_fs "$dev" || true)"
	if [[ -z "$fstype" ]]; then
		storage_log "no filesystem on $kernel"
		return 0
	fi
	label="$(storage_sanitize "$(storage_blkid_value LABEL "$dev")")"
	if [[ "$label" == disk ]]; then
		label="$(storage_fallback_label "$kernel")"
	fi
	label="$(storage_unique_label "$label" "$home" "$MEDIA_ROOT")"
	mountpoint="$MEDIA_ROOT/$label"
	link="$home/storage/$label"
	install -d -m 0755 "$MEDIA_ROOT" "$mountpoint" "$home/storage"
	storage_chown "$user" "$home/storage"
	if [[ -z "${GPIO_STORAGE_SKIP_MOUNT:-}" ]]; then
		uid="$(id -u "$user" 2>/dev/null || echo 0)"
		gid="$(id -g "$user" 2>/dev/null || echo 0)"
		opts="$(storage_mount_opts "$fstype" "$uid" "$gid")"
		if ! mount -o "$opts" "$dev" "$mountpoint"; then
			rmdir "$mountpoint" 2>/dev/null || true
			storage_log "mount failed $dev"
			return 1
		fi
	fi
	ln -sfn "$mountpoint" "$link"
	storage_chown "$user" "$link"
	storage_write_state "$kernel" "$mountpoint" "$link"
	storage_log "mounted $dev at $mountpoint -> $link"
}

storage_remove() {
	local kernel="${1:-}"
	local mountpoint link our_media
	if [[ -z "$kernel" ]]; then
		storage_log "remove: missing kernel name"
		return 2
	fi
	kernel="${kernel#/dev/}"
	mapfile -t lines < <(storage_read_state "$kernel")
	mountpoint="${lines[0]:-}"
	link="${lines[1]:-}"
	our_media=0
	if [[ -n "$mountpoint" && "$mountpoint" == "$MEDIA_ROOT"/* ]]; then
		our_media=1
	fi
	if [[ -n "$link" && -L "$link" ]]; then
		rm -f "$link"
	fi
	if [[ "$our_media" -eq 1 ]]; then
		if [[ -z "${GPIO_STORAGE_SKIP_MOUNT:-}" ]]; then
			umount -l "$mountpoint" 2>/dev/null || true
		fi
		rmdir "$mountpoint" 2>/dev/null || true
	fi
	rm -f "$STATE_DIR/$kernel"
	storage_log "removed $kernel"
}

storage_main() {
	case "${1:-}" in
	add)
		storage_add "${2:-}"
		;;
	remove)
		storage_remove "${2:-}"
		;;
	*)
		echo "usage: storage-link.sh add|remove <kernel>" >&2
		return 2
		;;
	esac
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
	storage_main "$@"
fi
