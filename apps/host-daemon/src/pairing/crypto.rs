//! Cryptographic primitives for ephemeral key exchange and HMAC authentication.

use hmac::{Hmac, Mac};
use rand::rngs::OsRng;
use sha2::Sha256;
use x25519_dalek::{PublicKey, StaticSecret};

type HmacSha256 = Hmac<Sha256>;

/// Ephemeral X25519 keypair held in memory by the host daemon.
pub struct HostKeyPair {
    secret: StaticSecret,
    public: PublicKey,
}

impl HostKeyPair {
    /// Generates a new cryptographically secure ephemeral X25519 keypair.
    pub fn generate() -> Self {
        let secret = StaticSecret::random_from_rng(OsRng);
        let public = PublicKey::from(&secret);
        Self { secret, public }
    }

    /// Returns the public key reference.
    pub fn public_key(&self) -> &PublicKey {
        &self.public
    }

    /// Returns the 32-byte public key representation.
    pub fn public_key_bytes(&self) -> [u8; 32] {
        *self.public.as_bytes()
    }

    /// Returns the lower-case hex encoded public key.
    pub fn public_key_hex(&self) -> String {
        hex::encode(self.public.as_bytes())
    }

    /// Computes the Diffie-Hellman shared secret with a client's public key.
    pub fn diffie_hellman(&self, client_public: &PublicKey) -> [u8; 32] {
        let shared = self.secret.diffie_hellman(client_public);
        *shared.as_bytes()
    }
}

impl Default for HostKeyPair {
    fn default() -> Self {
        Self::generate()
    }
}

/// Computes an HMAC-SHA256 signature over data using the provided secret key.
pub fn compute_hmac(key: &[u8], data: &[u8]) -> [u8; 32] {
    let mut mac = HmacSha256::new_from_slice(key).expect("HMAC can take key of any size");
    mac.update(data);
    let result = mac.finalize();
    let mut out = [0u8; 32];
    out.copy_from_slice(&result.into_bytes());
    out
}

/// Verifies an HMAC-SHA256 signature in constant time.
pub fn verify_hmac(key: &[u8], data: &[u8], expected_hmac: &[u8]) -> bool {
    if expected_hmac.len() != 32 {
        return false;
    }
    if let Ok(mut mac) = HmacSha256::new_from_slice(key) {
        mac.update(data);
        mac.verify_slice(expected_hmac).is_ok()
    } else {
        false
    }
}

/// Canonical context string prefixed to pairing HMAC calculations.
pub const PAIRING_HMAC_CONTEXT: &[u8] = b"LOOKAREMOTE_PAIRING_V1:";

/// Verifies pairing proof sent by client: HMAC-SHA256(shared_secret, PAIRING_HMAC_CONTEXT || nonce).
pub fn verify_pairing_proof(
    shared_secret: &[u8; 32],
    nonce: &[u8; 32],
    expected_proof: &[u8],
) -> bool {
    let mut message = Vec::with_capacity(PAIRING_HMAC_CONTEXT.len() + nonce.len());
    message.extend_from_slice(PAIRING_HMAC_CONTEXT);
    message.extend_from_slice(nonce);
    verify_hmac(shared_secret, &message, expected_proof)
}

/// Computes client pairing proof: HMAC-SHA256(shared_secret, PAIRING_HMAC_CONTEXT || nonce).
pub fn compute_pairing_proof(shared_secret: &[u8; 32], nonce: &[u8; 32]) -> [u8; 32] {
    let mut message = Vec::with_capacity(PAIRING_HMAC_CONTEXT.len() + nonce.len());
    message.extend_from_slice(PAIRING_HMAC_CONTEXT);
    message.extend_from_slice(nonce);
    compute_hmac(shared_secret, &message)
}
