#!/usr/bin/env bash
set -euo pipefail

MARKER="${GPIO_COMPANION_SETUP_MARKER:-/etc/gpio-companion/first-setup-complete}"
REPO_URL="${GPIO_COMPANION_REPO_URL:-https://github.com/shpaw415/gpio-companion.git}"
BRANCH="${GPIO_COMPANION_BRANCH:-main}"
DEST="${GPIO_COMPANION_REPO:-/opt/gpio-companion}"

if [[ -f "$MARKER" ]]; then
	exit 0
fi

if [[ "$(id -u)" -ne 0 ]]; then
	echo "gpio-companion first-boot: run as root" >&2
	exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends git ca-certificates

if [[ ! -d "$DEST/.git" ]]; then
	git clone --branch "$BRANCH" --depth 1 "$REPO_URL" "$DEST"
else
	git -C "$DEST" fetch origin "$BRANCH" || true
	git -C "$DEST" checkout "$BRANCH" || true
fi

exec /bin/bash "$DEST/scripts/first-setup.sh"
