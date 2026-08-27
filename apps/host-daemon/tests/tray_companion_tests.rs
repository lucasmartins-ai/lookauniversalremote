//! Tray Companion & QR Code Page Rendering Tests.

use lookaremote_host_daemon::transport::qr_page::render_qr_html;
use lookaremote_host_daemon::tray::TrayConfig;

#[test]
fn test_qr_page_html_rendering() {
    let uri = "lookaremote://pair?host=192.168.1.50&port=8765&key=aabbcc&nonce=112233";
    let html_res = render_qr_html(uri, "192.168.1.50", 8765, 2);
    let html = html_res.0;

    assert!(html.contains("LOOKA<span>REMOTE</span>"));
    assert!(html.contains("192.168.1.50:8765"));
    assert!(html.contains("<svg"));
    assert!(html.contains("P1 (Cyan)"));
    assert!(html.contains("P2 (Magenta)"));
    assert!(html.contains("Active Players: <strong>2/4</strong>"));
}

#[test]
fn test_tray_config_defaults() {
    let cfg = TrayConfig::default();
    assert_eq!(cfg.title, "LookARemote");
    assert!(cfg.enabled);
}
