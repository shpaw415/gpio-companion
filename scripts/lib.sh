#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
GPIO_USER="${GPIO_USER:-${SUDO_USER:-root}}"
CONFIG_DIR="${GPIO_COMPANION_CONFIG_DIR:-/etc/gpio-companion}"
BIN_DIR="${GPIO_COMPANION_BIN_DIR:-/usr/local/bin}"
LIB_DIR="${GPIO_COMPANION_LIB_DIR:-/usr/local/lib/gpio-companion}"
DEFAULT_DASHBOARD_URL="https://gpio-companion.com"

die() {
	echo "gpio-companion install: $*" >&2
	exit 1
}

need_root() {
	if [[ "$(id -u)" -ne 0 ]]; then
		die "run as root (sudo)"
	fi
}

apt_update() {
	export DEBIAN_FRONTEND=noninteractive
	apt-get update -y
}

apt_install() {
	export DEBIAN_FRONTEND=noninteractive
	apt-get install -y --no-install-recommends "$@"
}

apt_install_optional() {
	local pkg
	for pkg in "$@"; do
		if apt-cache show "$pkg" >/dev/null 2>&1; then
			apt_install "$pkg" || true
		fi
	done
}

linux_arch() {
	dpkg --print-architecture
}

cloudflared_deb_arch() {
	case "$(linux_arch)" in
	amd64) echo amd64 ;;
	arm64) echo arm64 ;;
	armhf) echo arm ;;
	*) die "unsupported architecture: $(linux_arch)" ;;
	esac
}

install_apt_base() {
	apt_update
	apt_install \
		ca-certificates \
		curl \
		git \
		zip \
		unzip \
		build-essential \
		python3 \
		python3-dev \
		python3-setuptools \
		python3-pip \
		python3-venv \
		python3-serial \
		pkg-config \
		gpiod \
		libgpiod-dev \
		python3-libgpiod \
		avrdude \
		gcc-avr \
		avr-libc \
		dfu-util \
		libusb-1.0-0-dev \
		picocom \
		usbutils \
		udev \
		bluez \
		python3-dbus \
		python3-gi \
		network-manager
	systemctl enable --now NetworkManager.service || true
}

install_node() {
	if command -v node >/dev/null 2>&1; then
		return
	fi
	curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
	apt_install nodejs
}

install_bun() {
	if [[ -x "$BIN_DIR/bun" ]]; then
		return
	fi
	curl -fsSL https://bun.sh/install | BUN_INSTALL=/usr/local bash
	if [[ -x /usr/local/bin/bun ]]; then
		return
	fi
	if [[ -x /usr/local/bun-linux-*/bun ]]; then
		install -m 0755 /usr/local/bun-linux-*/bun "$BIN_DIR/bun"
	fi
	command -v bun >/dev/null || die "bun install failed"
}

install_node_gyp() {
	npm install -g node-gyp
}

install_cloudflared() {
	if command -v cloudflared >/dev/null 2>&1; then
		return
	fi
	local deb arch
	arch="$(cloudflared_deb_arch)"
	deb="/tmp/cloudflared-linux-${arch}.deb"
	curl -fsSL -o "$deb" "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${arch}.deb"
	dpkg -i "$deb"
	rm -f "$deb"
}

install_arduino_cli() {
	if command -v arduino-cli >/dev/null 2>&1; then
		return
	fi
	curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | BINDIR="$BIN_DIR" sh
}

install_opencode() {
	if [[ "$GPIO_USER" == "root" ]]; then
		curl -fsSL https://opencode.ai/install | bash
		return
	fi
	sudo -u "$GPIO_USER" bash -lc 'curl -fsSL https://opencode.ai/install | bash'
}

t3_installed_npm_version() {
	local ver=""
	if ! command -v npm >/dev/null 2>&1; then
		return 1
	fi
	ver="$(npm list -g t3 --depth=0 2>/dev/null | sed -n 's/.*t3@//p' | head -n1 | tr -d '[:space:]')" || true
	if [[ -z "$ver" ]]; then
		return 1
	fi
	printf '%s\n' "$ver"
}

t3_latest_npm_version() {
	local ver=""
	if ! command -v npm >/dev/null 2>&1; then
		return 1
	fi
	ver="$(npm view t3 version 2>/dev/null | tr -d '[:space:]')" || true
	if [[ -z "$ver" ]]; then
		return 1
	fi
	printf '%s\n' "$ver"
}

install_t3code() {
	npm install -g t3@latest
	install_t3_service
}

install_t3_service() {
	if ! command -v t3 >/dev/null 2>&1; then
		return 1
	fi
	if [[ "$GPIO_USER" == "root" ]]; then
		t3 service install
		return
	fi
	sudo -u "$GPIO_USER" -H t3 service install
}

update_t3code() {
	local force="${1:-0}" current="" latest=""
	if ! command -v npm >/dev/null 2>&1; then
		echo "gpio-companion update: npm not found, skipping t3" >&2
		return 1
	fi
	current="$(t3_installed_npm_version || true)"
	latest="$(t3_latest_npm_version || true)"
	if [[ -z "$latest" ]]; then
		echo "gpio-companion update: t3@latest unavailable, keeping ${current:-none}" >&2
		install_t3_service || return 1
		return 0
	fi
	if [[ "$force" != "1" && -n "$current" && "$current" == "$latest" ]]; then
		echo "gpio-companion update: t3 $current is current"
		install_t3_service || return 1
		return 0
	fi
	echo "gpio-companion update: t3 ${current:-none} -> $latest"
	npm install -g t3@latest
	install_t3_service
}

install_arduino_udev() {
	cat >/etc/udev/rules.d/99-gpio-companion-arduino.rules <<'EOF'
SUBSYSTEM=="tty", ATTRS{idVendor}=="2341", GROUP="dialout", MODE="0660"
SUBSYSTEM=="usb", ATTRS{idVendor}=="2341", GROUP="dialout", MODE="0660"
SUBSYSTEM=="tty", ATTRS{idVendor}=="1a86", GROUP="dialout", MODE="0660"
SUBSYSTEM=="tty", ATTRS{idVendor}=="10c4", GROUP="dialout", MODE="0660"
EOF
	udevadm control --reload-rules || true
}

add_user_groups() {
	local group
	if [[ "$GPIO_USER" == "root" ]]; then
		return
	fi
	for group in dialout plugdev gpio i2c spi; do
		if getent group "$group" >/dev/null; then
			usermod -aG "$group" "$GPIO_USER" || true
		fi
	done
}

write_repo_metadata() {
	install -d -m 0755 "$CONFIG_DIR"
	printf "%s\n" "$REPO_ROOT" >"$CONFIG_DIR/repo.path"
	local branch
	branch="$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
	if [[ -z "$branch" || "$branch" == "HEAD" ]]; then
		branch="main"
	fi
	printf "%s\n" "$branch" >"$CONFIG_DIR/branch"
	cat >"$CONFIG_DIR/update.env" <<EOF
GPIO_USER=$GPIO_USER
GPIO_COMPANION_CONFIG_DIR=$CONFIG_DIR
GPIO_COMPANION_BIN_DIR=$BIN_DIR
GPIO_COMPANION_DASHBOARD_URL=$(dashboard_url)
EOF
}

git_dir_for() {
	local root="${1:-$REPO_ROOT}" gitdir
	gitdir="$(git -C "$root" rev-parse --git-dir 2>/dev/null || true)"
	if [[ -z "$gitdir" && -d "$root/.git" ]]; then
		gitdir="$root/.git"
	fi
	if [[ -z "$gitdir" ]]; then
		return 1
	fi
	if [[ "$gitdir" != /* ]]; then
		gitdir="$root/$gitdir"
	fi
	printf '%s' "$gitdir"
}

origin_url_for() {
	local root="${1:-$REPO_ROOT}" gitdir
	git -C "$root" remote get-url origin 2>/dev/null && return 0
	gitdir="$(git_dir_for "$root")" || return 1
	git config --file "$gitdir/config" --get remote.origin.url
}

prune_empty_git_objects() {
	local root="${1:-$REPO_ROOT}" gitdir objects f base
	gitdir="$(git_dir_for "$root")" || return 0
	objects="$gitdir/objects"
	if [[ ! -d "$objects" ]]; then
		mkdir -p "$objects/info" "$objects/pack"
		return 0
	fi
	while IFS= read -r -d '' f; do
		rm -f "$f"
		if [[ "$f" == *.pack || "$f" == *.idx ]]; then
			base="${f%.pack}"
			base="${base%.idx}"
			rm -f "${base}.pack" "${base}.idx"
		fi
	done < <(find "$objects" -type f -empty -print0 2>/dev/null || true)
}

git_checkout_corrupt() {
	local root="${1:-$REPO_ROOT}" gitdir objects
	gitdir="$(git_dir_for "$root")" || return 0
	objects="$gitdir/objects"
	if [[ ! -d "$objects" ]]; then
		return 0
	fi
	if [[ -n "$(find "$objects" -type f -empty -print -quit 2>/dev/null)" ]]; then
		return 0
	fi
	if ! git -C "$root" rev-parse --verify HEAD >/dev/null 2>&1; then
		return 0
	fi
	if ! git -C "$root" cat-file -e HEAD^{commit} >/dev/null 2>&1; then
		return 0
	fi
	return 1
}

configure_lowmem_git() {
	local root="${1:-$REPO_ROOT}"
	git -C "$root" config --local pack.windowMemory 32m 2>/dev/null || true
	git -C "$root" config --local pack.threads 1 2>/dev/null || true
	git -C "$root" config --local pack.deltaCacheSize 16m 2>/dev/null || true
}

fetch_managed_checkout() {
	local root="$1" branch="$2"
	configure_lowmem_git "$root"
	git -C "$root" fetch --depth 1 origin "$branch"
}

reset_managed_checkout() {
	local root="$1" branch="$2"
	if git -C "$root" rev-parse --verify "origin/$branch" >/dev/null 2>&1; then
		git -C "$root" reset --hard "origin/$branch"
	elif git -C "$root" rev-parse --verify FETCH_HEAD >/dev/null 2>&1; then
		git -C "$root" reset --hard FETCH_HEAD
	else
		return 1
	fi
}

reclone_managed_checkout() {
	local root="$1" branch="$2" url parent tmp
	url="$(origin_url_for "$root")"
	parent="$(dirname "$root")"
	tmp="$(mktemp -d "$parent/.gpio-companion-reclone.XXXXXX")"
	if ! git clone --depth 1 --branch "$branch" "$url" "$tmp/repo"; then
		rm -rf "$tmp"
		return 1
	fi
	rm -rf "$root/.git"
	mv "$tmp/repo/.git" "$root/.git"
	rm -rf "$tmp"
	configure_lowmem_git "$root"
	reset_managed_checkout "$root" "$branch"
}

sync_managed_checkout() {
	local root="${1:-$REPO_ROOT}" branch="${2:-main}" attempt
	if [[ -z "$(origin_url_for "$root" 2>/dev/null || true)" ]]; then
		echo "gpio-companion update: no origin remote, skipping pull" >&2
		return 0
	fi
	if git_checkout_corrupt "$root"; then
		echo "gpio-companion update: git corruption detected, repairing" >&2
	fi
	prune_empty_git_objects "$root"
	configure_lowmem_git "$root"
	attempt=0
	while [[ "$attempt" -lt 2 ]]; do
		attempt=$((attempt + 1))
		if fetch_managed_checkout "$root" "$branch" && reset_managed_checkout "$root" "$branch"; then
			return 0
		fi
		echo "gpio-companion update: fetch failed, repairing git objects" >&2
		prune_empty_git_objects "$root"
	done
	echo "gpio-companion update: fetch failed after repair, recloning" >&2
	if reclone_managed_checkout "$root" "$branch"; then
		return 0
	fi
	echo "gpio-companion update: fetch failed, using current tree" >&2
	if git_checkout_corrupt "$root"; then
		echo "gpio-companion update: git still corrupt" >&2
		return 1
	fi
	return 0
}

dashboard_url() {
	local origin="${GPIO_COMPANION_DASHBOARD_URL:-$DEFAULT_DASHBOARD_URL}"
	origin="${origin%/}"
	printf '%s' "$origin"
}

pairing_uuid() {
	local uuid="${GPIO_COMPANION_PAIRING_UUID:-}"
	if [[ -f "$CONFIG_DIR/pairing.env" ]]; then
		# shellcheck disable=SC1091
		source "$CONFIG_DIR/pairing.env"
		uuid="${GPIO_COMPANION_PAIRING_UUID:-$uuid}"
	fi
	if [[ -z "$uuid" && -f "${GPIO_COMPANION_PAIRING:-$CONFIG_DIR/pairing.json}" ]]; then
		uuid="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("uuid") or "")' "${GPIO_COMPANION_PAIRING:-$CONFIG_DIR/pairing.json}" 2>/dev/null || true)"
	fi
	printf '%s' "$uuid"
}

local_pairing_claimed() {
	local path="${GPIO_COMPANION_PAIRING:-$CONFIG_DIR/pairing.json}"
	if [[ ! -f "$path" ]]; then
		return 1
	fi
	python3 -c 'import json,sys; raise SystemExit(0 if json.load(open(sys.argv[1])).get("claimed") else 1)' "$path" 2>/dev/null
}

sync_local_pairing_with_dashboard() {
	local uuid raw paired
	uuid="$(pairing_uuid)"
	if [[ -z "$uuid" ]]; then
		return 0
	fi
	raw="$(
		curl -fsS --max-time 15 "$(dashboard_url)/api/device/paired?uuid=$(
			UUID="$uuid" python3 -c 'import os, urllib.parse; print(urllib.parse.quote(os.environ["UUID"]))'
		)" 2>/dev/null
	)" || {
		echo "gpio-companion update: dashboard pairing check failed" >&2
		return 0
	}
	paired="$(
		raw="$raw" python3 -c 'import json, os; print("1" if json.loads(os.environ["raw"]).get("paired") else "0")' 2>/dev/null || echo x
	)"
	if [[ "$paired" != "0" ]]; then
		return 0
	fi
	if ! local_pairing_claimed; then
		echo "gpio-companion update: dashboard unpaired"
		return 0
	fi
	echo "gpio-companion update: dashboard has no claim, unpairing locally"
	if [[ -x "$SCRIPT_DIR/unpair.sh" ]]; then
		"$SCRIPT_DIR/unpair.sh"
	else
		echo "gpio-companion update: unpair.sh missing" >&2
	fi
}

device_auth_path() {
	printf '%s' "${GPIO_COMPANION_DEVICE_AUTH:-$CONFIG_DIR/device-auth.json}"
}

write_device_auth_json() {
	local src="$1" dest="$2"
	python3 - "$src" "$dest" <<'PY'
import json, os, sys
src, dest = sys.argv[1], sys.argv[2]
with open(src, encoding="utf-8") as handle:
    data = json.load(handle)
key_id = data.get("keyId")
pem = data.get("publicKeyPem")
if not isinstance(key_id, str) or not key_id.strip():
    raise SystemExit(2)
if not isinstance(pem, str) or "BEGIN PUBLIC KEY" not in pem:
    raise SystemExit(2)
pem = pem.strip() + "\n"
out = {"keyId": key_id.strip(), "publicKeyPem": pem}
tmp = f"{dest}.tmp"
with open(tmp, "w", encoding="utf-8") as handle:
    json.dump(out, handle, indent="\t")
    handle.write("\n")
os.replace(tmp, dest)
PY
}

fetch_device_public_key() {
	local url dest tmp
	url="$(dashboard_url)/api/device-public-key"
	dest="$(device_auth_path)"
	install -d -m 0755 "$CONFIG_DIR"
	tmp="$(mktemp)"
	if ! curl -fsS --max-time 30 "$url" -o "$tmp"; then
		rm -f "$tmp"
		return 1
	fi
	if ! write_device_auth_json "$tmp" "$dest"; then
		rm -f "$tmp"
		return 2
	fi
	rm -f "$tmp"
	chmod 644 "$dest"
	return 0
}

register_device_public_key() {
	local url
	url="$(dashboard_url)/api/device-public-key"
	echo "fetching device public key from $url"
	if ! fetch_device_public_key; then
		die "failed to fetch device public key from $url"
	fi
	if command -v systemctl >/dev/null; then
		systemctl restart gpio-companion.service || true
	fi
}

refresh_device_public_key() {
	local dest before after url
	url="$(dashboard_url)/api/device-public-key"
	dest="$(device_auth_path)"
	before=""
	if [[ -f "$dest" ]]; then
		before="$(cat "$dest")"
	fi
	if ! fetch_device_public_key; then
		echo "gpio-companion update: device public key fetch failed, keeping current" >&2
		return 1
	fi
	after="$(cat "$dest")"
	if [[ "$before" == "$after" ]]; then
		echo "gpio-companion update: device public key unchanged"
		return 1
	fi
	echo "gpio-companion update: device public key updated from $url"
	return 0
}

opencode_home() {
	if [[ "$GPIO_USER" == "root" ]]; then
		echo "/root/.config/opencode"
	else
		echo "/home/$GPIO_USER/.config/opencode"
	fi
}

sync_opencode_agent() {
	local dest
	dest="$(opencode_home)"
	install -d -m 0755 "$dest"
	rm -rf "$dest/skills" "$dest/preferences"
	cp -a "$REPO_ROOT/opencode/skills" "$dest/skills"
	cp -a "$REPO_ROOT/opencode/preferences" "$dest/preferences"
	if [[ "$GPIO_USER" != "root" ]]; then
		chown -R "$GPIO_USER:$GPIO_USER" "$dest"
	fi
}

read_hardware() {
	if [[ -f "$CONFIG_DIR/config.json" ]] && command -v python3 >/dev/null; then
		python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("hardware","raspberrypi"))' "$CONFIG_DIR/config.json"
	else
		echo raspberrypi
	fi
}

write_device_config() {
	local hardware="$1"
	install -d -m 0755 "$CONFIG_DIR"
	if [[ ! -f "$CONFIG_DIR/config.json" ]]; then
		cat >"$CONFIG_DIR/config.json" <<EOF
{
	"hardware": "$hardware",
	"tunnel": {
		"token": "",
		"hostname": "",
		"apiHostname": "",
		"tunnelId": ""
	}
}
EOF
	fi
	if [[ ! -f "$CONFIG_DIR/cloudflared.env" ]]; then
		printf "TUNNEL_TOKEN=''\nTUNNEL_HOSTNAME=''\nTUNNEL_API_HOSTNAME=''\nTUNNEL_ID=''\n" >"$CONFIG_DIR/cloudflared.env"
		chmod 600 "$CONFIG_DIR/cloudflared.env"
	fi
}

write_pairing_env() {
	install -d -m 0755 "$CONFIG_DIR"
	if [[ -f "$CONFIG_DIR/pairing.env" ]]; then
		# shellcheck disable=SC1091
		source "$CONFIG_DIR/pairing.env"
		echo "pairing UUID: ${GPIO_COMPANION_PAIRING_UUID:-}"
		echo "pairing key:  ${GPIO_COMPANION_PAIRING_KEY:-}"
		return
	fi
	local uuid key
	uuid="${GPIO_COMPANION_PAIRING_UUID:-}"
	key="${GPIO_COMPANION_PAIRING_KEY:-}"
	if [[ -z "$uuid" || -z "$key" ]]; then
		eval "$(python3 - <<'PY'
import secrets, uuid
print(f"uuid={uuid.uuid4()}")
print(f"key={secrets.token_urlsafe(24)}")
PY
)"
	fi
	umask 077
	cat >"$CONFIG_DIR/pairing.env" <<EOF
GPIO_COMPANION_PAIRING_UUID=$uuid
GPIO_COMPANION_PAIRING_KEY=$key
EOF
	chmod 600 "$CONFIG_DIR/pairing.env"
	echo "pairing UUID: $uuid"
	echo "pairing key:  $key"
	echo "enter these on the dashboard /pair page to bind this board to your account"
}

apply_runtime_config() {
	local hardware="$1" token="$2" hostname="$3" api_hostname="${4:-}" tunnel_id="${5:-}"
	install -d -m 0755 "$CONFIG_DIR"
	GPIO_COMPANION_CONFIG_DIR="$CONFIG_DIR" HARDWARE="$hardware" TUNNEL_TOKEN="$token" TUNNEL_HOSTNAME="$hostname" TUNNEL_API_HOSTNAME="$api_hostname" TUNNEL_ID="$tunnel_id" python3 - <<'PY'
import json, os
from pathlib import Path
config_dir = Path(os.environ.get("GPIO_COMPANION_CONFIG_DIR", "/etc/gpio-companion"))
config = {
	"hardware": os.environ["HARDWARE"],
	"tunnel": {
		"token": os.environ.get("TUNNEL_TOKEN", ""),
		"hostname": os.environ.get("TUNNEL_HOSTNAME", ""),
		"apiHostname": os.environ.get("TUNNEL_API_HOSTNAME", ""),
		"tunnelId": os.environ.get("TUNNEL_ID", ""),
	},
}
(config_dir / "config.json").write_text(json.dumps(config, indent="\t") + "\n")
def env_value(value: str) -> str:
	return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'
(config_dir / "cloudflared.env").write_text(
	f"TUNNEL_TOKEN={env_value(config['tunnel']['token'])}\n"
	f"TUNNEL_HOSTNAME={env_value(config['tunnel']['hostname'])}\n"
	f"TUNNEL_API_HOSTNAME={env_value(config['tunnel']['apiHostname'])}\n"
	f"TUNNEL_ID={env_value(config['tunnel']['tunnelId'])}\n"
)
PY
	chmod 600 "$CONFIG_DIR/cloudflared.env"
	if [[ -n "$token" ]] && command -v systemctl >/dev/null; then
		systemctl enable --now cloudflared-gpio.service || true
		systemctl restart cloudflared-gpio.service || true
	fi
}

create_cloudflare_tunnel() {
	local uuid="$1" api_token="$2" account_id="$3" zone_id="$4"
	local output
	output="$(
		CLOUDFLARE_API_TOKEN="$api_token" python3 "$SCRIPT_DIR/create-cloudflare-tunnel.py" \
			--account-id "$account_id" \
			--zone-id "$zone_id" \
			--uuid "$uuid"
	)"
	printf '%s\n' "$output"
}

write_secrets_file() {
	local ai_key="$1" github_user="$2" github_token="$3"
	install -d -m 0755 "$CONFIG_DIR"
	umask 077
	cat >"$CONFIG_DIR/secrets.env" <<EOF
GPIO_AI_KEY=$ai_key
GITHUB_URL=https://github.com
GITHUB_USERNAME=$github_user
GITHUB_TOKEN=$github_token
EOF
	chmod 600 "$CONFIG_DIR/secrets.env"
}

ensure_gpio_ai_key() {
	install -d -m 0755 "$CONFIG_DIR"
	local existing=""
	if [[ -f "$CONFIG_DIR/secrets.env" ]]; then
		existing="$(sed -n 's/^GPIO_AI_KEY=//p' "$CONFIG_DIR/secrets.env" | tail -n1)"
	fi
	if [[ -n "$existing" ]]; then
		printf '%s' "$existing"
		return
	fi
	local key
	key="$(openssl rand -hex 32)"
	if [[ -f "$CONFIG_DIR/secrets.env" ]]; then
		if grep -q '^GPIO_AI_KEY=' "$CONFIG_DIR/secrets.env"; then
			sed -i "s/^GPIO_AI_KEY=.*/GPIO_AI_KEY=$key/" "$CONFIG_DIR/secrets.env"
		else
			printf 'GPIO_AI_KEY=%s\n' "$key" >>"$CONFIG_DIR/secrets.env"
		fi
	else
		write_secrets_file "$key" "" ""
	fi
	chmod 600 "$CONFIG_DIR/secrets.env"
	printf '%s' "$key"
}

write_opencode_ai_provider() {
	local key="$1"
	local dest base
	dest="$(opencode_home)"
	base="${GPIO_COMPANION_AI_URL:-https://gpio-companion.com/api/ai/v1}"
	install -d -m 0755 "$dest"
	GPIO_AI_KEY="$key" GPIO_AI_URL="$base" GPIO_OPENCODE_JSON="$dest/opencode.json" python3 - <<'PY'
import json, os
from pathlib import Path
path = Path(os.environ["GPIO_OPENCODE_JSON"])
data = {}
if path.exists():
    try:
        loaded = json.loads(path.read_text())
        if isinstance(loaded, dict):
            data = loaded
    except json.JSONDecodeError:
        data = {}
provider = data.setdefault("provider", {})
if not isinstance(provider, dict):
    provider = {}
    data["provider"] = provider
provider["gpio-companion"] = {
    "npm": "@ai-sdk/openai-compatible",
    "name": "gpio-companion",
    "options": {
        "baseURL": os.environ["GPIO_AI_URL"],
        "apiKey": os.environ["GPIO_AI_KEY"],
    },
    "models": {
        "@cf/zai-org/glm-5.3": {"name": "GLM-5.3"},
    },
}
path.write_text(json.dumps(data, indent="\t") + "\n")
PY
	if [[ "$GPIO_USER" != "root" ]]; then
		chown -R "$GPIO_USER:$GPIO_USER" "$dest"
	fi
}

install_gpio_companion_bin() {
	local src=""
	if [[ -x "$REPO_ROOT/binary/gpio-companion/dist/gpio-companion-linux-arm64" ]]; then
		src="$REPO_ROOT/binary/gpio-companion/dist/gpio-companion-linux-arm64"
	elif [[ -x "$REPO_ROOT/binary/gpio-companion/dist/gpio-companion" ]]; then
		src="$REPO_ROOT/binary/gpio-companion/dist/gpio-companion"
	elif command -v bun >/dev/null 2>&1; then
		(cd "$REPO_ROOT" && bun install)
		(cd "$REPO_ROOT/binary/gpio-companion" && bun run compile)
		src="$REPO_ROOT/binary/gpio-companion/dist/gpio-companion"
	else
		die "gpio-companion binary missing and bun is not installed"
	fi
	install -m 0755 "$src" "$BIN_DIR/gpio-companion"
	install_ble_gatt_script
	install_github_git_helper
}

install_ble_gatt_script() {
	install -d -m 0755 "$LIB_DIR"
	install -m 0755 "$REPO_ROOT/scripts/ble-gatt-server.py" "$LIB_DIR/ble-gatt-server.py"
}

install_github_git_helper() {
	cat >/etc/gitconfig <<EOF
[credential "https://github.com"]
	helper = !/usr/local/bin/gpio-companion git-credential
EOF
}

install_update_wrapper() {
	install -d -m 0755 /usr/local/sbin
	cat >/usr/local/sbin/gpio-companion-update <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
CONFIG_DIR="${GPIO_COMPANION_CONFIG_DIR:-/etc/gpio-companion}"
REPO="$(cat "$CONFIG_DIR/repo.path")"
exec /bin/bash "$REPO/scripts/update-script.sh" "$@"
EOF
	chmod 0755 /usr/local/sbin/gpio-companion-update
	cat >/usr/local/sbin/gpio-companion-force-update <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
CONFIG_DIR="${GPIO_COMPANION_CONFIG_DIR:-/etc/gpio-companion}"
REPO="$(cat "$CONFIG_DIR/repo.path")"
exec /bin/bash "$REPO/scripts/update-script.sh" --force
EOF
	chmod 0755 /usr/local/sbin/gpio-companion-force-update
}

install_systemd_units() {
	local hardware="$1"
	install -m 0644 "$SCRIPT_DIR/systemd/gpio-companion.service" /etc/systemd/system/gpio-companion.service
	install -m 0644 "$SCRIPT_DIR/systemd/cloudflared-gpio.service" /etc/systemd/system/cloudflared-gpio.service
	install -m 0644 "$SCRIPT_DIR/systemd/gpio-companion-update.service" /etc/systemd/system/gpio-companion-update.service
	install -m 0644 "$SCRIPT_DIR/systemd/gpio-companion-update.timer" /etc/systemd/system/gpio-companion-update.timer
	sed -i "s/^Environment=GPIO_COMPANION_HARDWARE=.*/Environment=GPIO_COMPANION_HARDWARE=$hardware/" /etc/systemd/system/gpio-companion.service
	install_update_wrapper
	systemctl daemon-reload
	systemctl enable --now gpio-companion.service
	systemctl enable --now gpio-companion-update.timer
	systemctl disable cloudflared-gpio.service || true
}

install_common() {
	local hardware="$1"
	need_root
	install_apt_base
	install_node
	install_bun
	install_node_gyp
	install_cloudflared
	install_arduino_cli
	install_arduino_udev
	add_user_groups
	install_opencode
	install_t3code
	write_device_config "$hardware"
	write_pairing_env
	write_repo_metadata
	install_gpio_companion_bin
	sync_opencode_agent
	install_systemd_units "$hardware"
	echo "gpio-companion $hardware install complete"
	echo "T3 Code service is installed; pairing runs from the dashboard after claim"
}
