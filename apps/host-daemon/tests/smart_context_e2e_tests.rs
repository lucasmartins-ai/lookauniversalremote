//! End-to-end tests for Smart Context debounce, event dispatch, and MSG_MODE_SWITCH protocol broadcast.

use lookaremote_host_daemon::context::{
    ActiveWindowInfo, ArbitrationSource, ContextArbitrator, ContextConfig, ContextWatcher,
    DaemonSection, MockWindowDetector, ProfileConfig, ProfileMatcher, TargetControlMode,
    WatcherDebounceState,
};
use lookaremote_protocol::messages::{control_modes, mode_switch_flags, ModeSwitchMessage};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;

#[tokio::test]
async fn test_smart_context_debounce_and_mode_switching() {
    let detector = Arc::new(MockWindowDetector::new());

    let config = ContextConfig {
        daemon: DaemonSection {
            poll_interval_ms: 10,
            debounce_ms: 50,
            default_mode: TargetControlMode::Trackpad,
        },
        profiles: vec![
            ProfileConfig {
                name: "Steam Games".into(),
                mode: TargetControlMode::Gamepad,
                process_names: vec!["steam".into(), "retroarch".into()],
                window_title_regex: None,
            },
            ProfileConfig {
                name: "Spotify Player".into(),
                mode: TargetControlMode::MediaRemote,
                process_names: vec!["spotify".into()],
                window_title_regex: None,
            },
        ],
    };

    let matcher =
        Arc::new(ProfileMatcher::from_config(&config).expect("Matcher creation succeeds"));
    let arbitrator = Arc::new(Mutex::new(ContextArbitrator::new(
        TargetControlMode::Trackpad,
    )));

    let watcher = ContextWatcher::new(
        Arc::clone(&detector) as Arc<dyn lookaremote_host_daemon::context::WindowDetector>,
        Arc::clone(&matcher),
        Arc::clone(&arbitrator),
        config.daemon.clone(),
    );

    let mut subscriber = watcher.subscribe();
    let mut debounce_state = WatcherDebounceState::default();

    // 1. Initial State (Empty window) -> matches DefaultMode (Trackpad)
    let ev1 = watcher
        .poll_step(&mut debounce_state)
        .await
        .expect("Initial poll step succeeds");
    assert_eq!(ev1.arbitration.active_mode, TargetControlMode::Trackpad);
    assert_eq!(ev1.arbitration.source, ArbitrationSource::DefaultMode);
    let rx1 = subscriber
        .recv()
        .await
        .expect("Initial broadcast event received");
    assert_eq!(rx1.arbitration.active_mode, TargetControlMode::Trackpad);

    // 2. Change active window to "steam" (First observation: debounce timer starts, returns None)
    detector.set_active_window(ActiveWindowInfo::new("steam", "Steam", None, 1001));
    let pending = watcher.poll_step(&mut debounce_state).await;
    assert!(
        pending.is_none(),
        "Debounce window is stabilizing; should return None"
    );

    // 3. Fast forward past debounce window (50ms)
    tokio::time::sleep(Duration::from_millis(60)).await;

    // 4. Second observation: Debounce period confirmed -> Switches to Gamepad
    let ev2 = watcher
        .poll_step(&mut debounce_state)
        .await
        .expect("Confirmed poll step succeeds");
    assert_eq!(ev2.arbitration.active_mode, TargetControlMode::Gamepad);
    assert_eq!(ev2.arbitration.source, ArbitrationSource::ProfileMatch);
    assert_eq!(
        ev2.arbitration.matched_profile_name.as_deref(),
        Some("Steam Games")
    );
    assert!(ev2.arbitration.mode_changed);

    // Verify event received on broadcast subscriber
    let rx2 = subscriber
        .recv()
        .await
        .expect("Broadcast event for Gamepad received");
    assert_eq!(rx2.arbitration.active_mode, TargetControlMode::Gamepad);

    // 5. Client sends explicit mode switch request (Manual Override to Media Remote)
    let client_req = ModeSwitchMessage::new(
        control_modes::MEDIA_REMOTE,
        mode_switch_flags::IS_MANUAL_OVERRIDE,
    );
    let switch_res = watcher.handle_client_mode_switch(&client_req).await;
    assert_eq!(switch_res.active_mode, TargetControlMode::MediaRemote);
    assert_eq!(switch_res.source, ArbitrationSource::ManualOverride);

    // 6. Even when window stays on "steam", client manual override holds
    let ev3 = watcher
        .poll_step(&mut debounce_state)
        .await
        .expect("Poll step succeeds");
    assert_eq!(ev3.arbitration.active_mode, TargetControlMode::MediaRemote);
    assert_eq!(ev3.arbitration.source, ArbitrationSource::ManualOverride);
}
