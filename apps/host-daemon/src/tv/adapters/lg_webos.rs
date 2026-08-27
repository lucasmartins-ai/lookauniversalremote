//! LG Smart TV (webOS) SSAP Adapter implementation.

use crate::tv::adapters::traits::{TvAdapter, TvCommandResult, TvError};
use crate::tv::commands::lg_key_for_command;
use crate::tv::discovery::models::TvDevice;
use async_trait::async_trait;
use futures_util::{SinkExt, StreamExt};
use lookaremote_protocol::messages::tv_target_devices::LG_WEBOS;
use std::sync::RwLock;
use std::time::Duration;
use tokio_tungstenite::tungstenite::Message;
use tracing::{debug, error, info};

/// LG webOS SSAP TV platform adapter.
pub struct LgWebOsAdapter {
    tv_ip: RwLock<Option<String>>,
    client_key: RwLock<Option<String>>,
}

impl Default for LgWebOsAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl LgWebOsAdapter {
    /// Create a new LG webOS adapter.
    pub fn new() -> Self {
        Self {
            tv_ip: RwLock::new(None),
            client_key: RwLock::new(None),
        }
    }

    fn get_ip(&self) -> Result<String, TvError> {
        self.tv_ip
            .read()
            .map_err(|_| TvError::Internal("Lock poisoned".into()))?
            .clone()
            .ok_or_else(|| TvError::Unreachable("No LG webOS TV IP configured".into()))
    }

    fn get_client_key(&self) -> Option<String> {
        self.client_key.read().ok().and_then(|k| k.clone())
    }

    fn set_client_key(&self, key: String) {
        if let Ok(mut lock) = self.client_key.write() {
            info!("Stored new LG webOS client-key");
            *lock = Some(key);
        }
    }
}

#[async_trait]
impl TvAdapter for LgWebOsAdapter {
    fn brand(&self) -> &'static str {
        "LG"
    }

    fn protocol_id(&self) -> u8 {
        LG_WEBOS
    }

    async fn connect(&self, device: &TvDevice) -> Result<(), TvError> {
        let mut lock = self
            .tv_ip
            .write()
            .map_err(|_| TvError::Internal("Lock poisoned".into()))?;
        *lock = Some(device.ip.clone());
        info!(ip = %device.ip, "Connected LG webOS Adapter to device");
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
        let ws_url = format!("ws://{}:3000", ip);

        debug!(url = %ws_url, "Initiating LG webOS SSAP registration handshake");

        match tokio::time::timeout(
            Duration::from_secs(5),
            tokio_tungstenite::connect_async(&ws_url),
        )
        .await
        {
            Ok(Ok((mut ws_stream, _))) => {
                let existing_key = self.get_client_key();

                let reg_payload = serde_json::json!({
                    "type": "register",
                    "id": "register_0",
                    "payload": {
                        "forcePairing": false,
                        "manifest": {
                            "manifestVersion": 1,
                            "appVersion": "1.0",
                            "signed": {
                                "vendorId": "lookaberry",
                                "appId": "com.lookaberry.remote",
                                "permissions": [
                                    "CONTROL_INPUT_TEXT",
                                    "CONTROL_POWER",
                                    "READ_INSTALLED_APPS",
                                    "CONTROL_AUDIO",
                                    "CONTROL_TV_SCREEN"
                                ]
                            }
                        },
                        "client-key": existing_key
                    }
                });

                if let Err(e) = ws_stream
                    .send(Message::Text(reg_payload.to_string().into()))
                    .await
                {
                    return Err(TvError::ConnectionFailed(e.to_string()));
                }

                // Wait for registered confirmation or prompt response
                while let Some(Ok(msg)) = ws_stream.next().await {
                    if let Message::Text(txt) = msg {
                        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&txt) {
                            if json.get("type").and_then(|v| v.as_str()) == Some("registered") {
                                if let Some(key) =
                                    json.pointer("/payload/client-key").and_then(|v| v.as_str())
                                {
                                    self.set_client_key(key.to_string());
                                    return Ok(key.to_string());
                                }
                                return Ok("registered".to_string());
                            } else if json.get("type").and_then(|v| v.as_str()) == Some("response")
                            {
                                return Ok("paired".to_string());
                            }
                        }
                    }
                }

                Ok("prompt_sent".to_string())
            }
            Ok(Err(e)) => Err(TvError::ConnectionFailed(format!(
                "LG webOS socket error: {e}"
            ))),
            Err(_) => Err(TvError::Timeout("LG webOS pairing timed out".into())),
        }
    }

    fn is_paired(&self) -> bool {
        self.client_key.read().map(|k| k.is_some()).unwrap_or(false)
    }

    async fn send_command(&self, cmd: u16) -> Result<TvCommandResult, TvError> {
        let ip = self.get_ip()?;
        let key = lg_key_for_command(cmd)
            .ok_or_else(|| TvError::UnsupportedCommand(format!("Command code: {cmd}")))?;

        let ws_url = format!("ws://{}:3000", ip);

        let payload = serde_json::json!({
            "type": "request",
            "id": format!("req_{}", rand::random::<u32>()),
            "uri": "ssap://com.webos.service.remoteinput/sendKey",
            "payload": {
                "key": key
            }
        });

        let payload_str = payload.to_string();

        match tokio::time::timeout(
            Duration::from_millis(600),
            tokio_tungstenite::connect_async(&ws_url),
        )
        .await
        {
            Ok(Ok((mut ws_stream, _))) => {
                if let Err(e) = ws_stream.send(Message::Text(payload_str.into())).await {
                    error!("Failed to send key to LG webOS TV: {e}");
                    return Err(TvError::ConnectionFailed(e.to_string()));
                }
                debug!(ip = %ip, key = key, "Dispatched key to LG webOS TV");
                Ok(TvCommandResult::Sent)
            }
            Ok(Err(e)) => Err(TvError::ConnectionFailed(e.to_string())),
            Err(_) => Err(TvError::Timeout(format!(
                "Timeout connecting to LG TV at {ip}"
            ))),
        }
    }

    async fn send_text(&self, text: &str) -> Result<TvCommandResult, TvError> {
        let ip = self.get_ip()?;
        let ws_url = format!("ws://{}:3000", ip);

        let payload = serde_json::json!({
            "type": "request",
            "id": format!("req_text_{}", rand::random::<u32>()),
            "uri": "ssap://com.webos.service.ime/insertText",
            "payload": {
                "text": text,
                "replace": 0
            }
        });

        if let Ok(Ok((mut ws_stream, _))) = tokio::time::timeout(
            Duration::from_millis(600),
            tokio_tungstenite::connect_async(&ws_url),
        )
        .await
        {
            let _ = ws_stream
                .send(Message::Text(payload.to_string().into()))
                .await;
            Ok(TvCommandResult::Sent)
        } else {
            Err(TvError::Timeout(
                "Timeout sending text to LG webOS TV".into(),
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
            "volume".to_string(),
        ]
    }

    async fn health_check(&self) -> Result<bool, TvError> {
        let ip = self.get_ip()?;
        match tokio::time::timeout(
            Duration::from_millis(400),
            tokio::net::TcpStream::connect(format!("{}:3000", ip)),
        )
        .await
        {
            Ok(Ok(_)) => Ok(true),
            _ => Ok(false),
        }
    }
}
