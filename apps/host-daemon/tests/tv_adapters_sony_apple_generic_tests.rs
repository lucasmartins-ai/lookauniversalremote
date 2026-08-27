//! Tests for Sony Bravia, Apple TV, and Generic TV adapters.

use lookaremote_host_daemon::tv::adapters::{
    AppleTvAdapter, GenericTvAdapter, SonyBraviaAdapter, TvAdapter, TvCommandResult,
};
use lookaremote_host_daemon::tv::discovery::models::{DiscoverySource, TvDevice};
use lookaremote_protocol::messages::tv_commands;
use lookaremote_protocol::messages::tv_target_devices::*;

#[tokio::test]
async fn test_sony_bravia_adapter_lifecycle() {
    let adapter = SonyBraviaAdapter::new();
    assert_eq!(adapter.brand(), "Sony");
    assert_eq!(adapter.protocol_id(), SONY_BRAVIA);

    let device = TvDevice::new(
        "sony-test".to_string(),
        "127.0.0.1".to_string(),
        "Sony Bravia Test".to_string(),
        "Sony".to_string(),
        SONY_BRAVIA,
        80,
        DiscoverySource::Manual,
    );

    assert!(adapter.connect(&device).await.is_ok());

    let caps = adapter.get_capabilities();
    assert!(caps.contains(&"keys".to_string()));
    assert!(caps.contains(&"power".to_string()));

    assert!(adapter.disconnect().await.is_ok());
}

#[tokio::test]
async fn test_apple_tv_adapter_explicit_unsupported_states() {
    let adapter = AppleTvAdapter::new();
    assert_eq!(adapter.brand(), "Apple");
    assert_eq!(adapter.protocol_id(), APPLE_TV);
    assert!(!adapter.is_paired());

    let device = TvDevice::new(
        "appletv-test".to_string(),
        "127.0.0.1".to_string(),
        "Apple TV Living Room".to_string(),
        "Apple".to_string(),
        APPLE_TV,
        7000,
        DiscoverySource::Manual,
    );

    assert!(adapter.connect(&device).await.is_ok());

    // Commands not supported without SRP/MRP pairing return Unsupported
    let res = adapter.send_command(tv_commands::HOME).await;
    assert_eq!(res.unwrap(), TvCommandResult::Unsupported);

    assert!(adapter.disconnect().await.is_ok());
}

#[tokio::test]
async fn test_generic_tv_dlna_adapter_lifecycle() {
    let adapter = GenericTvAdapter::new();
    assert_eq!(adapter.brand(), "Generic");
    assert_eq!(adapter.protocol_id(), GENERIC_TV);

    let device = TvDevice::new(
        "generic-test".to_string(),
        "127.0.0.1".to_string(),
        "Generic DLNA TV".to_string(),
        "Generic".to_string(),
        GENERIC_TV,
        80,
        DiscoverySource::Manual,
    );

    assert!(adapter.connect(&device).await.is_ok());

    let caps = adapter.get_capabilities();
    assert!(caps.contains(&"dlna".to_string()));
    assert!(caps.contains(&"media".to_string()));

    assert!(adapter.disconnect().await.is_ok());
}
