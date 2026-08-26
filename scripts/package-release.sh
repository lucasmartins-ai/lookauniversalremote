#!/usr/bin/env bash
# ==============================================================================
# LookARemote — Local Release Packaging Automation Script
# ==============================================================================
# Builds release binaries, PWA bundles, and packages distribution archives
# with SHA-256 checksum verification.
# ==============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="${ROOT_DIR}/dist-release"
VERSION="0.1.0"

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║      LOOKAREMOTE — RELEASE PACKAGING AUTOMATION (v${VERSION})      ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# 1. Clean previous release artifacts
echo -e "  [1/5] Preparing output directory: ${BLUE}${DIST_DIR}${NC}..."
rm -rf "${DIST_DIR}"
mkdir -p "${DIST_DIR}"

# 2. Build Host Daemon Release Binary
echo -e "  [2/5] Building Host Daemon Release Binary (Rust, LTO, Strip)..."
cargo build --release --bin lookaremote-host-daemon --workspace

HOST_BIN="${ROOT_DIR}/target/release/lookaremote-host-daemon"
if [ ! -f "${HOST_BIN}" ]; then
    HOST_BIN="${ROOT_DIR}/target/release/lookaremote-host-daemon.exe"
fi

OS_NAME="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH_NAME="$(uname -m)"

STAGE_DIR="${DIST_DIR}/lookaremote-host-daemon-${VERSION}-${OS_NAME}-${ARCH_NAME}"
mkdir -p "${STAGE_DIR}"
cp "${HOST_BIN}" "${STAGE_DIR}/"
cp "${ROOT_DIR}/config.toml" "${STAGE_DIR}/"
cp "${ROOT_DIR}/README.md" "${STAGE_DIR}/" 2>/dev/null || true
if [ -d "${ROOT_DIR}/scripts" ]; then
    cp -r "${ROOT_DIR}/scripts" "${STAGE_DIR}/"
fi

# Package host archive
echo -e "  [3/5] Packaging Host Daemon archive..."
tar -czf "${DIST_DIR}/lookaremote-host-daemon-${VERSION}-${OS_NAME}-${ARCH_NAME}.tar.gz" -C "${DIST_DIR}" "lookaremote-host-daemon-${VERSION}-${OS_NAME}-${ARCH_NAME}"
rm -rf "${STAGE_DIR}"
echo -e "        ${GREEN}✓${NC} Created ${DIST_DIR}/lookaremote-host-daemon-${VERSION}-${OS_NAME}-${ARCH_NAME}.tar.gz"

# 3. Build PWA Web Client
echo -e "  [4/5] Building PWA Web Client (Vite, Rollup chunks, Workbox)..."
npm run build --workspaces --if-present

PWA_DIST="${ROOT_DIR}/apps/web-client/dist"
if [ -d "${PWA_DIST}" ]; then
    (cd "${PWA_DIST}" && zip -r "${DIST_DIR}/lookaremote-pwa-web-client-${VERSION}.zip" . > /dev/null)
    echo -e "        ${GREEN}✓${NC} Created ${DIST_DIR}/lookaremote-pwa-web-client-${VERSION}.zip"
fi

# 4. Generate SHA256 Checksums
echo -e "  [5/5] Generating SHA-256 Checksums..."
(cd "${DIST_DIR}" && shasum -a 256 *.tar.gz *.zip > SHA256SUMS.txt 2>/dev/null || sha256sum *.tar.gz *.zip > SHA256SUMS.txt)

echo ""
echo -e "${GREEN}═════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Release Packaging Completed Successfully!${NC}"
echo -e "${GREEN}═════════════════════════════════════════════════════════════════${NC}"
echo ""
cat "${DIST_DIR}/SHA256SUMS.txt"
echo ""
