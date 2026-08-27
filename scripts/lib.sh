#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
GPIO_USER="${GPIO_USER:-${SUDO_USER:-root}}"
CONFIG_DIR="${GPIO_COMPANION_CONFIG_DIR:-/etc/gpio-companion}"
BIN_DIR="${GPIO_COMPANION_BIN_DIR:-/usr/local/bin}"

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
		udev
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

install_t3code() {
	npm install -g t3
	if [[ "$GPIO_USER" != "root" ]]; then
		sudo -u "$GPIO_USER" bash -lc 'npx --yes t3@latest service install' || true
	fi
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
EOF
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
		"hostname": ""
	}
}
EOF
	fi
	if [[ ! -f "$CONFIG_DIR/cloudflared.env" ]]; then
		printf "TUNNEL_TOKEN=''\nTUNNEL_HOSTNAME=''\n" >"$CONFIG_DIR/cloudflared.env"
		chmod 600 "$CONFIG_DIR/cloudflared.env"
	fi
}

apply_runtime_config() {
	local hardware="$1" token="$2" hostname="$3"
	install -d -m 0755 "$CONFIG_DIR"
	GPIO_COMPANION_CONFIG_DIR="$CONFIG_DIR" HARDWARE="$hardware" TUNNEL_TOKEN="$token" TUNNEL_HOSTNAME="$hostname" python3 - <<'PY'
import json, os
from pathlib import Path
config_dir = Path(os.environ.get("GPIO_COMPANION_CONFIG_DIR", "/etc/gpio-companion"))
config = {
	"hardware": os.environ["HARDWARE"],
	"tunnel": {
		"token": os.environ.get("TUNNEL_TOKEN", ""),
		"hostname": os.environ.get("TUNNEL_HOSTNAME", ""),
	},
}
(config_dir / "config.json").write_text(json.dumps(config, indent="\t") + "\n")
def env_value(value: str) -> str:
	return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'
(config_dir / "cloudflared.env").write_text(
	f"TUNNEL_TOKEN={env_value(config['tunnel']['token'])}\n"
	f"TUNNEL_HOSTNAME={env_value(config['tunnel']['hostname'])}\n"
)
PY
	chmod 600 "$CONFIG_DIR/cloudflared.env"
	if [[ -n "$token" ]] && command -v systemctl >/dev/null; then
		systemctl enable --now cloudflared-gpio.service || true
		systemctl restart cloudflared-gpio.service || true
	fi
}

write_secrets_file() {
	local opencode_key="$1" gitea_token="$2"
	install -d -m 0755 "$CONFIG_DIR"
	umask 077
	cat >"$CONFIG_DIR/secrets.env" <<EOF
OPENCODE_API_KEY=$opencode_key
GITEA_TOKEN=$gitea_token
EOF
	chmod 600 "$CONFIG_DIR/secrets.env"
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
}

install_update_wrapper() {
	install -d -m 0755 /usr/local/sbin
	cat >/usr/local/sbin/gpio-companion-update <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
CONFIG_DIR="${GPIO_COMPANION_CONFIG_DIR:-/etc/gpio-companion}"
REPO="$(cat "$CONFIG_DIR/repo.path")"
exec /bin/bash "$REPO/scripts/update-script.sh"
EOF
	chmod 0755 /usr/local/sbin/gpio-companion-update
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
	write_repo_metadata
	install_gpio_companion_bin
	sync_opencode_agent
	install_systemd_units "$hardware"
	echo "gpio-companion $hardware install complete"
	echo "set tunnel replica: PUT http://<device>:4150/v1/config/tunnel {\"token\":\"...\",\"hostname\":\"...\"}"
	echo "t3code pairing is managed from the dashboard"
}
