//! Apple TV (tvOS) MediaRemote & AirPlay Adapter.

use crate::tv::adapters::traits::{TvAdapter, TvCommandResult, TvError};
use crate::tv::discovery::models::TvDevice;
use async_trait::async_trait;
use lookaremote_protocol::messages::tv_commands;
use lookaremote_protocol::messages::tv_target_devices::APPLE_TV;
use std::sync::RwLock;
use std::time::Duration;
use tracing::{debug, info};

/// Apple TV (tvOS) platform adapter with explicit capability tracking.
pub struct AppleTvAdapter {
    tv_ip: RwLock<Option<String>>,
    http_client: reqwest::Client,
}

impl Default for AppleTvAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl AppleTvAdapter {
    /// Create a new Apple TV adapter.
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
            .ok_or_else(|| TvError::Unreachable("No Apple TV IP configured".into()))
    }
}

#[async_trait]
impl TvAdapter for AppleTvAdapter {
    fn brand(&self) -> &'static str {
        "Apple"
    }

    fn protocol_id(&self) -> u8 {
        APPLE_TV
    }

    async fn connect(&self, device: &TvDevice) -> Result<(), TvError> {
        let mut lock = self
            .tv_ip
            .write()
            .map_err(|_| TvError::Internal("Lock poisoned".into()))?;
        *lock = Some(device.ip.clone());
        info!(ip = %device.ip, "Connected Apple TV Adapter to device");
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
        Err(TvError::PairingRequired(
            "Apple TV requires SRP / HomeKit pairing credentials for full remote control".into(),
        ))
    }

    fn is_paired(&self) -> bool {
        false
    }

    async fn send_command(&self, cmd: u16) -> Result<TvCommandResult, TvError> {
        let ip = self.get_ip()?;

        // Support standard media actions via AirPlay endpoint (port 7000)
        match cmd {
            tv_commands::MEDIA_PLAY_PAUSE | tv_commands::MEDIA_STOP => {
                let endpoint = format!("http://{}:7000/rate?value=1.0", ip);
                let _ = self.http_client.post(&endpoint).send().await;
                debug!(ip = %ip, "Dispatched AirPlay media command to Apple TV");
                Ok(TvCommandResult::Sent)
            }
            _ => {
                debug!(
                    cmd = cmd,
                    "Apple TV command requires authenticated MRP companion pairing"
                );
                Ok(TvCommandResult::Unsupported)
            }
        }
    }

    async fn send_text(&self, _text: &str) -> Result<TvCommandResult, TvError> {
        Ok(TvCommandResult::Unsupported)
    }

    fn get_capabilities(&self) -> Vec<String> {
        vec!["airplay".to_string(), "media".to_string()]
    }

    async fn health_check(&self) -> Result<bool, TvError> {
        let ip = self.get_ip()?;
        match tokio::time::timeout(
            Duration::from_millis(400),
            tokio::net::TcpStream::connect(format!("{}:7000", ip)),
        )
        .await
        {
            Ok(Ok(_)) => Ok(true),
            _ => Ok(false),
        }
    }
}
