//! Canonical pairing URI construction and terminal ANSI QR code rendering.

use qrcode::render::unicode::Dense1x2;
use qrcode::QrCode;

/// Base URL for the official LookARemote Web Client.
pub const CANONICAL_PWA_BASE_URL: &str = "https://lookauniversalremote.vercel.app";

/// QR generation error type.
#[derive(Debug)]
pub enum QrError {
    /// Failed to encode data into QR matrix.
    Encoding(qrcode::types::QrError),
}

impl std::fmt::Display for QrError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Encoding(e) => write!(f, "QR code generation failed: {e}"),
        }
    }
}

impl std::error::Error for QrError {}

/// Builds canonical pairing URI for the mobile PWA client (Cloud Hosted).
/// Format: `https://lookauniversalremote.vercel.app/#h=<HOST_IP>&p=<PORT>&k=<HOST_PUBKEY_HEX>&n=<NONCE_HEX>&v=1`
pub fn build_pairing_uri(
    host_ip: &str,
    port: u16,
    host_pubkey_hex: &str,
    nonce_hex: &str,
) -> String {
    let base = CANONICAL_PWA_BASE_URL.trim_end_matches('/');
    format!(
        "{}/#h={}&p={}&k={}&n={}&v=1",
        base, host_ip, port, host_pubkey_hex, nonce_hex
    )
}

/// Builds direct local LAN pairing URI served directly by the daemon.
/// Format: `http://<HOST_IP>:<PORT>/#h=<HOST_IP>&p=<PORT>&k=<HOST_PUBKEY_HEX>&n=<NONCE_HEX>&v=1`
pub fn build_local_pairing_uri(
    host_ip: &str,
    port: u16,
    host_pubkey_hex: &str,
    nonce_hex: &str,
) -> String {
    format!(
        "http://{}:{}/#h={}&p={}&k={}&n={}&v=1",
        host_ip, port, host_ip, port, host_pubkey_hex, nonce_hex
    )
}

/// Renders a QR code as a compact high-density Unicode string suitable for terminal display.
pub fn render_terminal_qr(uri: &str) -> Result<String, QrError> {
    let code = QrCode::new(uri.as_bytes()).map_err(QrError::Encoding)?;
    let rendered = code
        .render::<Dense1x2>()
        .dark_color(Dense1x2::Light)
        .light_color(Dense1x2::Dark)
        .quiet_zone(true)
        .build();
    Ok(rendered)
}
