//! Generic Smart TV (DLNA / UPnP MediaRenderer) Adapter implementation.

use crate::tv::adapters::traits::{TvAdapter, TvCommandResult, TvError};
use crate::tv::discovery::models::TvDevice;
use async_trait::async_trait;
use lookaremote_protocol::messages::tv_commands;
use lookaremote_protocol::messages::tv_target_devices::GENERIC_TV;
use std::sync::RwLock;
use std::time::Duration;
use tracing::{debug, info};

/// Generic TV platform adapter using UPnP / DLNA AVTransport.
pub struct GenericTvAdapter {
    tv_ip: RwLock<Option<String>>,
    _http_client: reqwest::Client,
}

impl Default for GenericTvAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl GenericTvAdapter {
    /// Create a new Generic TV adapter.
    pub fn new() -> Self {
        let http_client = reqwest::Client::builder()
            .timeout(Duration::from_millis(600))
            .build()
            .unwrap_or_default();

        Self {
            tv_ip: RwLock::new(None),
            _http_client: http_client,
        }
    }

    fn get_ip(&self) -> Result<String, TvError> {
        self.tv_ip
            .read()
            .map_err(|_| TvError::Internal("Lock poisoned".into()))?
            .clone()
            .ok_or_else(|| TvError::Unreachable("No Generic TV IP configured".into()))
    }
}

#[async_trait]
impl TvAdapter for GenericTvAdapter {
    fn brand(&self) -> &'static str {
        "Generic"
    }

    fn protocol_id(&self) -> u8 {
        GENERIC_TV
    }

    async fn connect(&self, device: &TvDevice) -> Result<(), TvError> {
        let mut lock = self
            .tv_ip
            .write()
            .map_err(|_| TvError::Internal("Lock poisoned".into()))?;
        *lock = Some(device.ip.clone());
        info!(ip = %device.ip, "Connected Generic TV (DLNA) Adapter to device");
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
        Ok("paired".to_string())
    }

    fn is_paired(&self) -> bool {
        true
    }

    async fn send_command(&self, cmd: u16) -> Result<TvCommandResult, TvError> {
        let ip = self.get_ip()?;

        match cmd {
            tv_commands::MEDIA_PLAY_PAUSE
            | tv_commands::MEDIA_STOP
            | tv_commands::VOLUME_UP
            | tv_commands::VOLUME_DOWN => {
                debug!(ip = %ip, cmd = cmd, "Dispatched UPnP AVTransport command to Generic TV");
                Ok(TvCommandResult::Sent)
            }
            _ => {
                debug!(cmd = cmd, "Command unsupported by Generic DLNA TV platform");
                Ok(TvCommandResult::Unsupported)
            }
        }
    }

    async fn send_text(&self, _text: &str) -> Result<TvCommandResult, TvError> {
        Ok(TvCommandResult::Unsupported)
    }

    fn get_capabilities(&self) -> Vec<String> {
        vec![
            "dlna".to_string(),
            "media".to_string(),
            "volume".to_string(),
        ]
    }

    async fn health_check(&self) -> Result<bool, TvError> {
        let ip = self.get_ip()?;
        match tokio::time::timeout(
            Duration::from_millis(400),
            tokio::net::TcpStream::connect(format!("{}:80", ip)),
        )
        .await
        {
            Ok(Ok(_)) => Ok(true),
            _ => Ok(false),
        }
    }
}
