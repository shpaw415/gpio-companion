#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

need_root
install_common orangepi
apt_install_optional wiringpi wiringop python3-orangepi-gpio
echo "orange pi GPIO packages done"
