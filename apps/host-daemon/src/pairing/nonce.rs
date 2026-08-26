//! In-memory single-use pairing nonce manager with strict TTL expiration.

use rand::rngs::OsRng;
use rand::RngCore;
use std::collections::HashMap;
use std::sync::RwLock;
use std::time::{Duration, Instant};

/// Pairing nonce validation errors.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NonceError {
    /// Nonce was not found in storage (either never issued or already consumed/reused).
    NotFoundOrReused,
    /// Nonce TTL has expired (>60s).
    Expired,
}

impl std::fmt::Display for NonceError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NotFoundOrReused => write!(f, "pairing nonce not found or already consumed"),
            Self::Expired => write!(f, "pairing nonce expired (TTL exceeded)"),
        }
    }
}

impl std::error::Error for NonceError {}

/// Tracked nonce entry with absolute expiration instant.
#[derive(Debug, Clone, Copy)]
struct NonceEntry {
    expires_at: Instant,
}

/// Thread-safe Nonce Manager enforcing single-use and 60-second TTL invariants.
pub struct NonceManager {
    nonces: RwLock<HashMap<[u8; 32], NonceEntry>>,
    default_ttl: Duration,
}

impl NonceManager {
    /// Creates a new NonceManager with a specific default TTL.
    pub fn new(default_ttl: Duration) -> Self {
        Self {
            nonces: RwLock::new(HashMap::new()),
            default_ttl,
        }
    }

    /// Creates a new NonceManager with the standard 60-second TTL.
    pub fn with_default_ttl() -> Self {
        Self::new(Duration::from_secs(60))
    }

    /// Generates a new 256-bit CSPRNG nonce and registers it with default TTL.
    pub fn generate_nonce(&self) -> [u8; 32] {
        self.generate_nonce_with_ttl(self.default_ttl)
    }

    /// Generates a new 256-bit CSPRNG nonce with custom TTL.
    pub fn generate_nonce_with_ttl(&self, ttl: Duration) -> [u8; 32] {
        let mut nonce = [0u8; 32];
        OsRng.fill_bytes(&mut nonce);

        let entry = NonceEntry {
            expires_at: Instant::now() + ttl,
        };

        if let Ok(mut lock) = self.nonces.write() {
            lock.insert(nonce, entry);
        }

        nonce
    }

    /// Validates and immediately consumes a nonce (single-use purge).
    /// Prevents replay attacks by ensuring a nonce can never be consumed twice.
    pub fn validate_and_consume(&self, nonce: &[u8; 32]) -> Result<(), NonceError> {
        let mut lock = self
            .nonces
            .write()
            .map_err(|_| NonceError::NotFoundOrReused)?;

        let entry = lock.remove(nonce).ok_or(NonceError::NotFoundOrReused)?;

        if Instant::now() > entry.expires_at {
            Err(NonceError::Expired)
        } else {
            Ok(())
        }
    }

    /// Checks if a nonce is currently registered and non-expired without consuming it (useful for inspection).
    pub fn is_valid(&self, nonce: &[u8; 32]) -> bool {
        if let Ok(lock) = self.nonces.read() {
            if let Some(entry) = lock.get(nonce) {
                return Instant::now() <= entry.expires_at;
            }
        }
        false
    }

    /// Purges all expired nonces from memory.
    pub fn cleanup_expired(&self) -> usize {
        let now = Instant::now();
        if let Ok(mut lock) = self.nonces.write() {
            let initial_len = lock.len();
            lock.retain(|_, entry| entry.expires_at >= now);
            initial_len.saturating_sub(lock.len())
        } else {
            0
        }
    }

    /// Returns the number of currently active registered nonces.
    pub fn active_count(&self) -> usize {
        self.nonces.read().map(|l| l.len()).unwrap_or(0)
    }
}

impl Default for NonceManager {
    fn default() -> Self {
        Self::with_default_ttl()
    }
}
