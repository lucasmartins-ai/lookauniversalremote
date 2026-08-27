//! MSG_TV_COMMAND (0x0C) — Universal Smart TV Command Codes (4 bytes payload).

use crate::header::HEADER_SIZE;
use crate::ProtocolError;

/// Payload size for MSG_TV_COMMAND in bytes.
pub const TV_COMMAND_PAYLOAD_SIZE: usize = 4;
/// Total frame size for MSG_TV_COMMAND in bytes (Header + Payload).
pub const TV_COMMAND_TOTAL_SIZE: usize = HEADER_SIZE + TV_COMMAND_PAYLOAD_SIZE;

/// Universal TV Command codes.
pub mod commands {
    /// Toggle Power / Standby (1).
    pub const POWER: u16 = 1;
    /// Smart TV Home Hub / Dashboard (2).
    pub const HOME: u16 = 2;
    /// Menu / Settings (3).
    pub const MENU_SETTINGS: u16 = 3;
    /// Source / HDMI Input selection (4).
    pub const SOURCE_INPUT: u16 = 4;
    /// Volume up step (5).
    pub const VOLUME_UP: u16 = 5;
    /// Volume down step (6).
    pub const VOLUME_DOWN: u16 = 6;
    /// Mute audio toggle (7).
    pub const MUTE: u16 = 7;
    /// Channel up (8).
    pub const CHANNEL_UP: u16 = 8;
    /// Channel down (9).
    pub const CHANNEL_DOWN: u16 = 9;
    /// Previous channel / Recall (10).
    pub const PREV_CHANNEL: u16 = 10;
    /// Electronic Program Guide / EPG (11).
    pub const GUIDE_EPG: u16 = 11;
    /// On-screen display info (12).
    pub const INFO: u16 = 12;
    /// Directional navigation Up (13).
    pub const DPAD_UP: u16 = 13;
    /// Directional navigation Down (14).
    pub const DPAD_DOWN: u16 = 14;
    /// Directional navigation Left (15).
    pub const DPAD_LEFT: u16 = 15;
    /// Directional navigation Right (16).
    pub const DPAD_RIGHT: u16 = 16;
    /// OK / Select / Enter (17).
    pub const OK_ENTER: u16 = 17;
    /// Back / Return (18).
    pub const BACK: u16 = 18;
    /// Exit / Close modal (19).
    pub const EXIT: u16 = 19;
    /// Numeric digit 0 (20).
    pub const DIGIT_0: u16 = 20;
    /// Numeric digit 1 (21).
    pub const DIGIT_1: u16 = 21;
    /// Numeric digit 2 (22).
    pub const DIGIT_2: u16 = 22;
    /// Numeric digit 3 (23).
    pub const DIGIT_3: u16 = 23;
    /// Numeric digit 4 (24).
    pub const DIGIT_4: u16 = 24;
    /// Numeric digit 5 (25).
    pub const DIGIT_5: u16 = 25;
    /// Numeric digit 6 (26).
    pub const DIGIT_6: u16 = 26;
    /// Numeric digit 7 (27).
    pub const DIGIT_7: u16 = 27;
    /// Numeric digit 8 (28).
    pub const DIGIT_8: u16 = 28;
    /// Numeric digit 9 (29).
    pub const DIGIT_9: u16 = 29;
    /// Teletext / App Color Red (30).
    pub const COLOR_RED: u16 = 30;
    /// Teletext / App Color Green (31).
    pub const COLOR_GREEN: u16 = 31;
    /// Teletext / App Color Yellow (32).
    pub const COLOR_YELLOW: u16 = 32;
    /// Teletext / App Color Blue (33).
    pub const COLOR_BLUE: u16 = 33;
    /// Direct App Launcher: Netflix (34).
    pub const APP_NETFLIX: u16 = 34;
    /// Direct App Launcher: YouTube (35).
    pub const APP_YOUTUBE: u16 = 35;
    /// Direct App Launcher: Amazon Prime Video (36).
    pub const APP_PRIME: u16 = 36;
    /// Direct App Launcher: Disney+ (37).
    pub const APP_DISNEY: u16 = 37;
    /// Direct App Launcher: Spotify (38).
    pub const APP_SPOTIFY: u16 = 38;
    /// Direct App Launcher: Web Browser (39).
    pub const APP_BROWSER: u16 = 39;
    /// Media Play/Pause toggle (40).
    pub const MEDIA_PLAY_PAUSE: u16 = 40;
    /// Media Rewind (41).
    pub const MEDIA_REWIND: u16 = 41;
    /// Media Fast Forward (42).
    pub const MEDIA_FAST_FORWARD: u16 = 42;
    /// Media Stop (43).
    pub const MEDIA_STOP: u16 = 43;
}

/// Target device types for smart routing.
pub mod target_devices {
    /// Generic Smart TV (0).
    pub const GENERIC_TV: u8 = 0;
    /// Samsung Smart TV / Tizen (1).
    pub const SAMSUNG_TIZEN: u8 = 1;
    /// LG Smart TV / webOS (2).
    pub const LG_WEBOS: u8 = 2;
    /// Android TV / Google TV / Fire TV (3).
    pub const ANDROID_GOOGLE_TV: u8 = 3;
    /// Roku TV (4).
    pub const ROKU_TV: u8 = 4;
    /// Sony Bravia TV (5).
    pub const SONY_BRAVIA: u8 = 5;
    /// Apple TV (6).
    pub const APPLE_TV: u8 = 6;
    /// Desktop PC / Mac (7).
    pub const DESKTOP_PC_MAC: u8 = 7;
    /// Gaming Console (8).
    pub const CONSOLE: u8 = 8;
}

/// MSG_TV_COMMAND payload (0x0C) — 4 bytes.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct TvCommandMessage {
    /// Universal TV command code (16-bit LE).
    pub command_code: u16,
    /// Target device type (0..8).
    pub target_device: u8,
    /// Additional flags / modifiers (0x00).
    pub flags: u8,
}

impl TvCommandMessage {
    /// Decode payload from slice of at least 4 bytes.
    #[inline(always)]
    pub fn decode_payload(payload: &[u8]) -> Result<Self, ProtocolError> {
        if payload.len() < TV_COMMAND_PAYLOAD_SIZE {
            return Err(ProtocolError::BufferTooShort {
                expected: TV_COMMAND_PAYLOAD_SIZE,
                actual: payload.len(),
            });
        }

        let command_code = u16::from_le_bytes([payload[0], payload[1]]);
        let target_device = payload[2];
        let flags = payload[3];

        Ok(Self {
            command_code,
            target_device,
            flags,
        })
    }

    /// Encode payload into a fixed 4-byte array.
    #[inline(always)]
    pub fn encode_payload(&self) -> [u8; TV_COMMAND_PAYLOAD_SIZE] {
        let code_bytes = self.command_code.to_le_bytes();
        [code_bytes[0], code_bytes[1], self.target_device, self.flags]
    }

    /// Write encoded payload into a destination slice.
    #[inline(always)]
    pub fn write_payload_to_slice(&self, dest: &mut [u8]) -> Result<(), ProtocolError> {
        if dest.len() < TV_COMMAND_PAYLOAD_SIZE {
            return Err(ProtocolError::BufferTooShort {
                expected: TV_COMMAND_PAYLOAD_SIZE,
                actual: dest.len(),
            });
        }
        dest[..TV_COMMAND_PAYLOAD_SIZE].copy_from_slice(&self.encode_payload());
        Ok(())
    }
}
