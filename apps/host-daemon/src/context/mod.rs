//! Smart Context Engine module for LookARemote.
//!
//! Provides foreground application and window detection, declarative profile matching,
//! priority-based arbitration, and real-time synchronization with mobile clients.

pub mod arbitrator;
pub mod profile;
pub mod watcher;
pub mod window_detector;

pub use arbitrator::{ArbitrationResult, ArbitrationSource, ContextArbitrator};
pub use profile::{
    ContextConfig, DaemonSection, ProfileConfig, ProfileError, ProfileMatcher, TargetControlMode,
};
pub use watcher::{ContextWatcher, ContextWatcherEvent, WatcherDebounceState};
pub use window_detector::{
    create_platform_window_detector, ActiveWindowInfo, MockWindowDetector, WindowDetector,
    WindowDetectorError,
};
