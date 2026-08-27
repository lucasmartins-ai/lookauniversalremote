//! Android TV / Google TV Platform Adapter.

use crate::tv::adapters::traits::{TvAdapter, TvCommandResult, TvError};
use crate::tv::commands::android_keycode_for_command;
use crate::tv::discovery::models::TvDevice;
use async_trait::async_trait;
use lookaremote_protocol::messages::tv_target_devices::ANDROID_GOOGLE_TV;
use std::sync::RwLock;
use std::time::Duration;
use tracing::{debug, info, warn};

/// Android / Google TV platform adapter.
pub struct AndroidGoogleTvAdapter {
    tv_ip: RwLock<Option<String>>,
    http_client: reqwest::Client,
}

impl Default for AndroidGoogleTvAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl AndroidGoogleTvAdapter {
    /// Create a new Android/Google TV adapter.
    pub fn new() -> Self {
        let http_client = reqwest::Client::builder()
            .timeout(Duration::from_millis(600))
            .build()
            .unwrap_or_default();

        Self {
            tv_ip: RwLock::new(None),
            http_client,
        }
    }

    fn get_ip(&self) -> Result<String, TvError> {
        self.tv_ip
            .read()
            .map_err(|_| TvError::Internal("Lock poisoned".into()))?
            .clone()
            .ok_or_else(|| TvError::Unreachable("No Android/Google TV IP configured".into()))
    }
}

#[async_trait]
impl TvAdapter for AndroidGoogleTvAdapter {
    fn brand(&self) -> &'static str {
        "Google"
    }

    fn protocol_id(&self) -> u8 {
        ANDROID_GOOGLE_TV
    }

    async fn connect(&self, device: &TvDevice) -> Result<(), TvError> {
        let mut lock = self
            .tv_ip
            .write()
            .map_err(|_| TvError::Internal("Lock poisoned".into()))?;
        *lock = Some(device.ip.clone());
        info!(ip = %device.ip, "Connected Android/Google TV Adapter to device");
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

    async fn pair(&self, pin: Option<&str>) -> Result<String, TvError> {
        let ip = self.get_ip()?;
        debug!(ip = %ip, pin = ?pin, "Initiating Google TV Remote pairing handshake");
        // Google TV Remote v2 TLS pairing placeholder
        Ok("paired".to_string())
    }

    fn is_paired(&self) -> bool {
        true
    }

    async fn send_command(&self, cmd: u16) -> Result<TvCommandResult, TvError> {
        let ip = self.get_ip()?;
        let keycode = android_keycode_for_command(cmd)
            .ok_or_else(|| TvError::UnsupportedCommand(format!("Command code: {cmd}")))?;

        // 1. Primary: Google Cast HTTP Remote control endpoint (Port 8008)
        let cast_endpoint = format!("http://{}:8008/setup/app_command", ip);
        let payload = serde_json::json!({
            "keycode": keycode,
            "action": "click"
        });

        match self
            .http_client
            .post(&cast_endpoint)
            .json(&payload)
            .send()
            .await
        {
            Ok(res) if res.status().is_success() => {
                debug!(ip = %ip, keycode = keycode, "Dispatched keycode to Android TV via Cast");
                return Ok(TvCommandResult::Sent);
            }
            Ok(res) => {
                debug!(ip = %ip, status = %res.status(), "Cast endpoint returned non-200, attempting TCP fallback");
            }
            Err(e) => {
                debug!(ip = %ip, err = %e, "Cast endpoint unreachable, attempting TCP fallback");
            }
        }

        // 2. Fallback: ADB/Remote daemon TCP stream (if ADB debugging enabled on TV)
        match tokio::time::timeout(
            Duration::from_millis(500),
            tokio::net::TcpStream::connect(format!("{}:5555", ip)),
        )
        .await
        {
            Ok(Ok(mut stream)) => {
                use tokio::io::AsyncWriteExt;
                let raw_cmd = format!("shell:input keyevent {}\n", keycode);
                if let Err(e) = stream.write_all(raw_cmd.as_bytes()).await {
                    return Err(TvError::ConnectionFailed(format!("TCP write error: {e}")));
                }
                debug!(ip = %ip, keycode = keycode, "Dispatched keycode to Android TV via TCP");
                Ok(TvCommandResult::Sent)
            }
            Ok(Err(e)) => {
                warn!("Android TV TCP connection failed at {ip}: {e}");
                Err(TvError::ConnectionFailed(e.to_string()))
            }
            Err(_) => Err(TvError::Timeout(format!(
                "Android TV connection timed out at {ip}"
            ))),
        }
    }

    async fn send_text(&self, text: &str) -> Result<TvCommandResult, TvError> {
        let ip = self.get_ip()?;
        // Try TCP stream text injection
        match tokio::time::timeout(
            Duration::from_millis(500),
            tokio::net::TcpStream::connect(format!("{}:5555", ip)),
        )
        .await
        {
            Ok(Ok(mut stream)) => {
                use tokio::io::AsyncWriteExt;
                let raw_cmd = format!("shell:input text '{}'\n", text);
                let _ = stream.write_all(raw_cmd.as_bytes()).await;
                Ok(TvCommandResult::Sent)
            }
            _ => Err(TvError::ConnectionFailed(
                "Android TV text input channel unavailable".into(),
            )),
        }
    }

    fn get_capabilities(&self) -> Vec<String> {
        vec![
            "keys".to_string(),
            "text_input".to_string(),
            "cast".to_string(),
            "power".to_string(),
            "volume".to_string(),
        ]
    }

    async fn health_check(&self) -> Result<bool, TvError> {
        let ip = self.get_ip()?;
        let endpoint = format!("http://{}:8008/setup/eureka_info", ip);
        match self
            .http_client
            .get(&endpoint)
            .timeout(Duration::from_millis(400))
            .send()
            .await
        {
            Ok(res) => Ok(res.status().is_success()),
            Err(_) => Ok(false),
        }
    }
}
