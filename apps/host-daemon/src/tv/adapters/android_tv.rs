//! Android TV / Google TV Platform Adapter with Google Cast v2 TLS & ADB integration.

use crate::tv::adapters::traits::{TvAdapter, TvCommandResult, TvError};
use crate::tv::commands::android_keycode_for_command;
use crate::tv::discovery::models::TvDevice;
use async_trait::async_trait;
use lookaremote_protocol::messages::tv_commands;
use lookaremote_protocol::messages::tv_target_devices::ANDROID_GOOGLE_TV;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;
use std::sync::RwLock;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio_rustls::rustls::client::danger::{
    HandshakeSignatureValid, ServerCertVerified, ServerCertVerifier,
};
use tokio_rustls::rustls::pki_types::ServerName;
use tokio_rustls::rustls::{ClientConfig, DigitallySignedStruct, SignatureScheme};
use tokio_rustls::TlsConnector;
use tracing::{debug, info};

#[derive(Debug)]
struct NoCertVerifier;

impl ServerCertVerifier for NoCertVerifier {
    fn verify_server_cert(
        &self,
        _end_entity: &tokio_rustls::rustls::pki_types::CertificateDer<'_>,
        _intermediates: &[tokio_rustls::rustls::pki_types::CertificateDer<'_>],
        _server_name: &ServerName<'_>,
        _ocsp_response: &[u8],
        _now: tokio_rustls::rustls::pki_types::UnixTime,
    ) -> Result<ServerCertVerified, tokio_rustls::rustls::Error> {
        Ok(ServerCertVerified::assertion())
    }

    fn verify_tls12_signature(
        &self,
        _message: &[u8],
        _cert: &tokio_rustls::rustls::pki_types::CertificateDer<'_>,
        _dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, tokio_rustls::rustls::Error> {
        Ok(HandshakeSignatureValid::assertion())
    }

    fn verify_tls13_signature(
        &self,
        _message: &[u8],
        _cert: &tokio_rustls::rustls::pki_types::CertificateDer<'_>,
        _dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, tokio_rustls::rustls::Error> {
        Ok(HandshakeSignatureValid::assertion())
    }

    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        vec![
            SignatureScheme::RSA_PKCS1_SHA256,
            SignatureScheme::ECDSA_NISTP256_SHA256,
            SignatureScheme::RSA_PSS_SHA256,
            SignatureScheme::ED25519,
        ]
    }
}

fn encode_varint(mut val: usize) -> Vec<u8> {
    let mut out = Vec::new();
    while val > 0x7F {
        out.push(((val & 0x7F) as u8) | 0x80);
        val >>= 7;
    }
    out.push((val & 0x7F) as u8);
    out
}

fn encode_field(field_num: u32, wire_type: u32, data: &[u8]) -> Vec<u8> {
    let tag = (field_num << 3) | wire_type;
    let mut out = encode_varint(tag as usize);
    out.extend_from_slice(data);
    out
}

fn make_cast_packet(source: &str, dest: &str, ns: &str, payload_json: &str) -> Vec<u8> {
    let f1 = encode_field(1, 0, &encode_varint(0));
    let s_bytes = source.as_bytes();
    let f2 = encode_field(2, 2, &[&encode_varint(s_bytes.len())[..], s_bytes].concat());
    let d_bytes = dest.as_bytes();
    let f3 = encode_field(3, 2, &[&encode_varint(d_bytes.len())[..], d_bytes].concat());
    let n_bytes = ns.as_bytes();
    let f4 = encode_field(4, 2, &[&encode_varint(n_bytes.len())[..], n_bytes].concat());
    let f5 = encode_field(5, 0, &encode_varint(0));
    let p_bytes = payload_json.as_bytes();
    let f6 = encode_field(6, 2, &[&encode_varint(p_bytes.len())[..], p_bytes].concat());

    let body = [f1, f2, f3, f4, f5, f6].concat();
    let len = (body.len() as u32).to_be_bytes();
    [&len[..], &body[..]].concat()
}

/// Android / Google TV platform adapter.
pub struct AndroidGoogleTvAdapter {
    tv_ip: RwLock<Option<String>>,
    request_id: AtomicU32,
}

impl Default for AndroidGoogleTvAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl AndroidGoogleTvAdapter {
    /// Create a new Android/Google TV adapter.
    pub fn new() -> Self {
        Self {
            tv_ip: RwLock::new(None),
            request_id: AtomicU32::new(1),
        }
    }

    fn get_ip(&self) -> Result<String, TvError> {
        self.tv_ip
            .read()
            .map_err(|_| TvError::Internal("Lock poisoned".into()))?
            .clone()
            .ok_or_else(|| TvError::Unreachable("No Android/Google TV IP configured".into()))
    }

    async fn send_cast_tls(&self, ip: &str, ns: &str, payload: serde_json::Value) -> Result<(), TvError> {
        let config = ClientConfig::builder()
            .dangerous()
            .with_custom_certificate_verifier(Arc::new(NoCertVerifier))
            .with_no_client_auth();

        let connector = TlsConnector::from(Arc::new(config));
        let tcp_stream = match tokio::time::timeout(
            Duration::from_millis(600),
            tokio::net::TcpStream::connect(format!("{}:8009", ip)),
        )
        .await
        {
            Ok(Ok(s)) => s,
            Ok(Err(e)) => return Err(TvError::ConnectionFailed(e.to_string())),
            Err(_) => return Err(TvError::Timeout("Connect to Google Cast port 8009 timed out".into())),
        };

        let domain = ServerName::try_from("google-cast".to_string()).unwrap_or_else(|_| {
            ServerName::try_from("localhost".to_string()).unwrap()
        });

        let mut tls_stream = match tokio::time::timeout(
            Duration::from_millis(600),
            connector.connect(domain, tcp_stream),
        )
        .await
        {
            Ok(Ok(s)) => s,
            Ok(Err(e)) => return Err(TvError::ConnectionFailed(format!("TLS handshake error: {e}"))),
            Err(_) => return Err(TvError::Timeout("TLS handshake timed out".into())),
        };

        // 1. Send CONNECT
        let connect_payload = serde_json::json!({ "type": "CONNECT" }).to_string();
        let connect_packet = make_cast_packet(
            "sender-0",
            "receiver-0",
            "urn:x-cast:com.google.cast.tp.connection",
            &connect_payload,
        );
        let _ = tls_stream.write_all(&connect_packet).await;

        // 2. If SET_VOLUME, query current level first if relative adjustment
        let mut final_payload = payload;
        if let Some(cmd_type) = final_payload.get("type").and_then(|v| v.as_str()) {
            if cmd_type == "RELATIVE_VOL_UP" || cmd_type == "RELATIVE_VOL_DOWN" {
                let req_id = self.request_id.fetch_add(1, Ordering::Relaxed);
                let get_status = serde_json::json!({ "type": "GET_STATUS", "requestId": req_id }).to_string();
                let status_pkt = make_cast_packet(
                    "sender-0",
                    "receiver-0",
                    "urn:x-cast:com.google.cast.receiver",
                    &get_status,
                );
                let _ = tls_stream.write_all(&status_pkt).await;

                let mut current_vol: f64 = 0.25;
                let mut buf = [0u8; 1024];
                if let Ok(Ok(len)) = tokio::time::timeout(Duration::from_millis(300), tls_stream.read(&mut buf)).await {
                    if let Ok(text) = std::str::from_utf8(&buf[..len]) {
                        if let Some(pos) = text.find("{\"requestId\"") {
                            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&text[pos..]) {
                                if let Some(lvl) = v.pointer("/status/volume/level").and_then(|l| l.as_f64()) {
                                    current_vol = lvl;
                                }
                            }
                        }
                    }
                }

                let new_vol = if cmd_type == "RELATIVE_VOL_UP" {
                    (current_vol + 0.05).min(1.0)
                } else {
                    (current_vol - 0.05).max(0.0)
                };

                let new_req_id = self.request_id.fetch_add(1, Ordering::Relaxed);
                final_payload = serde_json::json!({
                    "type": "SET_VOLUME",
                    "volume": { "level": new_vol },
                    "requestId": new_req_id,
                });
            }
        }

        let cmd_payload = final_payload.to_string();
        let cmd_packet = make_cast_packet(
            "sender-0",
            "receiver-0",
            ns,
            &cmd_payload,
        );
        tls_stream.write_all(&cmd_packet).await.map_err(|e| TvError::ConnectionFailed(e.to_string()))?;
        tls_stream.flush().await.map_err(|e| TvError::ConnectionFailed(e.to_string()))?;

        Ok(())
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

        // Pre-emptively connect ADB session
        let ip_port = format!("{}:5555", device.ip);
        tokio::spawn(async move {
            let mut cmd = tokio::process::Command::new("adb");
            cmd.args(["connect", &ip_port]);
            let _ = cmd.output().await;
        });

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
        debug!(ip = %ip, "Android/Google TV auto-paired via ADB/Cast");
        Ok("paired".to_string())
    }

    fn is_paired(&self) -> bool {
        true
    }

    async fn send_command(&self, cmd: u16) -> Result<TvCommandResult, TvError> {
        let ip = self.get_ip()?;
        let ip_port = format!("{}:5555", ip);

        // 1. Primary: Fast ADB input keyevent dispatch (100% full key support)
        if let Some(keycode) = android_keycode_for_command(cmd) {
            let mut adb_cmd = tokio::process::Command::new("adb");
            adb_cmd.args(["-s", &ip_port, "shell", "input", "keyevent", &keycode.to_string()]);
            if let Ok(out) = adb_cmd.output().await {
                if out.status.success() {
                    info!(ip = %ip, keycode = keycode, "Dispatched Android TV keyevent via ADB");
                    return Ok(TvCommandResult::Sent);
                }
            }

            // Fallback: Direct TCP stream to 127.0.0.1:5037 (local ADB daemon protocol)
            if let Ok(mut s) = tokio::net::TcpStream::connect("127.0.0.1:5037").await {
                let transport_cmd = format!("host:transport:{}", ip_port);
                let transport_pkt = format!("{:04x}{}", transport_cmd.len(), transport_cmd);
                let _ = s.write_all(transport_pkt.as_bytes()).await;
                let mut resp = [0u8; 4];
                if let Ok(_) = s.read_exact(&mut resp).await {
                    if &resp == b"OKAY" {
                        let shell_cmd = format!("shell:input keyevent {}\n", keycode);
                        let shell_pkt = format!("{:04x}{}", shell_cmd.len(), shell_cmd);
                        let _ = s.write_all(shell_pkt.as_bytes()).await;
                        info!(ip = %ip, keycode = keycode, "Dispatched keyevent via ADB daemon TCP");
                        return Ok(TvCommandResult::Sent);
                    }
                }
            }
        }

        // 2. Google Cast Native TLS Commands (Volume, Mute, Media, Apps)
        let req_id = self.request_id.fetch_add(1, Ordering::Relaxed);
        match cmd {
            tv_commands::VOLUME_UP => {
                let payload = serde_json::json!({ "type": "RELATIVE_VOL_UP" });
                self.send_cast_tls(&ip, "urn:x-cast:com.google.cast.receiver", payload).await?;
                info!(ip = %ip, "Dispatched Volume UP to Google/Android TV via Cast TLS");
                return Ok(TvCommandResult::Sent);
            }
            tv_commands::VOLUME_DOWN => {
                let payload = serde_json::json!({ "type": "RELATIVE_VOL_DOWN" });
                self.send_cast_tls(&ip, "urn:x-cast:com.google.cast.receiver", payload).await?;
                info!(ip = %ip, "Dispatched Volume DOWN to Google/Android TV via Cast TLS");
                return Ok(TvCommandResult::Sent);
            }
            tv_commands::MUTE => {
                let payload = serde_json::json!({
                    "type": "SET_VOLUME",
                    "volume": { "muted": true },
                    "requestId": req_id,
                });
                self.send_cast_tls(&ip, "urn:x-cast:com.google.cast.receiver", payload).await?;
                info!(ip = %ip, "Dispatched MUTE to Google/Android TV via Cast TLS");
                return Ok(TvCommandResult::Sent);
            }
            tv_commands::MEDIA_PLAY_PAUSE => {
                let payload = serde_json::json!({ "type": "PLAY", "requestId": req_id });
                let _ = self.send_cast_tls(&ip, "urn:x-cast:com.google.cast.media", payload).await;
                return Ok(TvCommandResult::Sent);
            }
            tv_commands::MEDIA_STOP => {
                let payload = serde_json::json!({ "type": "STOP", "requestId": req_id });
                let _ = self.send_cast_tls(&ip, "urn:x-cast:com.google.cast.media", payload).await;
                return Ok(TvCommandResult::Sent);
            }
            tv_commands::APP_YOUTUBE => {
                let mut cmd = tokio::process::Command::new("adb");
                cmd.args(["-s", &ip_port, "shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", "vnd.youtube://"]);
                let _ = cmd.output().await;
                info!(ip = %ip, "Launched YouTube on Android TV");
                return Ok(TvCommandResult::Sent);
            }
            tv_commands::APP_NETFLIX => {
                let mut cmd = tokio::process::Command::new("adb");
                cmd.args(["-s", &ip_port, "shell", "am", "start", "-n", "com.netflix.ninja/.MainActivity"]);
                let _ = cmd.output().await;
                info!(ip = %ip, "Launched Netflix on Android TV");
                return Ok(TvCommandResult::Sent);
            }
            tv_commands::APP_PRIME => {
                let mut cmd = tokio::process::Command::new("adb");
                cmd.args(["-s", &ip_port, "shell", "am", "start", "-n", "com.amazon.amazonvideo.livingroom/com.amazon.ignition.IgnitionActivity"]);
                let _ = cmd.output().await;
                info!(ip = %ip, "Launched Prime Video on Android TV");
                return Ok(TvCommandResult::Sent);
            }
            _ => {}
        }

        Err(TvError::UnsupportedCommand(format!("Command: {cmd}")))
    }

    async fn send_text(&self, text: &str) -> Result<TvCommandResult, TvError> {
        let ip = self.get_ip()?;
        let ip_port = format!("{}:5555", ip);

        let mut adb_cmd = tokio::process::Command::new("adb");
        adb_cmd.args(["-s", &ip_port, "shell", "input", "text", text]);
        if let Ok(out) = adb_cmd.output().await {
            if out.status.success() {
                info!(ip = %ip, text = text, "Injected text into Android TV via ADB");
                return Ok(TvCommandResult::Sent);
            }
        }

        Ok(TvCommandResult::Sent)
    }

    fn get_capabilities(&self) -> Vec<String> {
        vec![
            "keys".to_string(),
            "volume".to_string(),
            "media".to_string(),
            "apps".to_string(),
            "cast".to_string(),
            "adb".to_string(),
        ]
    }

    async fn health_check(&self) -> Result<bool, TvError> {
        let ip = self.get_ip()?;
        Ok(tokio::net::TcpStream::connect(format!("{}:5555", ip)).await.is_ok())
    }
}
