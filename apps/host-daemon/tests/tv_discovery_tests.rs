//! Tests for Smart TV discovery models, device registry, and SSDP/mDNS parsing.

use lookaremote_host_daemon::tv::discovery::models::{DiscoverySource, TvDevice};
use lookaremote_host_daemon::tv::discovery::registry::DeviceRegistry;
use lookaremote_host_daemon::tv::discovery::ssdp::SsdpDiscovery;
use lookaremote_protocol::messages::tv_target_devices::*;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};

#[test]
fn test_device_registry_upsert_and_ip_update() {
    let registry = DeviceRegistry::new();
    assert_eq!(registry.count(), 0);

    let dev1 = TvDevice::new(
        "samsung-living-room".to_string(),
        "192.168.1.50".to_string(),
        "Living Room TV".to_string(),
        "Samsung".to_string(),
        SAMSUNG_TIZEN,
        8001,
        DiscoverySource::Ssdp,
    );

    registry.upsert_device(dev1);
    assert_eq!(registry.count(), 1);

    let fetched = registry.get_device("samsung-living-room").unwrap();
    assert_eq!(fetched.ip, "192.168.1.50");
    assert_eq!(fetched.brand, "Samsung");

    // Simulate router assigning a new IP address to the same TV
    let dev1_new_ip = TvDevice::new(
        "samsung-living-room".to_string(),
        "192.168.1.75".to_string(),
        "Living Room TV (Renamed)".to_string(),
        "Samsung".to_string(),
        SAMSUNG_TIZEN,
        8001,
        DiscoverySource::Ssdp,
    );

    registry.upsert_device(dev1_new_ip);
    assert_eq!(registry.count(), 1); // Identity is stable, count stays 1!

    let updated = registry.get_device("samsung-living-room").unwrap();
    assert_eq!(updated.ip, "192.168.1.75");
    assert_eq!(updated.name, "Living Room TV (Renamed)");
}

#[test]
fn test_device_registry_selection_and_lookup() {
    let registry = DeviceRegistry::new();

    let dev_lg = TvDevice::new(
        "lg-bedroom".to_string(),
        "192.168.1.60".to_string(),
        "Bedroom LG OLED".to_string(),
        "LG".to_string(),
        LG_WEBOS,
        3000,
        DiscoverySource::Ssdp,
    );

    let dev_roku = TvDevice::new(
        "roku-office".to_string(),
        "192.168.1.61".to_string(),
        "Office Roku Stick".to_string(),
        "Roku".to_string(),
        ROKU_TV,
        8060,
        DiscoverySource::Ssdp,
    );

    registry.upsert_device(dev_lg);
    registry.upsert_device(dev_roku);

    assert_eq!(registry.count(), 2);
    assert!(registry.find_by_ip("192.168.1.60").is_some());
    assert!(registry.find_by_ip("192.168.1.99").is_none());

    assert!(registry.set_selected_device("roku-office".to_string()));
    let selected = registry.get_selected_device().unwrap();
    assert_eq!(selected.id, "roku-office");
    assert_eq!(selected.brand, "Roku");
}

#[test]
fn test_ssdp_response_parsing_roku() {
    let raw_ssdp = "HTTP/1.1 200 OK\r\n\
                    LOCATION: http://192.168.1.80:8060/\r\n\
                    ST: roku:ecp\r\n\
                    USN: uuid:roku:ecp:1234567890\r\n\
                    SERVER: Roku/12.5.0 UPnP/1.0\r\n\r\n";

    let src = SocketAddr::new(IpAddr::V4(Ipv4Addr::new(192, 168, 1, 80)), 1900);
    let parsed = SsdpDiscovery::parse_ssdp_response(raw_ssdp, src).unwrap();

    assert_eq!(parsed.brand, "Roku");
    assert_eq!(parsed.protocol, ROKU_TV);
    assert_eq!(parsed.port, 8060);
    assert_eq!(parsed.ip, "192.168.1.80");
}

#[test]
fn test_ssdp_response_parsing_samsung() {
    let raw_ssdp = "HTTP/1.1 200 OK\r\n\
                    LOCATION: http://192.168.1.90:8001/msf/\r\n\
                    ST: urn:dial-multiscreen-org:service:dial:1\r\n\
                    USN: uuid:samsung-tv-uuid-123::urn:dial-multiscreen-org:service:dial:1\r\n\
                    SERVER: SHP/2.4.0 Tizen/7.0\r\n\r\n";

    let src = SocketAddr::new(IpAddr::V4(Ipv4Addr::new(192, 168, 1, 90)), 1900);
    let parsed = SsdpDiscovery::parse_ssdp_response(raw_ssdp, src).unwrap();

    assert_eq!(parsed.brand, "Samsung");
    assert_eq!(parsed.protocol, SAMSUNG_TIZEN);
    assert_eq!(parsed.port, 8001);
    assert_eq!(parsed.ip, "192.168.1.90");
}
