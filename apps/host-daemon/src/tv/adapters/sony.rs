//! Sony Bravia Smart TV IRCC-IP & REST Adapter implementation.

use crate::tv::adapters::traits::{TvAdapter, TvCommandResult, TvError};
use crate::tv::discovery::models::TvDevice;
use async_trait::async_trait;
use lookaremote_protocol::messages::tv_commands;
use lookaremote_protocol::messages::tv_target_devices::SONY_BRAVIA;
use std::sync::RwLock;
use std::time::Duration;
use tracing::{debug, info, warn};

/// Sony Bravia TV platform adapter.
pub struct SonyBraviaAdapter {
    tv_ip: RwLock<Option<String>>,
    psk: RwLock<String>,
    http_client: reqwest::Client,
}

impl Default for SonyBraviaAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl SonyBraviaAdapter {
    /// Create a new Sony Bravia adapter.
    pub fn new() -> Self {
        let http_client = reqwest::Client::builder()
            .timeout(Duration::from_millis(600))
            .build()
            .unwrap_or_default();

        Self {
            tv_ip: RwLock::new(None),
            psk: RwLock::new("0000".to_string()),
            http_client,
        }
    }

    fn get_ip(&self) -> Result<String, TvError> {
        self.tv_ip
            .read()
            .map_err(|_| TvError::Internal("Lock poisoned".into()))?
            .clone()
            .ok_or_else(|| TvError::Unreachable("No Sony Bravia TV IP configured".into()))
    }

    fn get_psk(&self) -> String {
        self.psk
            .read()
            .map(|p| p.clone())
            .unwrap_or_else(|_| "0000".to_string())
    }

    /// Map universal TV command to Sony IRCC Base64 command code.
    fn sony_ircc_for_command(cmd: u16) -> Option<&'static str> {
        match cmd {
            tv_commands::POWER => Some("AAAAAQAAAAEAAAAVAw=="),
            tv_commands::HOME => Some("AAAAAQAAAAEAAABgAw=="),
            tv_commands::VOLUME_UP => Some("AAAAAQAAAAEAAAASAw=="),
            tv_commands::VOLUME_DOWN => Some("AAAAAQAAAAEAAAATAw=="),
            tv_commands::MUTE => Some("AAAAAQAAAAEAAAAUAw=="),
            tv_commands::CHANNEL_UP => Some("AAAAAQAAAAEAAAAQAw=="),
            tv_commands::CHANNEL_DOWN => Some("AAAAAQAAAAEAAAARAw=="),
            tv_commands::DPAD_UP => Some("AAAAAQAAAAEAAAB0Aw=="),
            tv_commands::DPAD_DOWN => Some("AAAAAQAAAAEAAAB1Aw=="),
            tv_commands::DPAD_LEFT => Some("AAAAAQAAAAEAAAA0Aw=="),
            tv_commands::DPAD_RIGHT => Some("AAAAAQAAAAEAAAAzAw=="),
            tv_commands::OK_ENTER => Some("AAAAAQAAAAEAAABlAw=="),
            tv_commands::BACK => Some("AAAAAQAAAAEAAABjAw=="),
            tv_commands::EXIT => Some("AAAAAQAAAAEAAABjAw=="),
            tv_commands::APP_NETFLIX => Some("AAAAAgAAABoAAAB8Aw=="),
            tv_commands::APP_YOUTUBE => Some("AAAAAgAAABoAAABbAw=="),
            _ => None,
        }
    }
}

#[async_trait]
impl TvAdapter for SonyBraviaAdapter {
    fn brand(&self) -> &'static str {
        "Sony"
    }

    fn protocol_id(&self) -> u8 {
        SONY_BRAVIA
    }

    async fn connect(&self, device: &TvDevice) -> Result<(), TvError> {
        let mut lock = self
            .tv_ip
            .write()
            .map_err(|_| TvError::Internal("Lock poisoned".into()))?;
        *lock = Some(device.ip.clone());
        info!(ip = %device.ip, "Connected Sony Bravia Adapter to device");
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

    async fn pair(&self, psk: Option<&str>) -> Result<String, TvError> {
        if let Some(key) = psk {
            if let Ok(mut lock) = self.psk.write() {
                *lock = key.to_string();
            }
        }
        Ok("paired".to_string())
    }

    fn is_paired(&self) -> bool {
        true
    }

    async fn send_command(&self, cmd: u16) -> Result<TvCommandResult, TvError> {
        let ip = self.get_ip()?;
        let ircc_code = Self::sony_ircc_for_command(cmd)
            .ok_or_else(|| TvError::UnsupportedCommand(format!("Command code: {cmd}")))?;

        let soap_body = format!(
            "<?xml version=\"1.0\"?>\r\n\
             <s:Envelope xmlns:s=\"http://schemas.xmlsoap.org/soap/envelope/\" s:encodingStyle=\"http://schemas.xmlsoap.org/soap/encoding/\">\r\n\
               <s:Body>\r\n\
                 <u:X_SendIRCC xmlns:u=\"urn:schemas-sony-com:service:IRCC:1\">\r\n\
                   <IRCCCode>{}</IRCCCode>\r\n\
                 </u:X_SendIRCC>\r\n\
               </s:Body>\r\n\
             </s:Envelope>",
            ircc_code
        );

        let endpoint = format!("http://{}/sony/IRCC", ip);
        let psk = self.get_psk();

        match self
            .http_client
            .post(&endpoint)
            .header("X-Auth-PSK", psk)
            .header(
                "SOAPACTION",
                "\"urn:schemas-sony-com:service:IRCC:1#X_SendIRCC\"",
            )
            .header("Content-Type", "text/xml; charset=UTF-8")
            .body(soap_body)
            .send()
            .await
        {
            Ok(res) if res.status().is_success() => {
                debug!(ip = %ip, ircc = ircc_code, "Dispatched IRCC command to Sony Bravia");
                Ok(TvCommandResult::Sent)
            }
            Ok(res) => {
                warn!(ip = %ip, status = %res.status(), "Sony IRCC request rejected");
                Err(TvError::ConnectionFailed(format!("HTTP {}", res.status())))
            }
            Err(e) => Err(TvError::ConnectionFailed(e.to_string())),
        }
    }

    async fn send_text(&self, text: &str) -> Result<TvCommandResult, TvError> {
        let ip = self.get_ip()?;
        let endpoint = format!("http://{}/sony/appControl", ip);
        let psk = self.get_psk();

        let payload = serde_json::json!({
            "method": "setTextForm",
            "params": [{ "text": text }],
            "id": 1,
            "version": "1.0"
        });

        match self
            .http_client
            .post(&endpoint)
            .header("X-Auth-PSK", psk)
            .json(&payload)
            .send()
            .await
        {
            Ok(res) if res.status().is_success() => Ok(TvCommandResult::Sent),
            Ok(res) => Err(TvError::ConnectionFailed(format!("HTTP {}", res.status()))),
            Err(e) => Err(TvError::ConnectionFailed(e.to_string())),
        }
    }

    fn get_capabilities(&self) -> Vec<String> {
        vec![
            "keys".to_string(),
            "text_input".to_string(),
            "power".to_string(),
            "volume".to_string(),
            "apps".to_string(),
        ]
    }

    async fn health_check(&self) -> Result<bool, TvError> {
        let ip = self.get_ip()?;
        let endpoint = format!("http://{}/sony/system", ip);
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
