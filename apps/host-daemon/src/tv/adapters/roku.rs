//! Roku TV / Streaming Device External Control Protocol (ECP) Adapter.

use crate::tv::adapters::traits::{TvAdapter, TvCommandResult, TvError};
use crate::tv::commands::roku_keypress_for_command;
use crate::tv::discovery::models::TvDevice;
use async_trait::async_trait;
use lookaremote_protocol::messages::tv_commands;
use lookaremote_protocol::messages::tv_target_devices::ROKU_TV;
use std::sync::RwLock;
use std::time::Duration;
use tracing::{debug, error, info};

/// Roku ECP TV platform adapter.
pub struct RokuAdapter {
    tv_ip: RwLock<Option<String>>,
    http_client: reqwest::Client,
}

impl Default for RokuAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl RokuAdapter {
    /// Create a new Roku adapter.
    pub fn new() -> Self {
        let http_client = reqwest::Client::builder()
            .timeout(Duration::from_millis(500))
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
            .ok_or_else(|| TvError::Unreachable("No Roku TV IP configured".into()))
    }
}

#[async_trait]
impl TvAdapter for RokuAdapter {
    fn brand(&self) -> &'static str {
        "Roku"
    }

    fn protocol_id(&self) -> u8 {
        ROKU_TV
    }

    async fn connect(&self, device: &TvDevice) -> Result<(), TvError> {
        let mut lock = self
            .tv_ip
            .write()
            .map_err(|_| TvError::Internal("Lock poisoned".into()))?;
        *lock = Some(device.ip.clone());
        info!(ip = %device.ip, "Connected Roku Adapter to device");
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
        // Roku ECP does not require credentials/PIN
        Ok("paired".to_string())
    }

    fn is_paired(&self) -> bool {
        true
    }

    async fn send_command(&self, cmd: u16) -> Result<TvCommandResult, TvError> {
        let ip = self.get_ip()?;

        // Check if direct App Launcher command
        let app_id = match cmd {
            tv_commands::APP_NETFLIX => Some("12"),
            tv_commands::APP_YOUTUBE => Some("837"),
            tv_commands::APP_PRIME => Some("13"),
            tv_commands::APP_DISNEY => Some("291097"),
            tv_commands::APP_SPOTIFY => Some("22297"),
            _ => None,
        };

        if let Some(aid) = app_id {
            let endpoint = format!("http://{}:8060/launch/{}", ip, aid);
            match self.http_client.post(&endpoint).send().await {
                Ok(res) if res.status().is_success() => {
                    debug!(ip = %ip, app_id = aid, "Launched Roku app successfully");
                    return Ok(TvCommandResult::Sent);
                }
                Ok(res) => return Err(TvError::ConnectionFailed(format!("HTTP {}", res.status()))),
                Err(e) => return Err(TvError::ConnectionFailed(e.to_string())),
            }
        }

        let key = roku_keypress_for_command(cmd)
            .ok_or_else(|| TvError::UnsupportedCommand(format!("Command code: {cmd}")))?;

        let endpoint = format!("http://{}:8060/keypress/{}", ip, key);
        match self.http_client.post(&endpoint).send().await {
            Ok(res) if res.status().is_success() => {
                debug!(ip = %ip, key = key, "Dispatched keypress to Roku TV");
                Ok(TvCommandResult::Sent)
            }
            Ok(res) => {
                error!(ip = %ip, status = %res.status(), "Roku ECP returned error");
                Err(TvError::ConnectionFailed(format!("HTTP {}", res.status())))
            }
            Err(e) => Err(TvError::ConnectionFailed(e.to_string())),
        }
    }

    async fn send_text(&self, text: &str) -> Result<TvCommandResult, TvError> {
        let ip = self.get_ip()?;
        let encoded_text = text.replace(' ', "%20");
        let endpoint = format!("http://{}:8060/input?text={}", ip, encoded_text);

        match self.http_client.post(&endpoint).send().await {
            Ok(res) if res.status().is_success() => {
                debug!(ip = %ip, text = %text, "Injected text input into Roku TV");
                Ok(TvCommandResult::Sent)
            }
            Ok(res) => Err(TvError::ConnectionFailed(format!("HTTP {}", res.status()))),
            Err(e) => Err(TvError::ConnectionFailed(e.to_string())),
        }
    }

    fn get_capabilities(&self) -> Vec<String> {
        vec![
            "keys".to_string(),
            "text_input".to_string(),
            "apps".to_string(),
            "media".to_string(),
            "volume".to_string(),
            "power".to_string(),
        ]
    }

    async fn health_check(&self) -> Result<bool, TvError> {
        let ip = self.get_ip()?;
        let endpoint = format!("http://{}:8060/query/device-info", ip);
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
