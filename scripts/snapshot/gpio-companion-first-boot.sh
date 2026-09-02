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
elif [[ -f "$DEST/scripts/lib.sh" ]]; then
	# shellcheck source=../lib.sh
	source "$DEST/scripts/lib.sh"
	REPO_ROOT="$DEST"
	sync_managed_checkout "$DEST" "$BRANCH" || true
else
	find "$DEST/.git/objects" -type f -empty -delete 2>/dev/null || true
	git -C "$DEST" fetch --depth 1 origin "$BRANCH" || true
	git -C "$DEST" checkout "$BRANCH" || true
fi

exec /bin/bash "$DEST/scripts/first-setup.sh"
