use lookaremote_host_daemon::drivers::{MockGamepadDriver, MockKeyboardDriver, MockMouseDriver};
use lookaremote_host_daemon::input::events::InputEvent;
use lookaremote_host_daemon::input::router::InputRouter;
use lookaremote_host_daemon::tv::TvDispatcher;
use lookaremote_protocol::messages::tv_commands::*;
use lookaremote_protocol::messages::tv_target_devices::*;
use lookaremote_protocol::messages::{TvCommandMessage, TvTextInputMessage};

#[test]
fn test_tv_dispatcher_samsung_command_generation() {
    let dispatcher = TvDispatcher::new();

    let msg_ch_up = TvCommandMessage {
        command_code: CHANNEL_UP,
        target_device: SAMSUNG_TIZEN,
        flags: 0,
    };
    let res = dispatcher.dispatch_command(&msg_ch_up).unwrap();
    assert!(res.contains("KEY_CHUP"));
    assert!(res.contains("ms.remote.control"));

    let msg_vol_down = TvCommandMessage {
        command_code: VOLUME_DOWN,
        target_device: SAMSUNG_TIZEN,
        flags: 0,
    };
    let res2 = dispatcher.dispatch_command(&msg_vol_down).unwrap();
    assert!(res2.contains("KEY_VOLDOWN"));
}

#[test]
fn test_tv_dispatcher_lg_webos_command_generation() {
    let dispatcher = TvDispatcher::new();

    let msg_ok = TvCommandMessage {
        command_code: OK_ENTER,
        target_device: LG_WEBOS,
        flags: 0,
    };
    let res = dispatcher.dispatch_command(&msg_ok).unwrap();
    assert!(res.contains("ENTER"));
    assert!(res.contains("ssap://com.webos.service.remoteinput/sendKey"));
}

#[test]
fn test_tv_dispatcher_android_google_tv_command_generation() {
    let dispatcher = TvDispatcher::new();

    let msg_home = TvCommandMessage {
        command_code: HOME,
        target_device: ANDROID_GOOGLE_TV,
        flags: 0,
    };
    let res = dispatcher.dispatch_command(&msg_home).unwrap();
    assert_eq!(res, "input keyevent 3"); // KEYCODE_HOME = 3
}

#[test]
fn test_tv_dispatcher_roku_command_generation() {
    let dispatcher = TvDispatcher::new();

    let msg_ch = TvCommandMessage {
        command_code: CHANNEL_UP,
        target_device: ROKU_TV,
        flags: 0,
    };
    let res = dispatcher.dispatch_command(&msg_ch).unwrap();
    assert_eq!(res, "POST /keypress/ChannelUp");
}

#[test]
fn test_tv_text_input_dispatch() {
    let dispatcher = TvDispatcher::new();

    let msg_text = TvTextInputMessage::from_str_truncate("Cyberpunk 2077");
    let res = dispatcher.dispatch_text_input(&msg_text).unwrap();
    assert_eq!(res, "TV_TEXT_INJECT:Cyberpunk 2077");
    assert_eq!(dispatcher.total_text_inputs(), 1);
}

#[test]
fn test_input_router_tv_command_and_text_dispatch() {
    let gamepad = Box::new(MockGamepadDriver::new());
    let mouse = Box::new(MockMouseDriver::new());
    let keyboard = Box::new(MockKeyboardDriver::new());

    let router = InputRouter::with_drivers(gamepad, mouse, keyboard);

    // 1. Dispatch TV Command (Samsung Channel Up)
    let tv_cmd = TvCommandMessage {
        command_code: CHANNEL_UP,
        target_device: SAMSUNG_TIZEN,
        flags: 0,
    };
    router.route_event(&InputEvent::TvCommand(tv_cmd)).unwrap();

    let dispatcher = router.tv_dispatcher();
    assert_eq!(dispatcher.lock().unwrap().total_commands(), 1);

    // 2. Dispatch TV Text Input
    let tv_txt = TvTextInputMessage::from_str_truncate("Breaking Bad");
    router.route_event(&InputEvent::TvTextInput(tv_txt)).unwrap();
    assert_eq!(dispatcher.lock().unwrap().total_text_inputs(), 1);

    // 3. Dispatch Desktop PC/Mac fallback Volume Up
    let pc_vol = TvCommandMessage {
        command_code: VOLUME_UP,
        target_device: DESKTOP_PC_MAC,
        flags: 0,
    };
    router.route_event(&InputEvent::TvCommand(pc_vol)).unwrap();
    assert_eq!(dispatcher.lock().unwrap().total_commands(), 2);
}
