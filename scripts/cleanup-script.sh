#!/usr/bin/env bash
set -euo pipefail

gpio_cleanup_root() {
	printf '%s' "${GPIO_COMPANION_CLEANUP_ROOT:-}"
}

gpio_cleanup_path() {
	local rel="$1"
	local root
	root="$(gpio_cleanup_root)"
	if [[ -n "$root" ]]; then
		printf '%s%s' "$root" "$rel"
	else
		printf '%s' "$rel"
	fi
}

gpio_cleanup_protected() {
	local path="$1"
	case "$path" in
	*/etc/gpio-companion | */etc/gpio-companion/*) return 0 ;;
	*/opt/gpio-companion | */opt/gpio-companion/*) return 0 ;;
	*/.openviking | */.openviking/*) return 0 ;;
	*/openviking/data | */openviking/data/*) return 0 ;;
	esac
	return 1
}

gpio_cleanup_age_sec() {
	printf '%s' "${GPIO_COMPANION_CLEANUP_AGE_SEC:-86400}"
}

gpio_cleanup_now() {
	printf '%s' "${GPIO_COMPANION_CLEANUP_NOW:-$(date +%s)}"
}

gpio_cleanup_dry() {
	[[ "${GPIO_COMPANION_CLEANUP_DRY:-0}" == "1" ]]
}

gpio_cleanup_older_than() {
	local file="$1"
	local now age mtime
	now="$(gpio_cleanup_now)"
	age="$(gpio_cleanup_age_sec)"
	mtime="$(stat -c %Y "$file" 2>/dev/null || echo 0)"
	[[ "$mtime" -gt 0 && $((now - mtime)) -ge $age ]]
}

gpio_cleanup_rm_file() {
	local file="$1"
	if gpio_cleanup_protected "$file"; then
		return 1
	fi
	if gpio_cleanup_dry; then
		return 0
	fi
	rm -f -- "$file"
}

gpio_cleanup_prune_dir() {
	local dir="$1"
	local bytes=0
	local file size
	if [[ ! -d "$dir" ]]; then
		printf '%s' "0"
		return 0
	fi
	while IFS= read -r -d '' file; do
		if gpio_cleanup_protected "$file"; then
			continue
		fi
		if ! gpio_cleanup_older_than "$file"; then
			continue
		fi
		size="$(stat -c %s "$file" 2>/dev/null || echo 0)"
		if gpio_cleanup_rm_file "$file"; then
			bytes=$((bytes + size))
		fi
	done < <(find "$dir" -type f -print0 2>/dev/null)
	printf '%s' "$bytes"
}

gpio_cleanup_prune_globs() {
	local dir="$1"
	shift
	local bytes=0
	local pattern file size
	if [[ ! -d "$dir" ]]; then
		printf '%s' "0"
		return 0
	fi
	for pattern in "$@"; do
		while IFS= read -r -d '' file; do
			if gpio_cleanup_protected "$file"; then
				continue
			fi
			if ! gpio_cleanup_older_than "$file"; then
				continue
			fi
			size="$(stat -c %s "$file" 2>/dev/null || echo 0)"
			if gpio_cleanup_rm_file "$file"; then
				bytes=$((bytes + size))
			fi
		done < <(find "$dir" -type f -name "$pattern" -print0 2>/dev/null)
	done
	printf '%s' "$bytes"
}

gpio_cleanup_disk_mb() {
	local target="${1:-/}"
	df -Pm "$target" 2>/dev/null | awk 'NR==2 {print $2, $4}'
}

gpio_cleanup_dpkg_busy() {
	local lock
	lock="$(gpio_cleanup_path /var/lib/dpkg/lock-frontend)"
	if [[ -e "$lock" ]] && command -v fuser >/dev/null 2>&1; then
		fuser "$lock" >/dev/null 2>&1
		return
	fi
	return 1
}

gpio_cleanup_main() {
	local root user home config_dir state_dir dashboard uuid
	local before_avail after_avail total_mb avail_mb
	local reclaimed=0
	local bytes
	local -a actions=()
	local report

	root="$(gpio_cleanup_root)"
	user="${GPIO_USER:-${SUDO_USER:-root}}"
	if [[ "$user" == "root" ]]; then
		home="/root"
	else
		home="/home/$user"
	fi
	config_dir="${GPIO_COMPANION_CONFIG_DIR:-/etc/gpio-companion}"
	state_dir="$(gpio_cleanup_path /var/lib/gpio-companion)"
	dashboard="${GPIO_COMPANION_DASHBOARD_URL:-https://gpio-companion.com}"
	dashboard="${dashboard%/}"

	if [[ -z "$root" && "${GPIO_COMPANION_CLEANUP_DRY:-0}" != "1" && "$(id -u)" -ne 0 ]]; then
		echo "gpio-companion cleanup: run as root (sudo)" >&2
		return 1
	fi

	if [[ -f "$config_dir/pairing.env" ]]; then
		# shellcheck disable=SC1091
		source "$config_dir/pairing.env"
	fi
	uuid="${GPIO_COMPANION_PAIRING_UUID:-}"

	read -r total_mb before_avail <<<"$(gpio_cleanup_disk_mb "${root:-/}")" || true
	total_mb="${total_mb:-0}"
	before_avail="${before_avail:-0}"

	if [[ -z "$root" ]] && command -v journalctl >/dev/null 2>&1; then
		if gpio_cleanup_dry; then
			actions+=("journal-vacuum")
		elif journalctl --vacuum-time=24h >/dev/null 2>&1; then
			actions+=("journal-vacuum")
		fi
	fi

	if [[ -z "$root" ]] && ! gpio_cleanup_dpkg_busy && command -v apt-get >/dev/null 2>&1; then
		if gpio_cleanup_dry; then
			actions+=("apt-clean")
		else
			DEBIAN_FRONTEND=noninteractive apt-get clean >/dev/null 2>&1 || true
			DEBIAN_FRONTEND=noninteractive apt-get autoclean -y >/dev/null 2>&1 || true
			actions+=("apt-clean")
		fi
	else
		bytes="$(gpio_cleanup_prune_globs "$(gpio_cleanup_path /var/cache/apt/archives)" '*.deb')"
		if [[ "$bytes" -gt 0 ]]; then
			reclaimed=$((reclaimed + bytes))
			actions+=("apt-archives")
		fi
	fi

	bytes="$(gpio_cleanup_prune_dir "$(gpio_cleanup_path /tmp)")"
	if [[ "$bytes" -gt 0 ]]; then
		reclaimed=$((reclaimed + bytes))
		actions+=("prune:/tmp")
	fi
	bytes="$(gpio_cleanup_prune_dir "$(gpio_cleanup_path /var/tmp)")"
	if [[ "$bytes" -gt 0 ]]; then
		reclaimed=$((reclaimed + bytes))
		actions+=("prune:/var/tmp")
	fi
	bytes="$(gpio_cleanup_prune_dir "$(gpio_cleanup_path /var/crash)")"
	if [[ "$bytes" -gt 0 ]]; then
		reclaimed=$((reclaimed + bytes))
		actions+=("prune:/var/crash")
	fi
	bytes="$(gpio_cleanup_prune_globs "$(gpio_cleanup_path /var/log)" '*.gz' '*.old' '*.[0-9]')"
	if [[ "$bytes" -gt 0 ]]; then
		reclaimed=$((reclaimed + bytes))
		actions+=("prune:/var/log")
	fi
	bytes="$(gpio_cleanup_prune_dir "$(gpio_cleanup_path "$home/.bun/install/cache")")"
	if [[ "$bytes" -gt 0 ]]; then
		reclaimed=$((reclaimed + bytes))
		actions+=("prune:bun-cache")
	fi
	bytes="$(gpio_cleanup_prune_dir "$(gpio_cleanup_path "$home/.npm/_cacache")")"
	if [[ "$bytes" -gt 0 ]]; then
		reclaimed=$((reclaimed + bytes))
		actions+=("prune:npm-cache")
	fi
	bytes="$(gpio_cleanup_prune_dir "$(gpio_cleanup_path "$home/.cache/pip")")"
	if [[ "$bytes" -gt 0 ]]; then
		reclaimed=$((reclaimed + bytes))
		actions+=("prune:pip-cache")
	fi

	read -r total_mb after_avail <<<"$(gpio_cleanup_disk_mb "${root:-/}")" || true
	total_mb="${total_mb:-0}"
	avail_mb="${after_avail:-$before_avail}"

	mkdir -p "$state_dir"

	report="$(
		GPIO_CLEANUP_UUID="$uuid" \
			GPIO_CLEANUP_AT="$(gpio_cleanup_now)000" \
			GPIO_CLEANUP_TOTAL="$total_mb" \
			GPIO_CLEANUP_AVAIL="$avail_mb" \
			GPIO_CLEANUP_RECLAIMED="$reclaimed" \
			GPIO_CLEANUP_ACTIONS="$(IFS=,; printf '%s' "${actions[*]}")" \
			python3 - <<'PY'
import json, os
actions = [item for item in os.environ.get("GPIO_CLEANUP_ACTIONS", "").split(",") if item]
print(json.dumps({
	"uuid": os.environ.get("GPIO_CLEANUP_UUID", ""),
	"at": int(os.environ.get("GPIO_CLEANUP_AT") or "0"),
	"diskTotalMb": int(float(os.environ.get("GPIO_CLEANUP_TOTAL") or "0")),
	"diskAvailMb": int(float(os.environ.get("GPIO_CLEANUP_AVAIL") or "0")),
	"reclaimedBytes": int(os.environ.get("GPIO_CLEANUP_RECLAIMED") or "0"),
	"actions": actions,
}))
PY
	)"
	if ! gpio_cleanup_dry; then
		printf '%s\n' "$report" >"$state_dir/cleanup-last.json"
	elif [[ -d "$state_dir" ]]; then
		printf '%s\n' "$report" >"$state_dir/cleanup-last.json"
	fi

	if [[ -n "$uuid" ]] && ! gpio_cleanup_dry; then
		curl -fsS --max-time 10 -X POST "$dashboard/api/debug/maintenance" \
			-H "content-type: application/json" \
			-d "$report" >/dev/null 2>&1 || true
	fi

	echo "gpio-companion cleanup: reclaimed ${reclaimed}B avail ${avail_mb}MB"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
	gpio_cleanup_main "$@"
fi
