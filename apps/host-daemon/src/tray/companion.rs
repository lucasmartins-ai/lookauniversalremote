//! Desktop System Tray Companion Implementation for LookARemote.

use crate::context::TargetControlMode;
use crate::core::state::AppState;
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use tracing::{error, info, warn};
use tray_item::TrayItem;

/// Configuration options for the Desktop System Tray Companion.
#[derive(Debug, Clone)]
pub struct TrayConfig {
    /// Title displayed on macOS menu bar / Windows tooltip
    pub title: String,
    /// Whether system tray companion is enabled
    pub enabled: bool,
}

impl Default for TrayConfig {
    fn default() -> Self {
        Self {
            title: "LookARemote".to_string(),
            enabled: true,
        }
    }
}

/// Desktop System Tray Companion managing background status updates and context menu actions.
pub struct TrayCompanion {
    _tray: TrayItem,
}

impl TrayCompanion {
    /// Spawns the desktop system tray companion on a dedicated background thread.
    /// Returns immediately without blocking the Tokio asynchronous runtime.
    pub fn spawn(state: AppState) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        thread::spawn(move || {
            let app_title = "LookARemote";

            // Initialize native tray item directly on the tray thread
            let mut tray = match TrayItem::new(app_title, tray_item::IconSource::Resource("")) {
                Ok(t) => t,
                Err(e) => {
                    warn!("System tray is not supported or failed to initialize (e.g. headless environment): {e}");
                    return;
                }
            };

            info!("Desktop System Tray Companion initialized");

            // 1. Header Label
            let _ = tray.add_label("LookARemote — 120Hz Party Mode");

            // 2. Action: Connect New Device (Display QR Code in browser)
            let state_for_qr = state.clone();
            let _ = tray.add_menu_item("📱 Conectar Novo Dispositivo (Exibir QR Code)", move || {
                let port = state_for_qr.config.port;
                let host_ip = state_for_qr
                    .config
                    .bind_addr
                    .map(|ip| ip.to_string())
                    .unwrap_or_else(|| "127.0.0.1".to_string());
                let qr_url = format!("http://{}:{}/qr", host_ip, port);
                info!("Opening QR Code Pairing Page: {qr_url}");
                if let Err(e) = open::that(&qr_url) {
                    error!("Failed to open QR Code in browser: {e}");
                }
            });

            // 3. Status Info: View Connected Devices (X/4)
            let state_for_status = state.clone();
            let _ = tray.add_menu_item("👥 Ver Dispositivos Conectados", move || {
                let mp = state_for_status.multi_peer.clone();
                tokio::spawn(async move {
                    let lock = mp.read().await;
                    let active = lock.active_count();
                    info!("=== Dispositivos Conectados ({active}/4) ===");
                    for summary in lock.summaries() {
                        info!(
                            " • {} ({}) - IP: {} - RTT: {}ms - Bateria: {}% ({:?})",
                            summary.player_label,
                            summary.color_hex,
                            summary.client_ip.as_deref().unwrap_or("N/A"),
                            summary.rtt_ms,
                            summary.battery_level.unwrap_or(0),
                            summary.state,
                        );
                    }
                });
            });

            // 4. Quick Mode Switchers
            let state_for_gamepad = state.clone();
            let _ = tray.add_menu_item("🎮 Forçar Modo Gamepad", move || {
                if let Some(ref watcher) = state_for_gamepad.context_watcher {
                    let w = Arc::clone(watcher);
                    tokio::spawn(async move {
                        w.set_manual_override(Some(TargetControlMode::Gamepad)).await;
                        info!("Tray manually set active mode to: Gamepad");
                    });
                }
            });

            let state_for_trackpad = state.clone();
            let _ = tray.add_menu_item("🖱️ Forçar Modo Trackpad", move || {
                if let Some(ref watcher) = state_for_trackpad.context_watcher {
                    let w = Arc::clone(watcher);
                    tokio::spawn(async move {
                        w.set_manual_override(Some(TargetControlMode::Trackpad)).await;
                        info!("Tray manually set active mode to: Trackpad");
                    });
                }
            });

            let state_for_auto = state.clone();
            let _ = tray.add_menu_item("🔄 Modo Automático (Smart Context)", move || {
                if let Some(ref watcher) = state_for_auto.context_watcher {
                    let w = Arc::clone(watcher);
                    tokio::spawn(async move {
                        w.set_manual_override(None).await;
                        info!("Tray restored Smart Context auto-detection mode");
                    });
                }
            });

            // 5. Open Configuration (config.toml)
            let _ = tray.add_menu_item("⚙️ Abrir Configurações (config.toml)", move || {
                info!("Opening config.toml in default editor");
                if let Err(e) = open::that("config.toml") {
                    warn!("Failed to open config.toml: {e}");
                }
            });

            // 6. Graceful Exit
            let _ = tray.add_menu_item("🚪 Sair do LookARemote", move || {
                info!("Exit requested from System Tray Companion. Shutting down...");
                std::process::exit(0);
            });

            let _companion = TrayCompanion { _tray: tray };
            loop {
                thread::sleep(Duration::from_secs(1));
            }
        });

        Ok(())
    }
}
