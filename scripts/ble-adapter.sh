#!/usr/bin/env bash
set -u
CONF="${GPIO_COMPANION_BLUETOOTH_CONF:-/etc/bluetooth/main.conf}"

log() {
	echo "gpio-companion ble-adapter: $*" >&2
}

if [[ -f "$CONF" ]] && grep -qE '^ControllerMode[[:space:]]*=[[:space:]]*le[[:space:]]*$' "$CONF"; then
	log "ControllerMode=le"
	exit 0
fi
log "ControllerMode=le missing from $CONF"
exit 1
