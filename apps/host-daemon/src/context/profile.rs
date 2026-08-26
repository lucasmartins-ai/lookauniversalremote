//! Declarative TOML application profiles and regex-based matching engine.

use crate::context::window_detector::ActiveWindowInfo;
use lookaremote_protocol::messages::control_modes;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::path::Path;
use thiserror::Error;

/// Target control modes supported by the LookARemote ecosystem.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Default)]
#[serde(rename_all = "PascalCase")]
pub enum TargetControlMode {
    /// Full dual-stick Xbox/PlayStation gamepad emulation.
    Gamepad = 0,
    /// Multi-touch ballistic cursor and gesture trackpad.
    #[default]
    Trackpad = 1,
    /// Full virtual keyboard and productivity macros.
    Keyboard = 2,
    /// Dedicated consumer media playback and volume remote.
    #[serde(alias = "media", alias = "Media", alias = "media_remote")]
    MediaRemote = 3,
}

impl TargetControlMode {
    /// Returns the canonical protocol u8 identifier.
    pub const fn as_u8(&self) -> u8 {
        match self {
            Self::Gamepad => control_modes::GAMEPAD,
            Self::Trackpad => control_modes::TRACKPAD,
            Self::Keyboard => control_modes::KEYBOARD,
            Self::MediaRemote => control_modes::MEDIA_REMOTE,
        }
    }

    /// Converts protocol u8 identifier into TargetControlMode enum.
    pub const fn from_u8(value: u8) -> Option<Self> {
        match value {
            control_modes::GAMEPAD => Some(Self::Gamepad),
            control_modes::TRACKPAD => Some(Self::Trackpad),
            control_modes::KEYBOARD => Some(Self::Keyboard),
            control_modes::MEDIA_REMOTE => Some(Self::MediaRemote),
            _ => None,
        }
    }

    /// Returns human-readable lowercase string.
    pub const fn as_str(&self) -> &'static str {
        match self {
            Self::Gamepad => "gamepad",
            Self::Trackpad => "trackpad",
            Self::Keyboard => "keyboard",
            Self::MediaRemote => "media",
        }
    }
}

/// Errors occurring during profile configuration loading and regex parsing.
#[derive(Debug, Error)]
pub enum ProfileError {
    /// Failed to read configuration file.
    #[error("Failed to read configuration file: {0}")]
    IoError(#[from] std::io::Error),
    /// TOML deserialization syntax error.
    #[error("Failed to parse TOML configuration: {0}")]
    TomlError(#[from] toml::de::Error),
    /// Invalid regex pattern in profile definition.
    #[error("Invalid regex in profile '{profile_name}': {source}")]
    RegexError {
        /// Profile name containing the invalid regex.
        profile_name: String,
        /// Regex compilation error.
        #[source]
        source: regex::Error,
    },
}

/// Global daemon runtime context settings from `[daemon]` in `config.toml`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DaemonSection {
    /// Polling interval for window detection in milliseconds (default: 500ms).
    #[serde(default = "default_poll_interval_ms")]
    pub poll_interval_ms: u64,
    /// Debounce duration before confirming an active window switch in milliseconds (default: 300ms).
    #[serde(default = "default_debounce_ms")]
    pub debounce_ms: u64,
    /// Fallback default mode when no profiles match (default: "Trackpad").
    #[serde(default)]
    pub default_mode: TargetControlMode,
}

fn default_poll_interval_ms() -> u64 {
    500
}

fn default_debounce_ms() -> u64 {
    300
}

impl Default for DaemonSection {
    fn default() -> Self {
        Self {
            poll_interval_ms: 500,
            debounce_ms: 300,
            default_mode: TargetControlMode::Trackpad,
        }
    }
}

/// Declarative application profile rule mapping foreground conditions to a control mode.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileConfig {
    /// User-friendly profile title (e.g., "Steam Big Picture & Games").
    pub name: String,
    /// Target control mode for matched applications.
    pub mode: TargetControlMode,
    /// List of executable / process names (e.g., ["steam", "retroarch", "*"]).
    #[serde(default)]
    pub process_names: Vec<String>,
    /// Optional case-insensitive regular expression tested against the window title.
    #[serde(default)]
    pub window_title_regex: Option<String>,
}

/// Root container for `config.toml` structure.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ContextConfig {
    /// Daemon watcher timing and fallback parameters.
    #[serde(default)]
    pub daemon: DaemonSection,
    /// List of evaluated application profiles in priority order.
    #[serde(default)]
    pub profiles: Vec<ProfileConfig>,
}

impl ContextConfig {
    /// Parses a TOML string into a `ContextConfig`.
    pub fn from_toml(content: &str) -> Result<Self, ProfileError> {
        let config: Self = toml::from_str(content)?;
        Ok(config)
    }

    /// Loads and parses a `config.toml` file from the specified path.
    pub fn from_file<P: AsRef<Path>>(path: P) -> Result<Self, ProfileError> {
        let content = std::fs::read_to_string(path)?;
        Self::from_toml(&content)
    }
}

/// Compiled internal profile with cached Regex for high-performance non-allocating matching.
#[derive(Debug, Clone)]
struct CompiledProfile {
    config: ProfileConfig,
    regex: Option<Regex>,
}

/// High-performance compiled profile matching engine.
#[derive(Debug, Clone)]
pub struct ProfileMatcher {
    profiles: Vec<CompiledProfile>,
    default_mode: TargetControlMode,
}

impl ProfileMatcher {
    /// Compiles a `ContextConfig` into an optimized `ProfileMatcher`.
    pub fn from_config(config: &ContextConfig) -> Result<Self, ProfileError> {
        let mut compiled = Vec::with_capacity(config.profiles.len());

        for prof in &config.profiles {
            let regex = match &prof.window_title_regex {
                Some(pattern) => {
                    let re = Regex::new(pattern).map_err(|e| ProfileError::RegexError {
                        profile_name: prof.name.clone(),
                        source: e,
                    })?;
                    Some(re)
                }
                None => None,
            };

            compiled.push(CompiledProfile {
                config: prof.clone(),
                regex,
            });
        }

        Ok(Self {
            profiles: compiled,
            default_mode: config.daemon.default_mode,
        })
    }

    /// Returns the configured default fallback mode.
    pub fn default_mode(&self) -> TargetControlMode {
        self.default_mode
    }

    /// Matches the given `ActiveWindowInfo` against all registered profiles in order.
    /// Returns the matched `ProfileConfig` and `TargetControlMode` if a match is found.
    pub fn match_window(&self, window: &ActiveWindowInfo) -> Option<(&ProfileConfig, TargetControlMode)> {
        let proc_lower = window.process_name.trim().to_lowercase();
        let proc_clean = proc_lower.strip_suffix(".exe").unwrap_or(&proc_lower);
        let class_lower = window
            .window_class
            .as_deref()
            .map(|c| c.trim().to_lowercase());

        for compiled in &self.profiles {
            let prof = &compiled.config;

            // 1. Process name matching (exact match, substring, or wildcard "*")
            let mut process_matched = false;
            if prof.process_names.iter().any(|p| p == "*") {
                process_matched = true;
            } else {
                for expected in &prof.process_names {
                    let exp_lower = expected.trim().to_lowercase();
                    let exp_clean = exp_lower.strip_suffix(".exe").unwrap_or(&exp_lower);
                    if !proc_clean.is_empty() && (proc_clean == exp_clean || proc_clean.contains(exp_clean)) {
                        process_matched = true;
                        break;
                    }
                    if let Some(ref cls) = class_lower {
                        let cls_clean = cls.strip_suffix(".exe").unwrap_or(cls);
                        if cls_clean == exp_clean || cls_clean.contains(exp_clean) {
                            process_matched = true;
                            break;
                        }
                    }
                }
            }

            // 2. Window title regex matching (if defined)
            let mut regex_matched = false;
            if let Some(ref re) = compiled.regex {
                if !window.window_title.is_empty() && re.is_match(&window.window_title) {
                    regex_matched = true;
                }
            }

            // A profile matches if process name or window title regex matches
            if process_matched || regex_matched {
                return Some((prof, prof.mode));
            }
        }

        None
    }
}
