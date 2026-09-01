#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")" && pwd)"
if [[ "$(uname -s)" == Linux ]]; then
	linux_dev="$HOME/.local/opt/linux-dev/usr"
	extra=""
	if [[ -d "$linux_dev/lib/x86_64-linux-gnu/pkgconfig" ]]; then
		extra="$linux_dev/lib/x86_64-linux-gnu/pkgconfig:$linux_dev/share/pkgconfig"
	fi
	if [[ -f "$HOME/.local/lib/pkgconfig/dbus-1.pc" ]]; then
		extra="${extra:+$extra:}$HOME/.local/lib/pkgconfig"
	fi
	if [[ -n "$extra" ]]; then
		export PKG_CONFIG_PATH="$extra${PKG_CONFIG_PATH:+:$PKG_CONFIG_PATH}"
	fi
fi
exec "$root/node_modules/.bin/tauri" "$@"
