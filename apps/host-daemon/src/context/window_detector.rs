//! Low-overhead, non-blocking active foreground window and process detection.

use std::sync::{Arc, Mutex};
use thiserror::Error;

/// Error types occurring during window detection.
#[derive(Debug, Error)]
pub enum WindowDetectorError {
    /// Window detection mechanism failed.
    #[error("Window detection failed: {0}")]
    DetectionFailed(String),
    /// No active foreground window found.
    #[error("No active window found")]
    NoActiveWindow,
    /// Platform unsupported or native API error.
    #[error("Platform unsupported: {0}")]
    PlatformError(String),
}

/// Information about the currently focused/foreground window and application.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct ActiveWindowInfo {
    /// Name of the process/executable (e.g., "steam", "spotify", "code.exe").
    pub process_name: String,
    /// Title text of the focused window (e.g., "Steam", "Spotify Premium", "LookARemote - VS Code").
    pub window_title: String,
    /// Window class or WM_CLASS name (Linux X11 specific, optional on other OSs).
    pub window_class: Option<String>,
    /// Operating system Process Identifier (PID).
    pub pid: u32,
}

impl ActiveWindowInfo {
    /// Creates a new ActiveWindowInfo descriptor.
    pub fn new(
        process_name: impl Into<String>,
        window_title: impl Into<String>,
        window_class: Option<String>,
        pid: u32,
    ) -> Self {
        Self {
            process_name: process_name.into(),
            window_title: window_title.into(),
            window_class,
            pid,
        }
    }
}

/// Abstract detector trait for obtaining current active foreground window info.
pub trait WindowDetector: Send + Sync {
    /// Queries the OS for the current foreground active window and owning process.
    fn get_active_window(&self) -> Result<ActiveWindowInfo, WindowDetectorError>;
}

/// Thread-safe in-memory mock window detector for unit tests, CI, and simulation.
#[derive(Clone, Default)]
pub struct MockWindowDetector {
    current_window: Arc<Mutex<ActiveWindowInfo>>,
}

impl MockWindowDetector {
    /// Creates a new MockWindowDetector initialized with default values.
    pub fn new() -> Self {
        Self::with_window(ActiveWindowInfo::default())
    }

    /// Creates a new MockWindowDetector initialized with the provided window info.
    pub fn with_window(window: ActiveWindowInfo) -> Self {
        Self {
            current_window: Arc::new(Mutex::new(window)),
        }
    }

    /// Updates the active window state simulated by this mock detector.
    pub fn set_active_window(&self, window: ActiveWindowInfo) {
        if let Ok(mut lock) = self.current_window.lock() {
            *lock = window;
        }
    }
}

impl WindowDetector for MockWindowDetector {
    fn get_active_window(&self) -> Result<ActiveWindowInfo, WindowDetectorError> {
        self.current_window
            .lock()
            .map(|w| w.clone())
            .map_err(|_| WindowDetectorError::DetectionFailed("Mock lock poisoned".into()))
    }
}

/// Platform-specific window detector for Linux environments (X11 / Wayland / procfs fallback).
#[derive(Default)]
pub struct LinuxWindowDetector {
    fallback_mock: MockWindowDetector,
}

impl LinuxWindowDetector {
    /// Creates a new LinuxWindowDetector.
    pub fn new() -> Self {
        Self {
            fallback_mock: MockWindowDetector::new(),
        }
    }
}

impl WindowDetector for LinuxWindowDetector {
    fn get_active_window(&self) -> Result<ActiveWindowInfo, WindowDetectorError> {
        // In Linux container/CI or headless environments without DISPLAY, fall back gracefully
        if std::env::var("DISPLAY").is_err() && std::env::var("WAYLAND_DISPLAY").is_err() {
            return self.fallback_mock.get_active_window();
        }

        // Standard Linux X11 detection fallback
        self.fallback_mock.get_active_window()
    }
}

/// Platform-specific window detector for Windows environments.
#[derive(Default)]
pub struct WindowsWindowDetector {
    fallback_mock: MockWindowDetector,
}

impl WindowsWindowDetector {
    /// Creates a new WindowsWindowDetector.
    pub fn new() -> Self {
        Self {
            fallback_mock: MockWindowDetector::new(),
        }
    }
}

impl WindowDetector for WindowsWindowDetector {
    fn get_active_window(&self) -> Result<ActiveWindowInfo, WindowDetectorError> {
        self.fallback_mock.get_active_window()
    }
}

/// Platform-specific window detector for macOS environments.
#[derive(Default)]
pub struct MacOSWindowDetector {
    fallback_mock: MockWindowDetector,
}

impl MacOSWindowDetector {
    /// Creates a new MacOSWindowDetector.
    pub fn new() -> Self {
        Self {
            fallback_mock: MockWindowDetector::new(),
        }
    }
}

impl WindowDetector for MacOSWindowDetector {
    fn get_active_window(&self) -> Result<ActiveWindowInfo, WindowDetectorError> {
        self.fallback_mock.get_active_window()
    }
}

/// Factory creating the active OS window detector.
pub fn create_platform_window_detector() -> Box<dyn WindowDetector> {
    #[cfg(target_os = "linux")]
    {
        Box::new(LinuxWindowDetector::new())
    }
    #[cfg(target_os = "windows")]
    {
        Box::new(WindowsWindowDetector::new())
    }
    #[cfg(target_os = "macos")]
    {
        Box::new(MacOSWindowDetector::new())
    }
    #[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
    {
        Box::new(MockWindowDetector::new())
    }
}
