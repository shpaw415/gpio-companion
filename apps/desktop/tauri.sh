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
	export APPIMAGE_EXTRACT_AND_RUN=1
	export NO_STRIP="${NO_STRIP:-1}"
	export LINUX_DEV_PREFIX="$linux_dev"
	export PATH="/usr/lib/x86_64-linux-gnu/libgtk-3-0t64:/usr/lib/x86_64-linux-gnu/libgtk-3-0:/usr/lib/x86_64-linux-gnu/gdk-pixbuf-2.0:${PATH}"
	if [[ "${1:-}" == build ]]; then
		rm -rf "$root/src-tauri/target/release/bundle/appimage" \
			"$root/src-tauri/target/release/bundle/appimage_deb"
		plugin="$HOME/.cache/tauri/linuxdeploy-plugin-gtk.sh"
		if [[ -f "$plugin" ]] && ! grep -q LINUX_DEV_PREFIX "$plugin"; then
			python3 - "$plugin" <<'PY'
from pathlib import Path
import sys
p = Path(sys.argv[1])
t = p.read_text()
old = '    path="$("$PKG_CONFIG" --variable="$variable" "$library")"'
new = '''    path="$("$PKG_CONFIG" --variable="$variable" "$library")"
    overlay="${LINUX_DEV_PREFIX:-$HOME/.local/opt/linux-dev/usr}"
    path="${path/#$overlay//usr}"'''
if old in t:
    t = t.replace(old, new, 1)
t = t.replace(
    'sed -i "s|$gtk3_libdir/3.0.0/immodules/||g" "$APPDIR/$gtk3_immodules_cache_file"',
    'sed -i "s|$gtk3_libdir/3.0.0/immodules/||g" "$APPDIR/$gtk3_immodules_cache_file" || true',
)
p.write_text(t)
PY
		fi
	fi
fi
exec "$root/node_modules/.bin/tauri" "$@"
