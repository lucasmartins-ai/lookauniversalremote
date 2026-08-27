//! Isolated TV Adapter trait and structured result models.

use crate::tv::discovery::models::TvDevice;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Structured error variants for TV adapter interactions.
#[derive(Debug, Clone, Error, Serialize, Deserialize)]
#[serde(tag = "error", content = "message")]
pub enum TvError {
    #[error("Device offline or unreachable at {0}")]
    Unreachable(String),
    #[error("Connection failed: {0}")]
    ConnectionFailed(String),
    #[error("Pairing required or pairing rejected: {0}")]
    PairingRequired(String),
    #[error("Authentication failed: {0}")]
    AuthFailed(String),
    #[error("Command execution timeout: {0}")]
    Timeout(String),
    #[error("Command unsupported by target TV platform: {0}")]
    UnsupportedCommand(String),
    #[error("Protocol error: {0}")]
    ProtocolError(String),
    #[error("Internal adapter error: {0}")]
    Internal(String),
}

/// Execution outcome of a TV command.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "status", content = "details")]
pub enum TvCommandResult {
    /// Command accepted and queued for transmission
    Accepted,
    /// Command successfully transmitted over wire
    Sent,
    /// Command confirmed and acknowledged by TV receiver
    Acknowledged(String),
    /// Command execution failed
    Failed(String),
    /// Command timed out waiting for socket write or response
    Timeout,
    /// Command not supported by this platform
    Unsupported,
}

/// Abstract Smart TV Platform Adapter Trait.
#[async_trait]
pub trait TvAdapter: Send + Sync {
    /// Get target vendor brand name (e.g. "Samsung", "LG", "Roku", "Google TV").
    fn brand(&self) -> &'static str;

    /// Get target protocol ID code (0..8).
    fn protocol_id(&self) -> u8;

    /// Connect to a specific TV device.
    async fn connect(&self, device: &TvDevice) -> Result<(), TvError>;

    /// Disconnect from the current TV device.
    async fn disconnect(&self) -> Result<(), TvError>;

    /// Initiate or finalize pairing with TV (e.g. PIN or token exchange).
    async fn pair(&self, pin: Option<&str>) -> Result<String, TvError>;

    /// Check whether this adapter has a valid active pairing/session token.
    fn is_paired(&self) -> bool;

    /// Send a universal TV command code (16-bit) to the TV.
    async fn send_command(&self, cmd: u16) -> Result<TvCommandResult, TvError>;

    /// Send a text string into TV search / text input field.
    async fn send_text(&self, text: &str) -> Result<TvCommandResult, TvError>;

    /// List all capabilities supported by this adapter on the connected device.
    fn get_capabilities(&self) -> Vec<String>;

    /// Perform a health check query.
    async fn health_check(&self) -> Result<bool, TvError>;
}
