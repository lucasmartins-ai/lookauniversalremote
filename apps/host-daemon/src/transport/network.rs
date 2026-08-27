//! Network interface discovery, RFC 1918 validation and WAN isolation protection.

use std::net::{IpAddr, Ipv4Addr, UdpSocket};

/// Network discovery and binding error types.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum NetworkError {
    /// No valid private network interface found (RFC 1918 / loopback).
    NoPrivateInterfaceFound,
    /// Binding to WAN / public IP is rejected unless explicit --allow-wan flag is set.
    WanBindingProhibited(IpAddr),
    /// OS socket error during interface resolution.
    SocketError(String),
}

impl std::fmt::Display for NetworkError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NoPrivateInterfaceFound => {
                write!(
                    f,
                    "no active RFC 1918 private network interface or loopback found"
                )
            }
            Self::WanBindingProhibited(ip) => {
                write!(
                    f,
                    "binding to public WAN address {ip} is rejected for security; pass --allow-wan to override"
                )
            }
            Self::SocketError(msg) => write!(f, "network interface resolution error: {msg}"),
        }
    }
}

impl std::error::Error for NetworkError {}

/// Checks if an IPv4 address belongs to RFC 1918 private ranges or loopback.
pub fn is_rfc1918_or_loopback(ip: &Ipv4Addr) -> bool {
    let octets = ip.octets();
    // 127.0.0.0/8 (Loopback)
    if octets[0] == 127 {
        return true;
    }
    // 10.0.0.0/8
    if octets[0] == 10 {
        return true;
    }
    // 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
    if octets[0] == 172 && (16..=31).contains(&octets[1]) {
        return true;
    }
    // 192.168.0.0/16
    if octets[0] == 192 && octets[1] == 168 {
        return true;
    }
    // 169.254.0.0/16 (IPv4 Link-Local)
    if octets[0] == 169 && octets[1] == 254 {
        return true;
    }
    false
}

/// Checks if an IP address is considered a safe local / private network address.
pub fn is_private_ip(ip: &IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => is_rfc1918_or_loopback(v4),
        IpAddr::V6(v6) => {
            // Loopback ::1
            if v6.is_loopback() {
                return true;
            }
            // Link-local unicast fe80::/10
            let segments = v6.segments();
            (segments[0] & 0xffc0) == 0xfe80
        }
    }
}

/// Discovers the preferred local IP address for LAN communication.
/// Resolves using OS kernel routing table probe (UDP connect trick, no packets sent).
pub fn discover_local_ip(allow_wan: bool) -> Result<IpAddr, NetworkError> {
    // Probe candidates in sequence
    let probe_targets = [
        "192.168.1.1:80",
        "10.0.0.1:80",
        "172.16.0.1:80",
        "8.8.8.8:80",
    ];

    for target in probe_targets {
        if let Ok(socket) = UdpSocket::bind("0.0.0.0:0") {
            if socket.connect(target).is_ok() {
                if let Ok(local_addr) = socket.local_addr() {
                    let ip = local_addr.ip();
                    if is_private_ip(&ip) || allow_wan {
                        return Ok(ip);
                    }
                }
            }
        }
    }

    // Fallback to loopback
    let loopback = IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1));
    Ok(loopback)
}

/// Validates that a target bind address conforms to the security policy.
pub fn validate_bind_address(ip: &IpAddr, allow_wan: bool) -> Result<(), NetworkError> {
    if !allow_wan {
        if ip.is_unspecified() {
            // 0.0.0.0 or :: is rejected without allow_wan
            return Err(NetworkError::WanBindingProhibited(*ip));
        }
        if !is_private_ip(ip) {
            return Err(NetworkError::WanBindingProhibited(*ip));
        }
    }
    Ok(())
}
