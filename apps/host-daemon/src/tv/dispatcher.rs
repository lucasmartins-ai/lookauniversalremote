//! Live Smart TV Network Command & Text Input Dispatcher.

use crate::tv::commands::{
    android_keycode_for_command, lg_key_for_command, roku_keypress_for_command,
    samsung_key_for_command,
};
use lookaremote_protocol::messages::tv_commands;
use lookaremote_protocol::messages::tv_target_devices::*;
use lookaremote_protocol::messages::{TvCommandMessage, TvTextInputMessage};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::RwLock;
use std::time::Duration;
use tracing::{debug, info};

/// Smart TV Dispatcher metrics and statistics.
#[derive(Debug, Default)]
pub struct TvDispatcherStats {
    /// Total TV commands dispatched.
    pub commands_dispatched: AtomicU64,
    /// Total TV text input strings dispatched.
    pub text_inputs_dispatched: AtomicU64,
}

/// Core Smart TV Dispatcher routing commands to active Smart TVs or desktop emulators.
pub struct TvDispatcher {
    stats: TvDispatcherStats,
    tv_ip: RwLock<String>,
    http_client: reqwest::Client,
}

impl Default for TvDispatcher {
    fn default() -> Self {
        Self::new()
    }
}

impl TvDispatcher {
    /// Create a new TV dispatcher initialized with detected or default TV IP (192.168.1.102).
    pub fn new() -> Self {
        let http_client = reqwest::Client::builder()
            .timeout(Duration::from_millis(500))
            .build()
            .unwrap_or_default();

        Self {
            stats: TvDispatcherStats::default(),
            tv_ip: RwLock::new("192.168.1.102".to_string()),
            http_client,
        }
    }

    /// Set the target Smart TV IP address dynamically.
    pub fn set_tv_ip(&self, ip: String) {
        if let Ok(mut lock) = self.tv_ip.write() {
            info!("Updated Target Smart TV IP to: {ip}");
            *lock = ip;
        }
    }

    /// Get the current target Smart TV IP address.
    pub fn get_tv_ip(&self) -> String {
        self.tv_ip.read().map(|s| s.clone()).unwrap_or_else(|_| "192.168.1.102".to_string())
    }

    /// Dispatch a TV command message to the specified target TV device over the local network.
    pub fn dispatch_command(&self, msg: &TvCommandMessage) -> Result<String, String> {
        self.stats.commands_dispatched.fetch_add(1, Ordering::Relaxed);
        let tv_ip = self.get_tv_ip();

        match msg.target_device {
            ANDROID_GOOGLE_TV => {
                if let Some(keycode) = android_keycode_for_command(msg.command_code) {
                    let cmd_str = format!("input keyevent {}", keycode);
                    let ip_clone = tv_ip.clone();
                    let client = self.http_client.clone();

                    if tokio::runtime::Handle::try_current().is_ok() {
                        tokio::spawn(async move {
                            // 1. Try sending via Google Cast HTTP Remote endpoint (port 8008 / 8009)
                            let cast_endpoint = format!("http://{}:8008/setup/app_command", ip_clone);
                            let _ = client
                                .post(&cast_endpoint)
                                .json(&serde_json::json!({ "keycode": keycode, "action": "click" }))
                                .send()
                                .await;

                            // 2. Try raw TCP ADB / Remote command on standard ports
                            if let Ok(mut stream) = tokio::net::TcpStream::connect(format!("{}:5555", ip_clone)).await {
                                use tokio::io::AsyncWriteExt;
                                let raw_adb_cmd = format!("shell:input keyevent {}\n", keycode);
                                let _ = stream.write_all(raw_adb_cmd.as_bytes()).await;
                            }

                            debug!(ip = %ip_clone, keycode = keycode, "Dispatched Android TV keyevent over network");
                        });
                    }

                    Ok(cmd_str)
                } else {
                    Err(format!("Unsupported Android TV command: {}", msg.command_code))
                }
            }

            SAMSUNG_TIZEN => {
                if let Some(key) = samsung_key_for_command(msg.command_code) {
                    let payload = format!(
                        r#"{{"method":"ms.remote.control","params":{{"Cmd":"Click","DataOfCmd":"{}","Option":"false","TypeOfRemote":"SendRemoteKey"}}}}"#,
                        key
                    );
                    let ip_clone = tv_ip.clone();
                    let key_clone = key.to_string();

                    if tokio::runtime::Handle::try_current().is_ok() {
                        tokio::spawn(async move {
                            let ws_url = format!("ws://{}:8001/api/v2/channels/samsung.remote.control?name=TG9va0FSZW1vdGU=", ip_clone);
                            if let Ok((mut ws_stream, _)) = tokio_tungstenite::connect_async(&ws_url).await {
                                use futures_util::SinkExt;
                                use tokio_tungstenite::tungstenite::Message;
                                let msg = format!(
                                    r#"{{"method":"ms.remote.control","params":{{"Cmd":"Click","DataOfCmd":"{}","Option":"false","TypeOfRemote":"SendRemoteKey"}}}}"#,
                                    key_clone
                                );
                                let _ = ws_stream.send(Message::Text(msg.into())).await;
                            }
                        });
                    }

                    Ok(payload)
                } else {
                    Err(format!("Unsupported Samsung TV command: {}", msg.command_code))
                }
            }

            LG_WEBOS => {
                if let Some(key) = lg_key_for_command(msg.command_code) {
                    let payload = format!(
                        r#"{{"type":"request","uri":"ssap://com.webos.service.remoteinput/sendKey","payload":{{"key":"{}"}}}}"#,
                        key
                    );
                    let ip_clone = tv_ip.clone();
                    let key_clone = key.to_string();

                    if tokio::runtime::Handle::try_current().is_ok() {
                        tokio::spawn(async move {
                            let ws_url = format!("ws://{}:3000", ip_clone);
                            if let Ok((mut ws_stream, _)) = tokio_tungstenite::connect_async(&ws_url).await {
                                use futures_util::SinkExt;
                                use tokio_tungstenite::tungstenite::Message;
                                let msg = format!(
                                    r#"{{"type":"request","id":"1","uri":"ssap://com.webos.service.remoteinput/sendKey","payload":{{"key":"{}"}}}}"#,
                                    key_clone
                                );
                                let _ = ws_stream.send(Message::Text(msg.into())).await;
                            }
                        });
                    }

                    Ok(payload)
                } else {
                    Err(format!("Unsupported LG webOS TV command: {}", msg.command_code))
                }
            }

            ROKU_TV => {
                if let Some(key) = roku_keypress_for_command(msg.command_code) {
                    let endpoint = format!("http://{}:8060/keypress/{}", tv_ip, key);
                    let client = self.http_client.clone();
                    let endpoint_clone = endpoint.clone();

                    if tokio::runtime::Handle::try_current().is_ok() {
                        tokio::spawn(async move {
                            let _ = client.post(&endpoint_clone).send().await;
                        });
                    }

                    Ok(format!("POST /keypress/{}", key))
                } else {
                    Err(format!("Unsupported Roku TV command: {}", msg.command_code))
                }
            }

            SONY_BRAVIA | GENERIC_TV | DESKTOP_PC_MAC | _ => {
                let label = match msg.command_code {
                    tv_commands::POWER => "POWER",
                    tv_commands::HOME => "HOME",
                    tv_commands::VOLUME_UP => "VOL_UP",
                    tv_commands::VOLUME_DOWN => "VOL_DOWN",
                    tv_commands::MUTE => "MUTE",
                    tv_commands::CHANNEL_UP => "CH_UP",
                    tv_commands::CHANNEL_DOWN => "CH_DOWN",
                    tv_commands::OK_ENTER => "ENTER",
                    tv_commands::BACK => "ESCAPE",
                    _ => "GENERIC_TV_CMD",
                };
                Ok(format!("FALLBACK_ACTION:{}", label))
            }
        }
    }

    /// Dispatch a TV text input string to search or input fields on the TV over network.
    pub fn dispatch_text_input(&self, msg: &TvTextInputMessage) -> Result<String, String> {
        self.stats.text_inputs_dispatched.fetch_add(1, Ordering::Relaxed);
        let text = msg.as_str().to_string();
        let tv_ip = self.get_tv_ip();
        let client = self.http_client.clone();
        let text_clone = text.clone();

        if tokio::runtime::Handle::try_current().is_ok() {
            tokio::spawn(async move {
                if let Ok(mut stream) = tokio::net::TcpStream::connect(format!("{}:5555", tv_ip)).await {
                    use tokio::io::AsyncWriteExt;
                    let raw_text_cmd = format!("shell:input text '{}'\n", text_clone);
                    let _ = stream.write_all(raw_text_cmd.as_bytes()).await;
                }

                let roku_text_endpoint = format!("http://{}:8060/input?text={}", tv_ip, urlencoding_simple(&text_clone));
                let _ = client.post(&roku_text_endpoint).send().await;
            });
        }

        Ok(format!("TV_TEXT_INJECT:{}", text))
    }

    /// Get total commands dispatched count.
    pub fn total_commands(&self) -> u64 {
        self.stats.commands_dispatched.load(Ordering::Relaxed)
    }

    /// Get total text inputs dispatched count.
    pub fn total_text_inputs(&self) -> u64 {
        self.stats.text_inputs_dispatched.load(Ordering::Relaxed)
    }
}

fn urlencoding_simple(s: &str) -> String {
    s.replace(' ', "%20")
}
