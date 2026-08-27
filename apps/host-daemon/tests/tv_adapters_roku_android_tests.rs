//! Tests for Roku ECP and Android / Google TV adapters.

use lookaremote_host_daemon::tv::adapters::{AndroidGoogleTvAdapter, RokuAdapter, TvAdapter};
use lookaremote_host_daemon::tv::discovery::models::{DiscoverySource, TvDevice};
use lookaremote_protocol::messages::tv_target_devices::*;

#[tokio::test]
async fn test_roku_adapter_lifecycle_and_capabilities() {
    let adapter = RokuAdapter::new();
    assert_eq!(adapter.brand(), "Roku");
    assert_eq!(adapter.protocol_id(), ROKU_TV);
    assert!(adapter.is_paired());

    let device = TvDevice::new(
        "roku-test".to_string(),
        "127.0.0.1".to_string(),
        "Test Roku Player".to_string(),
        "Roku".to_string(),
        ROKU_TV,
        8060,
        DiscoverySource::Manual,
    );

    assert!(adapter.connect(&device).await.is_ok());

    let caps = adapter.get_capabilities();
    assert!(caps.contains(&"apps".to_string()));
    assert!(caps.contains(&"keys".to_string()));

    assert!(adapter.disconnect().await.is_ok());
}

#[tokio::test]
async fn test_android_tv_adapter_lifecycle_and_capabilities() {
    let adapter = AndroidGoogleTvAdapter::new();
    assert_eq!(adapter.brand(), "Google");
    assert_eq!(adapter.protocol_id(), ANDROID_GOOGLE_TV);

    let device = TvDevice::new(
        "android-test".to_string(),
        "127.0.0.1".to_string(),
        "Test Google TV".to_string(),
        "Google".to_string(),
        ANDROID_GOOGLE_TV,
        8008,
        DiscoverySource::Manual,
    );

    assert!(adapter.connect(&device).await.is_ok());

    let caps = adapter.get_capabilities();
    assert!(caps.contains(&"cast".to_string()));
    assert!(caps.contains(&"keys".to_string()));

    assert!(adapter.disconnect().await.is_ok());
}
