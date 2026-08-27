//! Multicast DNS (mDNS / DNS-SD) Smart TV service discovery.

use crate::tv::discovery::models::{DiscoverySource, TvDevice};
use lookaremote_protocol::messages::tv_target_devices::*;
use std::time::Duration;
use tokio::net::UdpSocket;
use tracing::{debug, warn};

const MDNS_MULTICAST_ADDR: &str = "224.0.0.251:5353";

/// mDNS / DNS-SD TV discovery engine.
pub struct MdnsDiscovery;

impl MdnsDiscovery {
    /// Perform an mDNS scan for Cast / Apple TV devices.
    pub async fn scan(timeout: Duration) -> Vec<TvDevice> {
        let mut devices = Vec::new();

        let socket = match UdpSocket::bind("0.0.0.0:0").await {
            Ok(s) => s,
            Err(e) => {
                warn!("Failed to bind UDP socket for mDNS discovery: {e}");
                return devices;
            }
        };

        // Query packet for _googlecast._tcp.local and _airplay._tcp.local
        // Build simple DNS PTR query packets
        let queries = [
            Self::build_ptr_query("_googlecast._tcp.local"),
            Self::build_ptr_query("_airplay._tcp.local"),
        ];

        for q in queries {
            let _ = socket.send_to(&q, MDNS_MULTICAST_ADDR).await;
        }

        let mut buf = [0u8; 4096];
        let end_time = tokio::time::Instant::now() + timeout;

        while tokio::time::Instant::now() < end_time {
            let remaining = end_time - tokio::time::Instant::now();
            let recv_res = tokio::time::timeout(remaining, socket.recv_from(&mut buf)).await;

            match recv_res {
                Ok(Ok((len, src))) => {
                    let packet = &buf[..len];
                    if let Some(device) = Self::parse_mdns_packet(packet, src.ip().to_string()) {
                        if !devices.iter().any(|d: &TvDevice| d.id == device.id) {
                            devices.push(device);
                        }
                    }
                }
                _ => break,
            }
        }

        devices
    }

    /// Build a standard DNS PTR query payload.
    fn build_ptr_query(service_name: &str) -> Vec<u8> {
        let mut query = Vec::with_capacity(64);
        // Transaction ID: 0x0000
        query.extend_from_slice(&[0x00, 0x00]);
        // Flags: 0x0000 (Standard Query)
        query.extend_from_slice(&[0x00, 0x00]);
        // Questions: 1
        query.extend_from_slice(&[0x00, 0x01]);
        // Answer RRs, Authority RRs, Additional RRs: 0
        query.extend_from_slice(&[0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);

        // QNAME encoding
        for part in service_name.split('.') {
            let bytes = part.as_bytes();
            query.push(bytes.len() as u8);
            query.extend_from_slice(bytes);
        }
        query.push(0x00); // Root label

        // QTYPE: PTR (0x000C)
        query.extend_from_slice(&[0x00, 0x0c]);
        // QCLASS: IN (0x0001) | Unicast response request
        query.extend_from_slice(&[0x00, 0x01]);

        query
    }

    /// Parse an incoming mDNS response packet.
    fn parse_mdns_packet(packet: &[u8], ip: String) -> Option<TvDevice> {
        if packet.len() < 12 {
            return None;
        }

        let packet_str = String::from_utf8_lossy(packet);

        if packet_str.contains("googlecast") || packet_str.contains("Google Cast") {
            let id = format!("cast-{}", ip.replace('.', "-"));
            debug!(ip = %ip, "Discovered Google Cast / Android TV via mDNS");
            let mut dev = TvDevice::new(
                id,
                ip,
                "Google TV / Android TV".to_string(),
                "Google".to_string(),
                ANDROID_GOOGLE_TV,
                8008,
                DiscoverySource::Mdns,
            );
            dev.capabilities = vec!["cast".to_string(), "remote".to_string(), "keys".to_string()];
            Some(dev)
        } else if packet_str.contains("airplay") || packet_str.contains("AppleTV") {
            let id = format!("appletv-{}", ip.replace('.', "-"));
            debug!(ip = %ip, "Discovered Apple TV via mDNS");
            let mut dev = TvDevice::new(
                id,
                ip,
                "Apple TV (tvOS)".to_string(),
                "Apple".to_string(),
                APPLE_TV,
                7000,
                DiscoverySource::Mdns,
            );
            dev.capabilities = vec!["airplay".to_string(), "media".to_string()];
            Some(dev)
        } else {
            None
        }
    }
}
