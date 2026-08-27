//! TV command mapping tables for Samsung Tizen, LG webOS, Android/Google TV, Roku, and Sony.

use lookaremote_protocol::messages::tv_commands::*;

/// Returns Samsung Tizen key string representation for a given TV command.
pub fn samsung_key_for_command(cmd: u16) -> Option<&'static str> {
    match cmd {
        POWER => Some("KEY_POWER"),
        HOME => Some("KEY_HOME"),
        MENU_SETTINGS => Some("KEY_MENU"),
        SOURCE_INPUT => Some("KEY_SOURCE"),
        VOLUME_UP => Some("KEY_VOLUP"),
        VOLUME_DOWN => Some("KEY_VOLDOWN"),
        MUTE => Some("KEY_MUTE"),
        CHANNEL_UP => Some("KEY_CHUP"),
        CHANNEL_DOWN => Some("KEY_CHDOWN"),
        PREV_CHANNEL => Some("KEY_PRECH"),
        GUIDE_EPG => Some("KEY_GUIDE"),
        INFO => Some("KEY_INFO"),
        DPAD_UP => Some("KEY_UP"),
        DPAD_DOWN => Some("KEY_DOWN"),
        DPAD_LEFT => Some("KEY_LEFT"),
        DPAD_RIGHT => Some("KEY_RIGHT"),
        OK_ENTER => Some("KEY_ENTER"),
        BACK => Some("KEY_RETURN"),
        EXIT => Some("KEY_EXIT"),
        DIGIT_0 => Some("KEY_0"),
        DIGIT_1 => Some("KEY_1"),
        DIGIT_2 => Some("KEY_2"),
        DIGIT_3 => Some("KEY_3"),
        DIGIT_4 => Some("KEY_4"),
        DIGIT_5 => Some("KEY_5"),
        DIGIT_6 => Some("KEY_6"),
        DIGIT_7 => Some("KEY_7"),
        DIGIT_8 => Some("KEY_8"),
        DIGIT_9 => Some("KEY_9"),
        COLOR_RED => Some("KEY_RED"),
        COLOR_GREEN => Some("KEY_GREEN"),
        COLOR_YELLOW => Some("KEY_YELLOW"),
        COLOR_BLUE => Some("KEY_BLUE"),
        APP_NETFLIX => Some("KEY_NETFLIX"),
        APP_YOUTUBE => Some("KEY_YOUTUBE"),
        APP_PRIME => Some("KEY_AMAZON"),
        APP_DISNEY => Some("KEY_DISNEY"),
        APP_SPOTIFY => Some("KEY_SPOTIFY"),
        APP_BROWSER => Some("KEY_INTERNET"),
        MEDIA_PLAY_PAUSE => Some("KEY_PLAY_PAUSE"),
        MEDIA_REWIND => Some("KEY_REWIND"),
        MEDIA_FAST_FORWARD => Some("KEY_FF"),
        MEDIA_STOP => Some("KEY_STOP"),
        _ => None,
    }
}

/// Returns LG webOS SSAP button name for a given TV command.
pub fn lg_key_for_command(cmd: u16) -> Option<&'static str> {
    match cmd {
        POWER => Some("POWER"),
        HOME => Some("HOME"),
        MENU_SETTINGS => Some("MENU"),
        SOURCE_INPUT => Some("INPUT"),
        VOLUME_UP => Some("VOLUMEUP"),
        VOLUME_DOWN => Some("VOLUMEDOWN"),
        MUTE => Some("MUTE"),
        CHANNEL_UP => Some("CHANNELUP"),
        CHANNEL_DOWN => Some("CHANNELDOWN"),
        PREV_CHANNEL => Some("PREVCHANNEL"),
        GUIDE_EPG => Some("GUIDE"),
        INFO => Some("INFO"),
        DPAD_UP => Some("UP"),
        DPAD_DOWN => Some("DOWN"),
        DPAD_LEFT => Some("LEFT"),
        DPAD_RIGHT => Some("RIGHT"),
        OK_ENTER => Some("ENTER"),
        BACK => Some("BACK"),
        EXIT => Some("EXIT"),
        DIGIT_0 => Some("0"),
        DIGIT_1 => Some("1"),
        DIGIT_2 => Some("2"),
        DIGIT_3 => Some("3"),
        DIGIT_4 => Some("4"),
        DIGIT_5 => Some("5"),
        DIGIT_6 => Some("6"),
        DIGIT_7 => Some("7"),
        DIGIT_8 => Some("8"),
        DIGIT_9 => Some("9"),
        COLOR_RED => Some("RED"),
        COLOR_GREEN => Some("GREEN"),
        COLOR_YELLOW => Some("YELLOW"),
        COLOR_BLUE => Some("BLUE"),
        APP_NETFLIX => Some("NETFLIX"),
        APP_YOUTUBE => Some("YOUTUBE"),
        APP_PRIME => Some("AMAZON"),
        APP_DISNEY => Some("DISNEYPLUS"),
        APP_SPOTIFY => Some("SPOTIFY"),
        MEDIA_PLAY_PAUSE => Some("PLAY"),
        MEDIA_REWIND => Some("REWIND"),
        MEDIA_FAST_FORWARD => Some("FASTFORWARD"),
        MEDIA_STOP => Some("STOP"),
        _ => None,
    }
}

/// Returns Android TV / Google TV keycode for a given TV command.
pub fn android_keycode_for_command(cmd: u16) -> Option<u32> {
    match cmd {
        POWER => Some(26),              // KEYCODE_POWER
        HOME => Some(3),                // KEYCODE_HOME
        MENU_SETTINGS => Some(176),     // KEYCODE_SETTINGS
        SOURCE_INPUT => Some(178),      // KEYCODE_TV_INPUT
        VOLUME_UP => Some(24),          // KEYCODE_VOLUME_UP
        VOLUME_DOWN => Some(25),        // KEYCODE_VOLUME_DOWN
        MUTE => Some(164),              // KEYCODE_VOLUME_MUTE
        CHANNEL_UP => Some(166),        // KEYCODE_CHANNEL_UP
        CHANNEL_DOWN => Some(167),      // KEYCODE_CHANNEL_DOWN
        PREV_CHANNEL => Some(229),      // KEYCODE_LAST_CHANNEL
        GUIDE_EPG => Some(172),         // KEYCODE_GUIDE
        INFO => Some(165),              // KEYCODE_INFO
        DPAD_UP => Some(19),            // KEYCODE_DPAD_UP
        DPAD_DOWN => Some(20),          // KEYCODE_DPAD_DOWN
        DPAD_LEFT => Some(21),          // KEYCODE_DPAD_LEFT
        DPAD_RIGHT => Some(22),         // KEYCODE_DPAD_RIGHT
        OK_ENTER => Some(23),           // KEYCODE_DPAD_CENTER
        BACK => Some(4),                // KEYCODE_BACK
        EXIT => Some(111),              // KEYCODE_ESCAPE
        DIGIT_0 => Some(7),             // KEYCODE_0
        DIGIT_1 => Some(8),             // KEYCODE_1
        DIGIT_2 => Some(9),             // KEYCODE_2
        DIGIT_3 => Some(10),            // KEYCODE_3
        DIGIT_4 => Some(11),            // KEYCODE_4
        DIGIT_5 => Some(12),            // KEYCODE_5
        DIGIT_6 => Some(13),            // KEYCODE_6
        DIGIT_7 => Some(14),            // KEYCODE_7
        DIGIT_8 => Some(15),            // KEYCODE_8
        DIGIT_9 => Some(16),            // KEYCODE_9
        COLOR_RED => Some(183),         // KEYCODE_PROG_RED
        COLOR_GREEN => Some(184),       // KEYCODE_PROG_GREEN
        COLOR_YELLOW => Some(185),      // KEYCODE_PROG_YELLOW
        COLOR_BLUE => Some(186),        // KEYCODE_PROG_BLUE
        MEDIA_PLAY_PAUSE => Some(85),   // KEYCODE_MEDIA_PLAY_PAUSE
        MEDIA_REWIND => Some(89),       // KEYCODE_MEDIA_REWIND
        MEDIA_FAST_FORWARD => Some(90), // KEYCODE_MEDIA_FAST_FORWARD
        MEDIA_STOP => Some(86),         // KEYCODE_MEDIA_STOP
        _ => None,
    }
}

/// Returns Roku ECP command path for a given TV command.
pub fn roku_keypress_for_command(cmd: u16) -> Option<&'static str> {
    match cmd {
        POWER => Some("Power"),
        HOME => Some("Home"),
        MENU_SETTINGS => Some("Info"),
        SOURCE_INPUT => Some("InputTuner"),
        VOLUME_UP => Some("VolumeUp"),
        VOLUME_DOWN => Some("VolumeDown"),
        MUTE => Some("VolumeMute"),
        CHANNEL_UP => Some("ChannelUp"),
        CHANNEL_DOWN => Some("ChannelDown"),
        PREV_CHANNEL => Some("PrevChannel"),
        GUIDE_EPG => Some("Guide"),
        INFO => Some("Info"),
        DPAD_UP => Some("Up"),
        DPAD_DOWN => Some("Down"),
        DPAD_LEFT => Some("Left"),
        DPAD_RIGHT => Some("Right"),
        OK_ENTER => Some("Select"),
        BACK => Some("Back"),
        EXIT => Some("Home"),
        COLOR_RED => Some("Red"),
        COLOR_GREEN => Some("Green"),
        COLOR_YELLOW => Some("Yellow"),
        COLOR_BLUE => Some("Blue"),
        MEDIA_PLAY_PAUSE => Some("Play"),
        MEDIA_REWIND => Some("Rev"),
        MEDIA_FAST_FORWARD => Some("Fwd"),
        MEDIA_STOP => Some("Play"),
        _ => None,
    }
}
