//! Tests for Samsung Tizen and LG webOS adapters.

use lookaremote_host_daemon::tv::adapters::{LgWebOsAdapter, SamsungTizenAdapter, TvAdapter};
use lookaremote_host_daemon::tv::discovery::models::{DiscoverySource, TvDevice};
use lookaremote_protocol::messages::tv_commands;
use lookaremote_protocol::messages::tv_target_devices::*;

#[tokio::test]
async fn test_samsung_adapter_lifecycle_and_command_validation() {
    let adapter = SamsungTizenAdapter::new();
    assert_eq!(adapter.brand(), "Samsung");
    assert_eq!(adapter.protocol_id(), SAMSUNG_TIZEN);
    assert!(!adapter.is_paired());

    let device = TvDevice::new(
        "samsung-test".to_string(),
        "127.0.0.1".to_string(),
        "Test Samsung TV".to_string(),
        "Samsung".to_string(),
        SAMSUNG_TIZEN,
        8001,
        DiscoverySource::Manual,
    );

    assert!(adapter.connect(&device).await.is_ok());

    // When TV is offline/unreachable on 127.0.0.1:8001, send_command should return error/timeout cleanly
    let res = adapter.send_command(tv_commands::POWER).await;
    assert!(res.is_err());

    let caps = adapter.get_capabilities();
    assert!(caps.contains(&"keys".to_string()));
    assert!(caps.contains(&"text_input".to_string()));

    assert!(adapter.disconnect().await.is_ok());
}

#[tokio::test]
async fn test_lg_webos_adapter_lifecycle_and_command_validation() {
    let adapter = LgWebOsAdapter::new();
    assert_eq!(adapter.brand(), "LG");
    assert_eq!(adapter.protocol_id(), LG_WEBOS);
    assert!(!adapter.is_paired());

    let device = TvDevice::new(
        "lg-test".to_string(),
        "127.0.0.1".to_string(),
        "Test LG TV".to_string(),
        "LG".to_string(),
        LG_WEBOS,
        3000,
        DiscoverySource::Manual,
    );

    assert!(adapter.connect(&device).await.is_ok());

    let res = adapter.send_command(tv_commands::HOME).await;
    assert!(res.is_err());

    let caps = adapter.get_capabilities();
    assert!(caps.contains(&"volume".to_string()));
    assert!(caps.contains(&"keys".to_string()));

    assert!(adapter.disconnect().await.is_ok());
}
