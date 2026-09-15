#!/bin/sh
emu_root() {
	printf '%s' "${GPIO_EMU_ROOT:?}"
}

emu_register() {
	root="$(emu_root)"
	mkdir -p "$root/alive"
	printf '%s\n' "$1" >"$root/alive/$$"
	trap 'rm -f "$root/alive/$$"; exit 0' TERM INT HUP
}

emu_hold() {
	emu_register "$1"
	while true; do
		sleep 3600
	done
}

emu_line_path() {
	root="$(emu_root)"
	mkdir -p "$root/lines"
	printf '%s/%s.%s' "$root/lines" "$1" "$2"
}
