#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

MARKER="${GPIO_COMPANION_SETUP_MARKER:-/etc/gpio-companion/first-setup-complete}"

need_root

if [[ -f "$MARKER" && "${GPIO_COMPANION_FORCE_SETUP:-}" != "1" ]]; then
	echo "gpio-companion first-setup already complete ($MARKER)"
	exit 0
fi

prompt() {
	local __var="$1" __msg="$2" __def="${3:-}" __value=""
	if [[ -n "$__def" ]]; then
		read -r -p "$__msg [$__def]: " __value || true
		__value="${__value:-$__def}"
	else
		read -r -p "$__msg: " __value || true
	fi
	printf -v "$__var" '%s' "$__value"
}

prompt_secret() {
	local __var="$1" __msg="$2" __value=""
	if [[ -t 0 ]]; then
		read -r -s -p "$__msg: " __value || true
		echo
	else
		read -r -p "$__msg: " __value || true
	fi
	printf -v "$__var" '%s' "$__value"
}

guess_hardware() {
	local model=""
	if [[ -r /proc/device-tree/model ]]; then
		model="$(tr -d '\0' </proc/device-tree/model)"
	fi
	case "${model,,}" in
	*orange*) echo orangepi ;;
	*raspberry*) echo raspberrypi ;;
	*) echo raspberrypi ;;
	esac
}

if [[ ! -t 0 && -z "${GPIO_COMPANION_HARDWARE:-}" ]]; then
	die "first-setup needs a TTY or GPIO_COMPANION_HARDWARE"
fi

echo "gpio-companion first setup"
echo "OpenCode API key and Gitea token are set from the dashboard, not this prompt."
echo

hardware="${GPIO_COMPANION_HARDWARE:-}"
if [[ -z "$hardware" ]]; then
	local_default="$(guess_hardware)"
	echo "Hardware:"
	echo "  1) raspberrypi"
	echo "  2) orangepi"
	if [[ "$local_default" == "orangepi" ]]; then
		prompt hw_choice "Choice" "2"
	else
		prompt hw_choice "Choice" "1"
	fi
	case "$hw_choice" in
	2 | orangepi) hardware=orangepi ;;
	*) hardware=raspberrypi ;;
	esac
fi
if [[ "$hardware" != "raspberrypi" && "$hardware" != "orangepi" ]]; then
	die "hardware must be raspberrypi or orangepi"
fi

tunnel_token="${GPIO_COMPANION_TUNNEL_TOKEN:-}"
tunnel_hostname="${GPIO_COMPANION_TUNNEL_HOSTNAME:-}"

if [[ -t 0 ]]; then
	[[ -n "$tunnel_token" ]] || prompt_secret tunnel_token "Cloudflare tunnel token (t3code replica, empty to skip)"
	[[ -n "$tunnel_hostname" ]] || prompt tunnel_hostname "Tunnel hostname / custom endpoint" ""
fi

echo "installing $hardware..."
"/bin/bash" "$SCRIPT_DIR/install-${hardware}.sh"

apply_runtime_config "$hardware" "$tunnel_token" "$tunnel_hostname"

install -d -m 0755 "$CONFIG_DIR"
date -u +"%Y-%m-%dT%H:%M:%SZ" >"$MARKER"
chmod 644 "$MARKER"

echo "first-setup complete"
echo "set OpenCode and Gitea credentials from the dashboard"
echo "t3code pairing stays on the dashboard"
