//! Cyber-styled OLED QR Code pairing page served over local HTTP.

use axum::response::Html;
use qrcode::render::svg;
use qrcode::QrCode;

/// Generates a standalone Cyberpunk / OLED dark-mode HTML page rendering the pairing QR code with high-contrast scanner compatibility.
pub fn render_qr_html(
    pairing_uri: &str,
    host_ip: &str,
    port: u16,
    active_peers: usize,
) -> Html<String> {
    // Render QR Code with dark modules on white background for 100% universal mobile camera recognition
    let svg_code = match QrCode::new(pairing_uri.as_bytes()) {
        Ok(code) => code
            .render::<svg::Color>()
            .min_dimensions(260, 260)
            .dark_color(svg::Color("#000000"))
            .light_color(svg::Color("#FFFFFF"))
            .build(),
        Err(_) => "<div style=\"color:#FF0055\">Failed to generate QR SVG</div>".to_string(),
    };

    let html = format!(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>LookARemote — Connect Device</title>
  <style>
    :root {{
      --bg: #070a0f;
      --card-bg: rgba(15, 23, 36, 0.92);
      --cyan: #00E5FF;
      --magenta: #FF007F;
      --yellow: #FFE600;
      --green: #00FF66;
      --text: #F0F6FC;
      --text-muted: #8B949E;
      --border: rgba(0, 229, 255, 0.3);
    }}
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      background-color: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
      position: relative;
      overflow-x: hidden;
    }}
    body::before {{
      content: '';
      position: fixed;
      inset: 0;
      background-image: 
        linear-gradient(to right, rgba(0, 229, 255, 0.05) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(0, 229, 255, 0.05) 1px, transparent 1px);
      background-size: 32px 32px;
      pointer-events: none;
      z-index: 0;
    }}
    .card {{
      position: relative;
      z-index: 1;
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 28px 24px;
      max-width: 420px;
      width: 100%;
      text-align: center;
      box-shadow: 0 0 40px rgba(0, 229, 255, 0.15);
    }}
    .badge {{
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 14px;
      border-radius: 999px;
      background: rgba(0, 229, 255, 0.12);
      border: 1px solid var(--cyan);
      color: var(--cyan);
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 14px;
    }}
    h1 {{
      font-size: 1.45rem;
      font-weight: 900;
      letter-spacing: 0.05em;
      margin-bottom: 6px;
    }}
    h1 span {{ color: var(--cyan); }}
    p.desc {{
      color: var(--text-muted);
      font-size: 0.82rem;
      margin-bottom: 20px;
      line-height: 1.4;
    }}
    .qr-card {{
      background: #FFFFFF;
      border: 3px solid var(--cyan);
      border-radius: 20px;
      padding: 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
      box-shadow: 0 0 28px rgba(0, 229, 255, 0.35);
    }}
    .qr-card svg {{
      display: block;
      width: 230px;
      height: 230px;
    }}
    .slots-grid {{
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 18px;
    }}
    .slot-pill {{
      padding: 6px 4px;
      border-radius: 8px;
      font-size: 0.7rem;
      font-weight: 700;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: var(--text-muted);
    }}
    .slot-pill.active {{
      background: rgba(0, 229, 255, 0.15);
      border-color: var(--cyan);
      color: #fff;
    }}
    .uri-box {{
      background: rgba(0, 0, 0, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 10px;
      padding: 10px 12px;
      font-family: monospace;
      font-size: 0.72rem;
      color: var(--cyan);
      word-break: break-all;
      text-align: left;
      user-select: all;
      margin-bottom: 12px;
    }}
    .instructions {{
      font-size: 0.75rem;
      color: var(--text-muted);
      line-height: 1.4;
    }}
    .instructions strong {{
      color: #FFFFFF;
    }}
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">Party Mode • 120Hz Ultra-Low Latency</div>
    <h1>LOOKA<span>REMOTE</span></h1>
    <p class="desc">Aponte a câmera do celular para conectar diretamente como controle.</p>

    <div class="qr-card">
      {svg_code}
    </div>

    <div class="slots-grid">
      <div class="slot-pill {p1_class}">P1 (Cyan)</div>
      <div class="slot-pill {p2_class}">P2 (Magenta)</div>
      <div class="slot-pill {p3_class}">P3 (Yellow)</div>
      <div class="slot-pill {p4_class}">P4 (Green)</div>
    </div>

    <div class="uri-box">
      {pairing_uri}
    </div>

    <div class="instructions">
      Host IP: <strong>{host_ip}:{port}</strong> • Jogadores Ativos: <strong>{active_peers}/4</strong>
    </div>
  </div>
</body>
</html>"#,
        svg_code = svg_code,
        p1_class = if active_peers >= 1 { "active" } else { "" },
        p2_class = if active_peers >= 2 { "active" } else { "" },
        p3_class = if active_peers >= 3 { "active" } else { "" },
        p4_class = if active_peers >= 4 { "active" } else { "" },
        pairing_uri = pairing_uri,
        host_ip = host_ip,
        port = port,
        active_peers = active_peers,
    );

    Html(html)
}
