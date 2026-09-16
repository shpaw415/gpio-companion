#!/usr/bin/env bash
set -u

log() {
	echo "gpio-companion wifi-keep: $*" >&2
}

state_dir() {
	echo "${GPIO_COMPANION_WIFI_KEEP_STATE:-/run/gpio-companion}"
}

fail_file() {
	echo "$(state_dir)/wifi-keep.fail"
}

keep_sleep() {
	if [[ "${GPIO_COMPANION_WIFI_KEEP_SLEEP:-1}" == "0" ]]; then
		return 0
	fi
	sleep "${1:-1}"
}

reset_fail() {
	rm -f "$(fail_file)" 2>/dev/null || true
}

read_fail() {
	local n
	n="$(cat "$(fail_file)" 2>/dev/null || true)"
	if [[ "$n" =~ ^[0-9]+$ ]]; then
		echo "$n"
		return 0
	fi
	echo 0
}

bump_fail() {
	local n
	n="$(read_fail)"
	n=$((n + 1))
	mkdir -p "$(state_dir)" 2>/dev/null || true
	echo "$n" >"$(fail_file)" 2>/dev/null || true
	echo "$n"
}

claim_wifi() {
	local line dev type state rest
	command -v rfkill >/dev/null 2>&1 && rfkill unblock wifi >/dev/null 2>&1 || true
	command -v rfkill >/dev/null 2>&1 && rfkill unblock wlan >/dev/null 2>&1 || true
	nmcli networking on >/dev/null 2>&1 || true
	nmcli radio wifi on >/dev/null 2>&1 || true
	while IFS= read -r line; do
		[[ -n "$line" ]] || continue
		dev="${line%%:*}"
		rest="${line#*:}"
		type="${rest%%:*}"
		state="${rest#*:}"
		state="${state%%:*}"
		if [[ "$type" == "wifi" && ( "$state" == "unmanaged" || "$state" == "unavailable" ) ]]; then
			nmcli device set "$dev" managed yes >/dev/null 2>&1 || true
		fi
	done < <(nmcli -t -f DEVICE,TYPE,STATE device status 2>/dev/null || true)
}

best_wifi_connection() {
	local line name type ts best_name="" best_ts=-1
	while IFS= read -r line; do
		[[ -n "$line" ]] || continue
		name="${line%%:*}"
		rest="${line#*:}"
		type="${rest%%:*}"
		ts="${rest#*:}"
		ts="${ts%%:*}"
		[[ "$type" == "802-11-wireless" ]] || continue
		[[ "$name" != "gpio-companion-ble-health-probe" ]] || continue
		if [[ ! "$ts" =~ ^[0-9]+$ ]]; then
			ts=0
		fi
		if [[ "$ts" -ge "$best_ts" ]]; then
			best_ts="$ts"
			best_name="$name"
		fi
	done < <(nmcli -t -f NAME,TYPE,TIMESTAMP connection show 2>/dev/null || true)
	echo "$best_name"
}

reload_wifi_firmware() {
	if ! command -v modprobe >/dev/null 2>&1; then
		return 0
	fi
	log "reloading brcmfmac"
	modprobe -r brcmfmac >/dev/null 2>&1 || true
	keep_sleep 1
	modprobe brcmfmac >/dev/null 2>&1 || true
	keep_sleep 2
}

wifi_keep() {
	local line type state has_wifi=0
	local name max_fail fails

	if ! command -v nmcli >/dev/null 2>&1; then
		log "nmcli missing"
		return 0
	fi

	while IFS= read -r line; do
		[[ -n "$line" ]] || continue
		rest="${line#*:}"
		type="${rest%%:*}"
		state="${rest#*:}"
		state="${state%%:*}"
		[[ "$type" == "wifi" ]] || continue
		has_wifi=1
		if [[ "$state" == "connected" || "$state" == "connecting" ]]; then
			reset_fail
			log "connected"
			return 0
		fi
	done < <(nmcli -t -f DEVICE,TYPE,STATE device status 2>/dev/null || true)

	if [[ "$has_wifi" -eq 0 ]]; then
		log "no wifi device"
		return 0
	fi

	claim_wifi
	name="$(best_wifi_connection)"
	if [[ -z "$name" ]]; then
		log "no saved wifi"
		return 0
	fi

	log "up $name"
	if nmcli connection up "$name" >/dev/null 2>&1; then
		reset_fail
		return 0
	fi

	fails="$(bump_fail)"
	max_fail="${GPIO_COMPANION_WIFI_KEEP_FAILS:-4}"
	log "up failed ($fails/$max_fail)"
	if [[ "$fails" -ge "$max_fail" ]]; then
		reload_wifi_firmware
		reset_fail
		claim_wifi
		nmcli connection up "$name" >/dev/null 2>&1 || true
	fi
	return 0
}

wifi_keep
