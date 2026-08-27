#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

need_root
install_common raspberrypi
apt_install_optional pigpio python3-pigpio raspi-gpio python3-rpi.gpio
echo "raspberry pi GPIO packages done"
