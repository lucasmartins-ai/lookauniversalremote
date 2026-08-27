//! Integration and unit tests for X25519 pairing, NonceManager, and HMAC-SHA256 authentication.

use lookaremote_host_daemon::pairing::crypto::{
    compute_hmac, compute_pairing_proof, verify_hmac, verify_pairing_proof, HostKeyPair,
};
use lookaremote_host_daemon::pairing::nonce::{NonceError, NonceManager};
use lookaremote_host_daemon::pairing::qr::build_pairing_uri;
use rand::rngs::OsRng;
use std::time::Duration;
use x25519_dalek::{PublicKey, StaticSecret};

#[test]
fn test_x25519_diffie_hellman_symmetry() {
    let host = HostKeyPair::generate();
    let client_secret = StaticSecret::random_from_rng(OsRng);
    let client_public = PublicKey::from(&client_secret);

    // Host computes shared secret using client's public key
    let host_shared = host.diffie_hellman(&client_public);

    // Client computes shared secret using host's public key
    let client_shared = client_secret.diffie_hellman(host.public_key());

    assert_eq!(
        host_shared,
        *client_shared.as_bytes(),
        "Host and Client shared secrets must match symmetrically"
    );
}

#[test]
fn test_nonce_manager_lifecycle_and_single_use() {
    let nonce_mgr = NonceManager::with_default_ttl();
    let nonce = nonce_mgr.generate_nonce();

    assert_eq!(nonce_mgr.active_count(), 1);
    assert!(nonce_mgr.is_valid(&nonce));

    // First consumption must succeed
    let result = nonce_mgr.validate_and_consume(&nonce);
    assert!(result.is_ok(), "First consumption should succeed");
    assert_eq!(nonce_mgr.active_count(), 0);

    // Second consumption (Replay Attack) must fail with NotFoundOrReused
    let replay_result = nonce_mgr.validate_and_consume(&nonce);
    assert_eq!(
        replay_result,
        Err(NonceError::NotFoundOrReused),
        "Replaying an already consumed nonce must be rejected"
    );
}

#[test]
fn test_nonce_manager_ttl_expiration() {
    // Nonce manager with very short TTL of 50ms
    let nonce_mgr = NonceManager::new(Duration::from_millis(50));
    let nonce = nonce_mgr.generate_nonce();

    // Valid immediately
    assert!(nonce_mgr.is_valid(&nonce));

    // Sleep past TTL
    std::thread::sleep(Duration::from_millis(70));

    // Consumption after expiration must fail with Expired
    let expired_result = nonce_mgr.validate_and_consume(&nonce);
    assert_eq!(
        expired_result,
        Err(NonceError::Expired),
        "Nonce past TTL must return Expired error"
    );

    // Once expired and removed, further attempts return NotFoundOrReused
    assert_eq!(
        nonce_mgr.validate_and_consume(&nonce),
        Err(NonceError::NotFoundOrReused)
    );
}

#[test]
fn test_nonce_manager_cleanup_expired() {
    let nonce_mgr = NonceManager::new(Duration::from_millis(40));
    let _n1 = nonce_mgr.generate_nonce();
    let _n2 = nonce_mgr.generate_nonce();
    assert_eq!(nonce_mgr.active_count(), 2);

    std::thread::sleep(Duration::from_millis(60));

    let purged = nonce_mgr.cleanup_expired();
    assert_eq!(purged, 2);
    assert_eq!(nonce_mgr.active_count(), 0);
}

#[test]
fn test_hmac_sha256_verification_and_tampering() {
    let key = [0x42u8; 32];
    let data = b"LOOKAREMOTE_TEST_PAYLOAD";

    let signature = compute_hmac(&key, data);
    assert!(verify_hmac(&key, data, &signature));

    // Tampered data
    let tampered_data = b"LOOKAREMOTE_TEST_PAYLOAD_TAMPERED";
    assert!(!verify_hmac(&key, tampered_data, &signature));

    // Tampered key
    let mut wrong_key = key;
    wrong_key[0] ^= 0xFF;
    assert!(!verify_hmac(&wrong_key, data, &signature));

    // Tampered signature
    let mut tampered_sig = signature;
    tampered_sig[31] ^= 0x01;
    assert!(!verify_hmac(&key, data, &tampered_sig));
}

#[test]
fn test_pairing_proof_handshake() {
    let host = HostKeyPair::generate();
    let client_secret = StaticSecret::random_from_rng(OsRng);
    let client_public = PublicKey::from(&client_secret);

    let shared_secret = host.diffie_hellman(&client_public);
    let nonce = [0xABu8; 32];

    // Client generates proof
    let client_proof = compute_pairing_proof(&shared_secret, &nonce);

    // Host verifies proof
    assert!(
        verify_pairing_proof(&shared_secret, &nonce, &client_proof),
        "Valid proof must verify successfully"
    );

    // Invalid proof with wrong nonce
    let wrong_nonce = [0xCDu8; 32];
    assert!(
        !verify_pairing_proof(&shared_secret, &wrong_nonce, &client_proof),
        "Proof with mismatched nonce must fail"
    );
}

#[test]
fn test_pairing_uri_construction() {
    let uri = build_pairing_uri("192.168.1.100", 8765, "deadbeef01", "cafebabe02");
    assert_eq!(
        uri,
        "https://lookauniversalremote.vercel.app/#h=192.168.1.100&p=8765&k=deadbeef01&n=cafebabe02&v=1"
    );
}
