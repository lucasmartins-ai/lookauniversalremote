//! Core daemon configuration, session state machines and shared runtime state.

pub mod config;
pub mod session;
pub mod state;

pub use config::{
    CliArgs, DaemonConfig, DEFAULT_NONCE_TTL_SECS, DEFAULT_PORT, DEFAULT_PWA_ORIGIN,
    DEFAULT_WATCHDOG_CHECK_INTERVAL_MS, DEFAULT_WATCHDOG_TIMEOUT_MS,
};
pub use session::{Session, SessionState};
pub use state::AppState;
