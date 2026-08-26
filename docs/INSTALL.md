# LookARemote Installation & Platform Setup Guide

Welcome to **LookARemote**, the ultra-low-latency, zero-install smartphone remote controller ecosystem for PC, Mac, and Linux.

---

## 1. Overview & Architecture

LookARemote operates as a decoupled host-client system:
- **Host Daemon (`apps/host-daemon`):** A high-performance Rust daemon providing local WebRTC signaling, ephemeral X25519 pairing, dead-man watchdog safety, smart context detection, and native OS virtual drivers.
- **Client App (`apps/web-client`):** A zero-install, OLED-optimized PWA running in your mobile browser with 120Hz inputs, IMU gyroscope aiming, multi-touch trackpad, full keyboard deck, and media controls.

Communication happens directly over your local Wi-Fi / LAN via **un-ordered, zero-retransmit WebRTC DataChannels** with sub-millisecond codec latency and end-to-end encryption.

---

## 2. Host Daemon Installation

### Linux (Ubuntu, Debian, Fedora, Arch, SteamOS)

#### Step 1: Install uinput Permissions (udev)
To allow LookARemote to create virtual Xbox 360 controllers, mice, and keyboards without `sudo`, run the automated udev configuration script:
```bash
./scripts/setup-linux-udev.sh
```
*Note: If your user was just added to the `input` group, log out and log back in or run `newgrp input`.*

#### Step 2: Run the Host Daemon
```bash
# Direct execution
cargo run --release -p lookaremote-host-daemon

# Or with custom port
lookaremote-host-daemon --port 8765
```

#### Step 3: (Optional) Auto-start via systemd User Service
```bash
mkdir -p ~/.config/systemd/user
cp scripts/lookaremote.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now lookaremote.service
```

---

### Windows (10 / 11)

#### Step 1: Optional Virtual Xbox 360 Controller Driver (ViGEmBus)
For native Xbox 360 virtual gamepad emulation in games:
1. Download and run the **ViGEmBus installer** from [ViGEmBus Releases](https://github.com/nefarius/ViGEmBus/releases).
2. Complete the setup wizard and restart if prompted.
*(Note: If ViGEmBus is not installed, LookARemote seamlessly operates in Trackpad, Mouse, Keyboard, and Media mode using native Win32 `SendInput`).*

#### Step 2: Run the Host Daemon
```cmd
lookaremote-host-daemon.exe
```

#### Step 3: Windows Defender Firewall
When prompted by Windows Defender Firewall on first launch, allow LookARemote on **Private Networks**.

---

### macOS (Apple Silicon M1/M2/M3/M4 & Intel)

#### Step 1: Grant Accessibility (TCC) Permissions
macOS requires Accessibility permissions for CoreGraphics to inject synthetic mouse movements and keystrokes:
1. Open **System Settings (Ajustes do Sistema)**.
2. Navigate to **Privacy & Security > Accessibility (Privacidade e Segurança > Acessibilidade)**.
3. Toggle ON your **Terminal** app (e.g., Terminal, iTerm2, Warp) or the `lookaremote-host-daemon` binary.

#### Step 2: Run the Host Daemon
```bash
cargo run --release -p lookaremote-host-daemon
```

---

## 3. Mobile PWA Client Setup (iOS & Android)

No app store downloads or developer accounts required. LookARemote runs directly from the browser!

### Step 1: Connect to the Same Local Network
Ensure your mobile phone is connected to the same Wi-Fi router / subnet as your host computer.

### Step 2: Pair Device
1. Look at your host daemon terminal — an ASCII QR code is displayed automatically.
2. Open your smartphone camera or navigate to the displayed pairing URL:
   ```text
   http://<YOUR_HOST_IP>:8765
   ```
3. Tap **Connect** to perform the zero-trust ephemeral X25519 + HMAC-SHA256 handshake.

### Step 3: Install as PWA (Standalone Fullscreen OLED)
- **iOS (Safari):** Tap the **Share** button $\to$ tap **Add to Home Screen (Adicionar à Tela de Início)** $\to$ Open the LookARemote icon on your home screen.
- **Android (Chrome):** Tap the three-dot menu $\to$ tap **Install App / Add to Home Screen** $\to$ Open from your app drawer.

*Installing as a PWA enables fullscreen immersive mode, disables iOS gesture bars, locks screen wake, and enables 120Hz touch sampling.*

### Step 4: Enable Motion / Gyroscope (iOS)
On iOS Safari, tap **Allow** when prompted for "Motion & Orientation Access" to enable Gyro Aiming.

---

## 4. Configuration (`config.toml`)

LookARemote features the **Smart Context Engine**, which automatically switches controller layouts when active host applications change.

Edit `config.toml` in your working directory:
```toml
[daemon]
poll_interval_ms = 200
debounce_ms = 400
default_mode = "Gamepad"

[[profiles]]
name = "Counter-Strike 2"
process_name = "cs2"
title_regex = "Counter-Strike"
mode = "Gamepad"
priority = 10

[[profiles]]
name = "VLC Media Player"
process_name = "vlc"
title_regex = ".*"
mode = "Media"
priority = 10
```

---

## 5. Troubleshooting & FAQ

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| **PWA cannot reach host** | Wi-Fi Client Isolation or Firewall | Ensure both devices are on the same Wi-Fi network and port `8765` is allowed in your host firewall. |
| **Linux `/dev/uinput` permission denied** | User not in `input` group | Run `./scripts/setup-linux-udev.sh` and log out/log back in. |
| **macOS mouse/keyboard does not move** | Missing Accessibility permissions | Enable Terminal / Host Daemon in **System Settings > Privacy & Security > Accessibility**. |
| **Gyro aiming drifting** | Sensor zero-rate offset | Open **Settings > Gyroscope Tab** on mobile and tap **Calibrate Sensor Bias** while leaving phone flat for 2 seconds. |
| **WebRTC disconnects on backgrounding** | OS battery saving suspension | Keep LookARemote open in foreground or install as standalone PWA. |
