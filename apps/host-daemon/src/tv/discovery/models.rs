//! Data models for Smart TV device discovery and registry.

use serde::{Deserialize, Serialize};
use std::time::SystemTime;

/// Discovery protocol source.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DiscoverySource {
    /// UPnP / SSDP M-SEARCH response
    Ssdp,
    /// Multicast DNS (mDNS) advertisement
    Mdns,
    /// Controlled direct network probe
    Probe,
    /// Manually configured target
    Manual,
}

/// Discovered Smart TV Device model with stable identity.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TvDevice {
    /// Stable unique device identifier (e.g. UUID/UDN or vendor hash, not just IP)
    pub id: String,
    /// Current IPv4 address on the LAN
    pub ip: String,
    /// Optional hostname or mDNS domain
    pub hostname: Option<String>,
    /// Friendly device name (e.g., "Samsung QLED 65", "Living Room TV")
    pub name: String,
    /// TV brand / manufacturer
    pub brand: String,
    /// Hardware / software model identifier
    pub model: Option<String>,
    /// Target device type code (matches protocol target device IDs 0..8)
    pub protocol: u8,
    /// Primary control port (e.g., 8001/8002 for Samsung, 3000 for LG, 8060 for Roku)
    pub port: u16,
    /// List of supported capabilities (e.g. ["keys", "text_input", "media", "apps", "power_on"])
    pub capabilities: Vec<String>,
    /// How the device was discovered
    pub discovery_source: DiscoverySource,
    /// Whether device requires pairing handshake before accepting commands
    pub requires_pairing: bool,
    /// Whether device is currently paired with host
    pub is_paired: bool,
    /// Timestamp when device was first seen
    #[serde(skip, default = "SystemTime::now")]
    pub first_seen: SystemTime,
    /// Timestamp when device was last active on LAN
    #[serde(skip, default = "SystemTime::now")]
    pub last_seen: SystemTime,
}

impl TvDevice {
    /// Helper constructor for a new discovered TV.
    pub fn new(
        id: String,
        ip: String,
        name: String,
        brand: String,
        protocol: u8,
        port: u16,
        source: DiscoverySource,
    ) -> Self {
        let now = SystemTime::now();
        Self {
            id,
            ip,
            hostname: None,
            name,
            brand,
            model: None,
            protocol,
            port,
            capabilities: vec!["keys".to_string(), "power".to_string()],
            discovery_source: source,
            requires_pairing: false,
            is_paired: false,
            first_seen: now,
            last_seen: now,
        }
    }
}
