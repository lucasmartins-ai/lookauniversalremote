//! Unit tests for WindowDetector, ProfileMatcher, and ContextArbitrator priority hierarchy.

use lookaremote_host_daemon::context::{
    ActiveWindowInfo, ArbitrationSource, ContextArbitrator, ContextConfig, MockWindowDetector,
    ProfileMatcher, TargetControlMode, WindowDetector,
};

#[test]
fn test_toml_config_deserialization() {
    let toml_content = r#"
[daemon]
poll_interval_ms = 400
debounce_ms = 250
default_mode = "Trackpad"

[[profiles]]
name = "Steam & Games"
mode = "Gamepad"
process_names = ["steam", "retroarch", "dolphin.exe"]
window_title_regex = "(?i)(steam|game)"

[[profiles]]
name = "Spotify Media"
mode = "MediaRemote"
process_names = ["spotify", "vlc"]
window_title_regex = "(?i)(spotify|now playing)"

[[profiles]]
name = "Code Editors"
mode = "Keyboard"
process_names = ["code", "nvim"]

[[profiles]]
name = "Desktop Fallback"
mode = "Trackpad"
process_names = ["*"]
"#;

    let config = ContextConfig::from_toml(toml_content).expect("Valid TOML config");
    assert_eq!(config.daemon.poll_interval_ms, 400);
    assert_eq!(config.daemon.debounce_ms, 250);
    assert_eq!(config.daemon.default_mode, TargetControlMode::Trackpad);
    assert_eq!(config.profiles.len(), 4);

    assert_eq!(config.profiles[0].name, "Steam & Games");
    assert_eq!(config.profiles[0].mode, TargetControlMode::Gamepad);
    assert_eq!(config.profiles[1].mode, TargetControlMode::MediaRemote);
    assert_eq!(config.profiles[2].mode, TargetControlMode::Keyboard);
    assert_eq!(config.profiles[3].mode, TargetControlMode::Trackpad);
}

#[test]
fn test_profile_matcher_exact_process_and_regex() {
    let toml_content = r#"
[daemon]
default_mode = "Trackpad"

[[profiles]]
name = "Steam Games"
mode = "Gamepad"
process_names = ["steam", "cyberpunk2077.exe"]
window_title_regex = "(?i)(steam|game)"

[[profiles]]
name = "Media"
mode = "MediaRemote"
process_names = ["spotify", "vlc"]
window_title_regex = "(?i)(spotify|vlc)"

[[profiles]]
name = "Code"
mode = "Keyboard"
process_names = ["code", "nvim"]
"#;

    let config = ContextConfig::from_toml(toml_content).expect("Valid TOML config");
    let matcher = ProfileMatcher::from_config(&config).expect("Matcher creation succeeds");

    // 1. Steam executable match
    let window_steam = ActiveWindowInfo::new("steam", "Steam Client", None, 1234);
    let (matched_prof, mode) = matcher.match_window(&window_steam).expect("Should match steam");
    assert_eq!(matched_prof.name, "Steam Games");
    assert_eq!(mode, TargetControlMode::Gamepad);

    // 2. Case-insensitive .exe match
    let window_cp = ActiveWindowInfo::new("CYBERPUNK2077.EXE", "Cyberpunk 2077", None, 5678);
    let (_, mode_cp) = matcher.match_window(&window_cp).expect("Should match Cyberpunk");
    assert_eq!(mode_cp, TargetControlMode::Gamepad);

    // 3. Regex title match (e.g. browser tab playing Spotify or VLC)
    let window_web_spotify = ActiveWindowInfo::new("chrome", "Spotify — Web Player", None, 9999);
    let (prof_spotify, mode_spotify) = matcher.match_window(&window_web_spotify).expect("Should match Spotify regex");
    assert_eq!(prof_spotify.name, "Media");
    assert_eq!(mode_spotify, TargetControlMode::MediaRemote);

    // 4. Code editor match
    let window_code = ActiveWindowInfo::new("code", "LookARemote - VS Code", None, 4321);
    let (_, mode_code) = matcher.match_window(&window_code).expect("Should match code");
    assert_eq!(mode_code, TargetControlMode::Keyboard);

    // 5. Unmatched process -> None
    let window_unknown = ActiveWindowInfo::new("calculator", "Calculator", None, 1111);
    assert!(matcher.match_window(&window_unknown).is_none());
}

#[test]
fn test_mock_window_detector_mutation() {
    let detector = MockWindowDetector::new();
    let initial = detector.get_active_window().expect("Get active window succeeds");
    assert_eq!(initial.process_name, "");

    let new_window = ActiveWindowInfo::new("retroarch", "RetroArch 1.15", Some("retroarch".into()), 4242);
    detector.set_active_window(new_window.clone());

    let updated = detector.get_active_window().expect("Get active window succeeds");
    assert_eq!(updated, new_window);
}

#[test]
fn test_arbitrator_strict_priority_hierarchy() {
    let mut arbitrator = ContextArbitrator::new(TargetControlMode::Trackpad);
    assert_eq!(arbitrator.current_mode(), TargetControlMode::Trackpad);

    let profile_gamepad = lookaremote_host_daemon::context::ProfileConfig {
        name: "Game".into(),
        mode: TargetControlMode::Gamepad,
        process_names: vec!["game".into()],
        window_title_regex: None,
    };

    let profile_media = lookaremote_host_daemon::context::ProfileConfig {
        name: "Media".into(),
        mode: TargetControlMode::MediaRemote,
        process_names: vec!["spotify".into()],
        window_title_regex: None,
    };

    // LEVEL 4 -> LEVEL 3: Default mode to Profile Match
    let res1 = arbitrator.evaluate(Some((&profile_gamepad, TargetControlMode::Gamepad)), TargetControlMode::Trackpad);
    assert_eq!(res1.active_mode, TargetControlMode::Gamepad);
    assert_eq!(res1.source, ArbitrationSource::ProfileMatch);
    assert!(res1.mode_changed);

    // LEVEL 3 -> LEVEL 2: Manual Client Override (Locked)
    arbitrator.set_manual_override(TargetControlMode::Keyboard, true);
    assert!(arbitrator.is_manual_locked());

    // Even if foreground profile is Media, manual override must win
    let res2 = arbitrator.evaluate(Some((&profile_media, TargetControlMode::MediaRemote)), TargetControlMode::Trackpad);
    assert_eq!(res2.active_mode, TargetControlMode::Keyboard);
    assert_eq!(res2.source, ArbitrationSource::ManualOverride);
    assert!(res2.mode_changed);

    // LEVEL 2 -> LEVEL 1: Emergency Kill Switch
    // When emergency is active, it must override manual lock and reset to default
    arbitrator.set_emergency(true);
    let res3 = arbitrator.evaluate(Some((&profile_media, TargetControlMode::MediaRemote)), TargetControlMode::Trackpad);
    assert_eq!(res3.active_mode, TargetControlMode::Trackpad);
    assert_eq!(res3.source, ArbitrationSource::Emergency);
    assert!(res3.mode_changed);

    // Clear emergency -> Manual override takes effect again
    arbitrator.set_emergency(false);
    let res4 = arbitrator.evaluate(Some((&profile_media, TargetControlMode::MediaRemote)), TargetControlMode::Trackpad);
    assert_eq!(res4.active_mode, TargetControlMode::Keyboard);
    assert_eq!(res4.source, ArbitrationSource::ManualOverride);

    // Clear manual override -> Profile match takes effect
    arbitrator.clear_manual_override();
    assert!(!arbitrator.is_manual_locked());

    let res5 = arbitrator.evaluate(Some((&profile_media, TargetControlMode::MediaRemote)), TargetControlMode::Trackpad);
    assert_eq!(res5.active_mode, TargetControlMode::MediaRemote);
    assert_eq!(res5.source, ArbitrationSource::ProfileMatch);

    // No match -> Fallback to default mode
    let res6 = arbitrator.evaluate(None, TargetControlMode::Trackpad);
    assert_eq!(res6.active_mode, TargetControlMode::Trackpad);
    assert_eq!(res6.source, ArbitrationSource::DefaultMode);
    assert!(res6.mode_changed);
}
