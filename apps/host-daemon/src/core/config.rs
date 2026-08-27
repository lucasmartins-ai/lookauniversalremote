//! Configuration structures and defaults for the LookARemote host daemon.

use clap::Parser;
use std::net::IpAddr;

/// Default signaling server port.
pub const DEFAULT_PORT: u16 = 8765;

/// Default watchdog timeout in milliseconds.
pub const DEFAULT_WATCHDOG_TIMEOUT_MS: u64 = 300;

/// Default watchdog check interval in milliseconds.
pub const DEFAULT_WATCHDOG_CHECK_INTERVAL_MS: u64 = 20;

/// Default pairing nonce TTL in seconds.
pub const DEFAULT_NONCE_TTL_SECS: u64 = 60;

/// Official PWA Web Client origin.
pub const DEFAULT_PWA_ORIGIN: &str = "https://remote.lookaberry.com";

/// Command line arguments for the host daemon.
#[derive(Parser, Debug, Clone)]
#[command(
    name = "lookaremote-host-daemon",
    author = "LookARemote Team",
    version = "0.1.0",
    about = "LookARemote Host Daemon — Ultra-low latency mobile controller input receiver"
)]
pub struct CliArgs {
    /// Port for local signaling server (HTTP & WebSocket)
    #[arg(short, long, default_value_t = DEFAULT_PORT)]
    pub port: u16,

    /// Explicit IP address to bind (must be RFC 1918 unless --allow-wan is enabled)
    #[arg(long)]
    pub bind_addr: Option<IpAddr>,

    /// Allow binding to WAN / public IP addresses (Caution: Security risk!)
    #[arg(long, default_value_t = false)]
    pub allow_wan: bool,

    /// Enable verbose debug logging
    #[arg(short, long, default_value_t = false)]
    pub debug: bool,

    /// Disable terminal QR code printing
    #[arg(long, default_value_t = false)]
    pub no_qr: bool,

    /// Watchdog dead-man switch timeout in milliseconds
    #[arg(long, default_value_t = DEFAULT_WATCHDOG_TIMEOUT_MS)]
    pub watchdog_timeout_ms: u64,

    /// Allowed CORS origin for Web Client
    #[arg(long, default_value = DEFAULT_PWA_ORIGIN)]
    pub allowed_origin: String,

    /// Disable desktop system tray companion icon
    #[arg(long, default_value_t = false)]
    pub no_tray: bool,

    /// Path to config.toml application profile definitions
    #[arg(short, long)]
    pub config_file: Option<String>,
}

/// Runtime configuration for the daemon.
#[derive(Debug, Clone)]
pub struct DaemonConfig {
    /// Port for the local signaling server
    pub port: u16,
    /// Explicit bind address (if provided)
    pub bind_addr: Option<IpAddr>,
    /// Allow binding to public / WAN addresses
    pub allow_wan: bool,
    /// Verbose debug mode
    pub debug: bool,
    /// Disable terminal QR code rendering
    pub no_qr: bool,
    /// Disable desktop system tray companion icon
    pub no_tray: bool,
    /// Watchdog dead-man switch timeout in milliseconds
    pub watchdog_timeout_ms: u64,
    /// Watchdog evaluation loop interval in milliseconds
    pub watchdog_check_interval_ms: u64,
    /// Pairing nonce time-to-live in seconds
    pub nonce_ttl_secs: u64,
    /// Allowed CORS origin
    pub allowed_origin: String,
    /// Path to config.toml application profiles file
    pub config_file: Option<String>,
}

impl Default for DaemonConfig {
    fn default() -> Self {
        Self {
            port: DEFAULT_PORT,
            bind_addr: None,
            allow_wan: false,
            debug: false,
            no_qr: false,
            no_tray: false,
            watchdog_timeout_ms: DEFAULT_WATCHDOG_TIMEOUT_MS,
            watchdog_check_interval_ms: DEFAULT_WATCHDOG_CHECK_INTERVAL_MS,
            nonce_ttl_secs: DEFAULT_NONCE_TTL_SECS,
            allowed_origin: DEFAULT_PWA_ORIGIN.to_string(),
            config_file: None,
        }
    }
}

impl From<CliArgs> for DaemonConfig {
    fn from(args: CliArgs) -> Self {
        Self {
            port: args.port,
            bind_addr: args.bind_addr,
            allow_wan: args.allow_wan,
            debug: args.debug,
            no_qr: args.no_qr,
            no_tray: args.no_tray,
            watchdog_timeout_ms: args.watchdog_timeout_ms,
            watchdog_check_interval_ms: DEFAULT_WATCHDOG_CHECK_INTERVAL_MS,
            nonce_ttl_secs: DEFAULT_NONCE_TTL_SECS,
            allowed_origin: args.allowed_origin,
            config_file: args.config_file,
        }
    }
}
