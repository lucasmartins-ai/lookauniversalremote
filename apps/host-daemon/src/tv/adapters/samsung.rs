//! Samsung Smart TV (Tizen) Adapter implementation.

use crate::tv::adapters::traits::{TvAdapter, TvCommandResult, TvError};
use crate::tv::commands::samsung_key_for_command;
use crate::tv::discovery::models::TvDevice;
use async_trait::async_trait;
use futures_util::SinkExt;
use lookaremote_protocol::messages::tv_target_devices::SAMSUNG_TIZEN;
use std::sync::RwLock;
use std::time::Duration;
use tokio_tungstenite::tungstenite::Message;
use tracing::{debug, error, info, warn};

/// Samsung Tizen TV platform adapter.
pub struct SamsungTizenAdapter {
    tv_ip: RwLock<Option<String>>,
    token: RwLock<Option<String>>,
    app_name_b64: String,
}

impl Default for SamsungTizenAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl SamsungTizenAdapter {
    /// Create a new Samsung Tizen adapter.
    pub fn new() -> Self {
        // "LookARemote" encoded in Base64
        let app_name_b64 = "TG9va0FSZW1vdGU=".to_string();
        Self {
            tv_ip: RwLock::new(None),
            token: RwLock::new(None),
            app_name_b64,
        }
    }

    /// Construct the remote control WebSocket URL for a given target IP.
    fn build_ws_url(&self, ip: &str) -> String {
        let token_opt = self.token.read().ok().and_then(|t| t.clone());
        if let Some(token) = token_opt {
            format!(
                "ws://{}:8001/api/v2/channels/samsung.remote.control?name={}&token={}",
                ip, self.app_name_b64, token
            )
        } else {
            format!(
                "ws://{}:8001/api/v2/channels/samsung.remote.control?name={}",
                ip, self.app_name_b64
            )
        }
    }

    /// Get current target IP.
    fn get_ip(&self) -> Result<String, TvError> {
        self.tv_ip
            .read()
            .map_err(|_| TvError::Internal("Lock poisoned".into()))?
            .clone()
            .ok_or_else(|| TvError::Unreachable("No Samsung TV IP configured".into()))
    }
}

#[async_trait]
impl TvAdapter for SamsungTizenAdapter {
    fn brand(&self) -> &'static str {
        "Samsung"
    }

    fn protocol_id(&self) -> u8 {
        SAMSUNG_TIZEN
    }

    async fn connect(&self, device: &TvDevice) -> Result<(), TvError> {
        let mut lock = self
            .tv_ip
            .write()
            .map_err(|_| TvError::Internal("Lock poisoned".into()))?;
        *lock = Some(device.ip.clone());
        info!(ip = %device.ip, "Connected Samsung Tizen Adapter to device");
        Ok(())
    }

    async fn disconnect(&self) -> Result<(), TvError> {
        let mut lock = self
            .tv_ip
            .write()
            .map_err(|_| TvError::Internal("Lock poisoned".into()))?;
        *lock = None;
        Ok(())
    }

    async fn pair(&self, _pin: Option<&str>) -> Result<String, TvError> {
        let ip = self.get_ip()?;
        let ws_url = self.build_ws_url(&ip);

        debug!(url = %ws_url, "Initiating Samsung TV SmartView registration handshake");
        match tokio::time::timeout(
            Duration::from_secs(5),
            tokio_tungstenite::connect_async(&ws_url),
        )
        .await
        {
            Ok(Ok((_ws_stream, _))) => {
                info!("Samsung SmartView pairing connection accepted by TV");
                Ok("paired".to_string())
            }
            Ok(Err(e)) => {
                warn!("Samsung pairing connection rejected: {e}");
                Err(TvError::PairingRequired(format!(
                    "Samsung TV rejected pairing: {e}"
                )))
            }
            Err(_) => Err(TvError::Timeout("Samsung pairing request timed out".into())),
        }
    }

    fn is_paired(&self) -> bool {
        self.token.read().map(|t| t.is_some()).unwrap_or(false)
    }

    async fn send_command(&self, cmd: u16) -> Result<TvCommandResult, TvError> {
        let ip = self.get_ip()?;
        let key = samsung_key_for_command(cmd)
            .ok_or_else(|| TvError::UnsupportedCommand(format!("Command code: {cmd}")))?;

        let payload = serde_json::json!({
            "method": "ms.remote.control",
            "params": {
                "Cmd": "Click",
                "DataOfCmd": key,
                "Option": "false",
                "TypeOfRemote": "SendRemoteKey"
            }
        });

        let ws_url = self.build_ws_url(&ip);
        let payload_str = payload.to_string();

        match tokio::time::timeout(
            Duration::from_millis(600),
            tokio_tungstenite::connect_async(&ws_url),
        )
        .await
        {
            Ok(Ok((mut ws_stream, _))) => {
                if let Err(e) = ws_stream.send(Message::Text(payload_str.into())).await {
                    error!("Failed to transmit key to Samsung TV: {e}");
                    return Err(TvError::ConnectionFailed(e.to_string()));
                }
                debug!(ip = %ip, key = key, "Dispatched key to Samsung Tizen TV");
                Ok(TvCommandResult::Sent)
            }
            Ok(Err(e)) => {
                warn!("Failed to establish WebSocket to Samsung TV at {ip}: {e}");
                Err(TvError::ConnectionFailed(e.to_string()))
            }
            Err(_) => Err(TvError::Timeout(format!(
                "Timeout connecting to Samsung TV at {ip}"
            ))),
        }
    }

    async fn send_text(&self, text: &str) -> Result<TvCommandResult, TvError> {
        let ip = self.get_ip()?;
        let text_b64 = hex::encode(text.as_bytes()); // or base64
        let payload = serde_json::json!({
            "method": "ms.remote.control",
            "params": {
                "Cmd": "SendText",
                "DataOfCmd": text_b64,
                "TypeOfRemote": "SendRemoteKey"
            }
        });

        let ws_url = self.build_ws_url(&ip);
        let payload_str = payload.to_string();

        if let Ok(Ok((mut ws_stream, _))) = tokio::time::timeout(
            Duration::from_millis(600),
            tokio_tungstenite::connect_async(&ws_url),
        )
        .await
        {
            let _ = ws_stream.send(Message::Text(payload_str.into())).await;
            Ok(TvCommandResult::Sent)
        } else {
            Err(TvError::Timeout(
                "Timeout sending text to Samsung TV".into(),
            ))
        }
    }

    fn get_capabilities(&self) -> Vec<String> {
        vec![
            "keys".to_string(),
            "text_input".to_string(),
            "apps".to_string(),
            "power".to_string(),
            "media".to_string(),
        ]
    }

    async fn health_check(&self) -> Result<bool, TvError> {
        let ip = self.get_ip()?;
        let client = reqwest::Client::builder()
            .timeout(Duration::from_millis(400))
            .build()
            .unwrap_or_default();

        let res = client
            .get(format!("http://{}:8001/api/v2/", ip))
            .send()
            .await;
        Ok(res.map(|r| r.status().is_success()).unwrap_or(false))
    }
}
