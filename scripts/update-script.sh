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
BIN_REV_FILE="${GPIO_COMPANION_BIN_REV:-$CONFIG_DIR/bin.rev}"
FORCE=0
if [[ "${1:-}" == "--force" || "${GPIO_COMPANION_UPDATE_FORCE:-}" == "1" ]]; then
	FORCE=1
fi

need_root

cd "$REPO_ROOT"

before="$(git rev-parse HEAD 2>/dev/null || echo unknown)"
branch="main"
if [[ -f "$CONFIG_DIR/branch" ]]; then
	branch="$(cat "$CONFIG_DIR/branch")"
fi

if ! sync_managed_checkout "$REPO_ROOT" "$branch"; then
	echo "gpio-companion update: git sync failed" >&2
	exit 1
fi

after="$(git rev-parse HEAD 2>/dev/null || echo unknown)"
echo "gpio-companion update: $before -> $after"

SCRIPT_DIR="$REPO_ROOT/scripts"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

sync_opencode_agent

key_changed=0
if refresh_device_public_key; then
	key_changed=1
fi

bin_rev="$(cat "$BIN_REV_FILE" 2>/dev/null || echo none)"

paths_changed() {
	local pattern="$1" from="${2:-$before}"
	if [[ "$FORCE" -eq 1 ]]; then
		return 0
	fi
	if [[ "$from" == "$after" ]]; then
		return 1
	fi
	if [[ "$from" == "unknown" || "$from" == "none" || "$after" == "unknown" ]]; then
		return 0
	fi
	if ! git cat-file -e "$from" >/dev/null 2>&1 || ! git cat-file -e "$after" >/dev/null 2>&1; then
		return 0
	fi
	git diff --name-only "$from" "$after" | grep -Eq "$pattern"
}

server_needs_build() {
	if [[ "$FORCE" -eq 1 ]]; then
		return 0
	fi
	if [[ "$bin_rev" != "$after" ]]; then
		paths_changed '^(binary/gpio-companion/|packages/core/|scripts/systemd/gpio-companion\.service|package\.json|bun\.lock)' "$bin_rev"
		return
	fi
	return 1
}

install_ble_gatt_script
install_storage_link
install_cleanup_units

if server_needs_build; then
	if [[ "$FORCE" -eq 1 ]]; then
		echo "gpio-companion update: force rebuild"
	else
		echo "gpio-companion update: server changed, rebuilding ($bin_rev -> $after)"
	fi
	install_gpio_companion_bin
	install -m 0644 "$SCRIPT_DIR/systemd/gpio-companion.service" /etc/systemd/system/gpio-companion.service
	sed -i "s/^Environment=GPIO_COMPANION_HARDWARE=.*/Environment=GPIO_COMPANION_HARDWARE=$(read_hardware)/" /etc/systemd/system/gpio-companion.service
	if [[ -f "$SCRIPT_DIR/systemd/gpio-companion-update.service" ]]; then
		install -m 0644 "$SCRIPT_DIR/systemd/gpio-companion-update.service" /etc/systemd/system/gpio-companion-update.service
		install -m 0644 "$SCRIPT_DIR/systemd/gpio-companion-update.timer" /etc/systemd/system/gpio-companion-update.timer
	fi
	install_update_wrapper
	printf '%s\n' "$after" >"$BIN_REV_FILE"
	systemctl daemon-reload
	systemctl restart gpio-companion.service
elif paths_changed '^scripts/ble-gatt-server\.py$'; then
	echo "gpio-companion update: BLE GATT script changed, restarting"
	systemctl restart gpio-companion.service
elif [[ "$key_changed" -eq 1 ]]; then
	echo "gpio-companion update: restarting server for new device public key"
	systemctl restart gpio-companion.service
else
	echo "gpio-companion update: serve binary already at $after"
fi

if ! update_t3code "$FORCE"; then
	echo "gpio-companion update: t3 update skipped" >&2
fi

if ! update_opencode; then
	echo "gpio-companion update: opencode upgrade skipped" >&2
fi

write_opencode_ai_provider

if openviking_enabled; then
	write_openviking_ai_loopback
	write_opencode_openviking_plugin
	if paths_changed '^(opencode/memory/|scripts/openviking-seed)'; then
		echo "gpio-companion update: openviking seed data changed, reseeding"
		run_openviking_seed || echo "gpio-companion update: openviking reseed failed" >&2
	fi
fi

sync_local_pairing_with_dashboard

echo "gpio-companion update: done"
