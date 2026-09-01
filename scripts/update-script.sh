#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

CONFIG_DIR="${GPIO_COMPANION_CONFIG_DIR:-/etc/gpio-companion}"
if [[ -f "$CONFIG_DIR/update.env" ]]; then
	# shellcheck disable=SC1091
	source "$CONFIG_DIR/update.env"
fi
if [[ -f "$CONFIG_DIR/repo.path" ]]; then
	REPO_ROOT="$(cat "$CONFIG_DIR/repo.path")"
	SCRIPT_DIR="$REPO_ROOT/scripts"
fi

GPIO_USER="${GPIO_USER:-${SUDO_USER:-root}}"
BIN_DIR="${GPIO_COMPANION_BIN_DIR:-/usr/local/bin}"
LIB_DIR="${GPIO_COMPANION_LIB_DIR:-/usr/local/lib/gpio-companion}"
FORCE=0
if [[ "${1:-}" == "--force" || "${GPIO_COMPANION_UPDATE_FORCE:-}" == "1" ]]; then
	FORCE=1
fi

cd "$REPO_ROOT"

before="$(git rev-parse HEAD)"
branch="main"
if [[ -f "$CONFIG_DIR/branch" ]]; then
	branch="$(cat "$CONFIG_DIR/branch")"
fi

if git remote get-url origin >/dev/null 2>&1; then
	if ! git fetch origin; then
		echo "gpio-companion update: fetch failed, using current tree" >&2
	elif git rev-parse --verify "origin/$branch" >/dev/null 2>&1; then
		git reset --hard "origin/$branch"
	else
		echo "gpio-companion update: origin/$branch not found" >&2
	fi
else
	echo "gpio-companion update: no origin remote, skipping pull"
fi

after="$(git rev-parse HEAD)"
echo "gpio-companion update: $before -> $after"

sync_opencode_agent

key_changed=0
if refresh_device_public_key; then
	key_changed=1
fi

paths_changed() {
	local pattern="$1"
	if [[ "$FORCE" -eq 1 ]]; then
		return 0
	fi
	if [[ "$before" == "$after" ]]; then
		return 1
	fi
	git diff --name-only "$before" "$after" | grep -Eq "$pattern"
}

install_ble_gatt_script

if paths_changed '^(binary/gpio-companion/|packages/core/|scripts/systemd/gpio-companion\.service|package\.json|bun\.lock)'; then
	if [[ "$FORCE" -eq 1 ]]; then
		echo "gpio-companion update: force rebuild"
	else
		echo "gpio-companion update: server changed, rebuilding"
	fi
	install_gpio_companion_bin
	install -m 0644 "$SCRIPT_DIR/systemd/gpio-companion.service" /etc/systemd/system/gpio-companion.service
	sed -i "s/^Environment=GPIO_COMPANION_HARDWARE=.*/Environment=GPIO_COMPANION_HARDWARE=$(read_hardware)/" /etc/systemd/system/gpio-companion.service
	if [[ -f "$SCRIPT_DIR/systemd/gpio-companion-update.service" ]]; then
		install -m 0644 "$SCRIPT_DIR/systemd/gpio-companion-update.service" /etc/systemd/system/gpio-companion-update.service
		install -m 0644 "$SCRIPT_DIR/systemd/gpio-companion-update.timer" /etc/systemd/system/gpio-companion-update.timer
	fi
	install_update_wrapper
	systemctl daemon-reload
	systemctl restart gpio-companion.service
elif paths_changed '^scripts/ble-gatt-server\.py$'; then
	echo "gpio-companion update: BLE GATT script changed, restarting"
	systemctl restart gpio-companion.service
elif [[ "$key_changed" -eq 1 ]]; then
	echo "gpio-companion update: restarting server for new device public key"
	systemctl restart gpio-companion.service
fi

echo "gpio-companion update: done"
