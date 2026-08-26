#!/usr/bin/env bash
# ==============================================================================
# LookARemote — Linux udev & uinput Permission Setup Script
# ==============================================================================
# Configures system permissions allowing LookARemote Host Daemon to access
# /dev/uinput (virtual Xbox 360 controller, mouse, and keyboard) without sudo.
# ==============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║      LOOKAREMOTE — LINUX UDEV & UINPUT HARDENING SETUP        ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# 1. Determine target non-root user
if [ "${SUDO_USER:-}" != "" ]; then
    TARGET_USER="$SUDO_USER"
else
    TARGET_USER="$(whoami)"
fi

if [ "$EUID" -ne 0 ]; then
    echo -e "${YELLOW}Notice: Elevating privileges with sudo...${NC}"
    exec sudo bash "$0" "$@"
fi

# 2. Ensure uinput kernel module is loaded
echo -e "  [1/4] Ensuring '${BLUE}uinput${NC}' kernel module is loaded..."
modprobe uinput || true

# Persist module load across reboots
if [ -d /etc/modules-load.d ]; then
    echo "uinput" > /etc/modules-load.d/lookaremote-uinput.conf
    echo -e "        ${GREEN}✓${NC} Added uinput to /etc/modules-load.d/lookaremote-uinput.conf"
fi

# 3. Ensure 'input' group exists
echo -e "  [2/4] Verifying '${BLUE}input${NC}' system group..."
if ! getent group input > /dev/null 2>&1; then
    groupadd -r input
    echo -e "        ${GREEN}✓${NC} Created 'input' group"
else
    echo -e "        ${GREEN}✓${NC} 'input' group already exists"
fi

# 4. Add target user to 'input' group
if [ "$TARGET_USER" != "root" ]; then
    echo -e "  [3/4] Adding user '${BLUE}${TARGET_USER}${NC}' to 'input' group..."
    usermod -aG input "$TARGET_USER"
    echo -e "        ${GREEN}✓${NC} User '${TARGET_USER}' added to 'input' group"
else
    echo -e "  [3/4] Running directly as root, skipping group addition."
fi

# 5. Write udev rule
UDEV_RULE_FILE="/etc/udev/rules.d/99-lookaremote.rules"
echo -e "  [4/4] Installing udev rule to '${BLUE}${UDEV_RULE_FILE}${NC}'..."

cat << 'EOF' > "$UDEV_RULE_FILE"
# LookARemote uinput rules for non-root virtual gamepad/mouse/keyboard emulation
KERNEL=="uinput", SUBSYSTEM=="misc", TAG+="uaccess", GROUP="input", MODE="0660"
KERNEL=="event*", SUBSYSTEM=="input", GROUP="input", MODE="0660"
EOF

# Reload and trigger udev
udevadm control --reload-rules || true
udevadm trigger /dev/uinput 2>/dev/null || true

echo ""
echo -e "${GREEN}═════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ LookARemote Linux udev rules installed successfully!${NC}"
echo -e "${GREEN}═════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}IMPORTANT:${NC} If you were just added to the 'input' group, please log out"
echo -e "and log back in (or run 'newgrp input') for permissions to take effect."
echo ""
