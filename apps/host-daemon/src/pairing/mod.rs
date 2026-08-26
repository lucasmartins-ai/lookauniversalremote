//! Ephemeral pairing, cryptographic key exchange, nonce management and QR generation.

pub mod crypto;
pub mod nonce;
pub mod qr;

pub use crypto::{
    compute_hmac, compute_pairing_proof, verify_hmac, verify_pairing_proof, HostKeyPair,
    PAIRING_HMAC_CONTEXT,
};
pub use nonce::{NonceError, NonceManager};
pub use qr::{build_pairing_uri, render_terminal_qr, CANONICAL_PWA_BASE_URL};
