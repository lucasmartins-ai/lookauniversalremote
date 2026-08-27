//! SSDP / UPnP M-SEARCH Smart TV discovery implementation.

use crate::tv::discovery::models::{DiscoverySource, TvDevice};
use lookaremote_protocol::messages::tv_target_devices::*;
use std::collections::HashMap;
use std::net::SocketAddr;
use std::time::Duration;
use tokio::net::UdpSocket;
use tracing::{debug, warn};

const SSDP_MULTICAST_ADDR: &str = "239.255.255.250:1900";

/// SSDP Discovery Engine
pub struct SsdpDiscovery;

impl SsdpDiscovery {
    /// Perform an SSDP M-SEARCH scan for Smart TVs on the local subnet.
    pub async fn scan(timeout: Duration) -> Vec<TvDevice> {
        let mut devices = Vec::new();

        let socket = match UdpSocket::bind("0.0.0.0:0").await {
            Ok(s) => s,
            Err(e) => {
                warn!("Failed to bind UDP socket for SSDP discovery: {e}");
                return devices;
            }
        };

        let target_search_types = [
            "urn:dial-multiscreen-org:service:dial:1",
            "roku:ecp",
            "urn:schemas-upnp-org:device:MediaRenderer:1",
            "urn:schemas-upnp-org:device:MediaServer:1",
            "ssdp:all",
        ];

        for st in target_search_types {
            let msg = format!(
                "M-SEARCH * HTTP/1.1\r\n\
                 HOST: {}\r\n\
                 MAN: \"ssdp:discover\"\r\n\
                 MX: 2\r\n\
                 ST: {}\r\n\
                 USER-AGENT: LookARemote/0.1.0 UPnP/1.1\r\n\r\n",
                SSDP_MULTICAST_ADDR, st
            );

            let _ = socket.send_to(msg.as_bytes(), SSDP_MULTICAST_ADDR).await;
        }

        let mut buf = [0u8; 4096];
        let end_time = tokio::time::Instant::now() + timeout;

        while tokio::time::Instant::now() < end_time {
            let remaining = end_time - tokio::time::Instant::now();
            let recv_res = tokio::time::timeout(remaining, socket.recv_from(&mut buf)).await;

            match recv_res {
                Ok(Ok((len, src))) => {
                    if let Ok(response_str) = std::str::from_utf8(&buf[..len]) {
                        if let Some(device) = Self::parse_ssdp_response(response_str, src) {
                            if !devices.iter().any(|d: &TvDevice| d.id == device.id) {
                                devices.push(device);
                            }
                        }
                    }
                }
                _ => break,
            }
        }

        devices
    }

    /// Parse an incoming SSDP HTTP response into a `TvDevice`.
    pub fn parse_ssdp_response(response: &str, src: SocketAddr) -> Option<TvDevice> {
        let headers = Self::parse_headers(response);

        let st = headers.get("ST").or_else(|| headers.get("st"))?;
        let usn = headers.get("USN").or_else(|| headers.get("usn"))?;
        let server = headers
            .get("SERVER")
            .or_else(|| headers.get("server"))
            .cloned()
            .unwrap_or_default();
        let location = headers
            .get("LOCATION")
            .or_else(|| headers.get("location"))
            .cloned()
            .unwrap_or_default();

        let ip = src.ip().to_string();

        // Extract stable UDN from USN (e.g. uuid:12345678-1234-...)
        let id = if let Some(stripped) = usn.strip_prefix("uuid:") {
            stripped.split("::").next().unwrap_or(usn).to_string()
        } else {
            format!("ssdp-{}", ip.replace('.', "-"))
        };

        let server_lower = server.to_lowercase();
        let location_lower = location.to_lowercase();
        let st_lower = st.to_lowercase();

        let (brand, name, protocol, port) = if st_lower.contains("roku:ecp")
            || server_lower.contains("roku")
            || location_lower.contains(":8060")
        {
            (
                "Roku".to_string(),
                "Roku TV / Streaming Player".to_string(),
                ROKU_TV,
                8060,
            )
        } else if server_lower.contains("tizen") || server_lower.contains("samsung") || location_lower.contains(":8001") {
            (
                "Samsung".to_string(),
                "Samsung Smart TV (Tizen)".to_string(),
                SAMSUNG_TIZEN,
                8001,
            )
        } else if server_lower.contains("webos") || server_lower.contains("lg") || location_lower.contains(":3000") || location_lower.contains(":1953") {
            (
                "LG".to_string(),
                "LG Smart TV (webOS)".to_string(),
                LG_WEBOS,
                3000,
            )
        } else if server_lower.contains("bravia") || server_lower.contains("sony") {
            (
                "Sony".to_string(),
                "Sony Bravia Smart TV".to_string(),
                SONY_BRAVIA,
                80,
            )
        } else if st_lower.contains("dial") || st_lower.contains("mediarenderer") || server_lower.contains("android") || server_lower.contains("google") {
            (
                "Google".to_string(),
                "Google TV / Android TV".to_string(),
                ANDROID_GOOGLE_TV,
                8008,
            )
        } else if server_lower.contains("smarttv") || server_lower.contains("tv") {
            (
                "Generic".to_string(),
                format!("Smart TV ({})", ip),
                GENERIC_TV,
                80,
            )
        } else {
            // Exclude routers, printers, and generic network peripherals that don't match TV signatures
            return None;
        };

        debug!(ip = %ip, brand = %brand, "Parsed SSDP discovery advertisement");

        let mut dev = TvDevice::new(id, ip, name, brand, protocol, port, DiscoverySource::Ssdp);
        if !location.is_empty() {
            dev.capabilities.push(format!("location:{}", location));
        }
        Some(dev)
    }

    fn parse_headers(raw: &str) -> HashMap<String, String> {
        let mut map = HashMap::new();
        for line in raw.lines() {
            if let Some((k, v)) = line.split_once(':') {
                map.insert(k.trim().to_uppercase(), v.trim().to_string());
            }
        }
        map
    }
}
