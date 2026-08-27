//! Controlled capability probe for discovered Smart TV IP addresses.

use crate::tv::discovery::models::{DiscoverySource, TvDevice};
use lookaremote_protocol::messages::tv_target_devices::*;
use std::time::Duration;
use tracing::debug;

/// Non-invasive capability probe
pub struct TvProbe;

impl TvProbe {
    /// Probe a specific IP address on standard TV ports with tight timeout (200ms).
    pub async fn probe_ip(client: &reqwest::Client, ip: &str) -> Option<TvDevice> {
        // 1. Probe Roku ECP (Port 8060)
        let roku_url = format!("http://{}:8060/query/device-info", ip);
        if let Ok(res) = client
            .get(&roku_url)
            .timeout(Duration::from_millis(300))
            .send()
            .await
        {
            if res.status().is_success() {
                if let Ok(text) = res.text().await {
                    let id = extract_xml_tag(&text, "device-id")
                        .unwrap_or_else(|| format!("roku-{}", ip.replace('.', "-")));
                    let model = extract_xml_tag(&text, "model-name")
                        .unwrap_or_else(|| "Roku Device".to_string());
                    let friendly_name = extract_xml_tag(&text, "user-given-name")
                        .unwrap_or_else(|| format!("Roku ({})", model));

                    debug!(ip = %ip, name = %friendly_name, "Probed Roku TV successfully");
                    let mut dev = TvDevice::new(
                        id,
                        ip.to_string(),
                        friendly_name,
                        "Roku".to_string(),
                        ROKU_TV,
                        8060,
                        DiscoverySource::Probe,
                    );
                    dev.model = Some(model);
                    dev.capabilities = vec![
                        "keys".to_string(),
                        "text_input".to_string(),
                        "apps".to_string(),
                        "media".to_string(),
                    ];
                    return Some(dev);
                }
            }
        }

        // 2. Probe Samsung Tizen (Port 8001 /api/v2/)
        let samsung_url = format!("http://{}:8001/api/v2/", ip);
        if let Ok(res) = client
            .get(&samsung_url)
            .timeout(Duration::from_millis(300))
            .send()
            .await
        {
            if res.status().is_success() {
                if let Ok(json) = res.json::<serde_json::Value>().await {
                    let id = json
                        .pointer("/device/id")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string())
                        .unwrap_or_else(|| format!("samsung-{}", ip.replace('.', "-")));
                    let name = json
                        .pointer("/device/name")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string())
                        .unwrap_or_else(|| "Samsung Smart TV".to_string());
                    let model = json
                        .pointer("/device/modelName")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());

                    debug!(ip = %ip, name = %name, "Probed Samsung Smart TV successfully");
                    let mut dev = TvDevice::new(
                        id,
                        ip.to_string(),
                        name,
                        "Samsung".to_string(),
                        SAMSUNG_TIZEN,
                        8001,
                        DiscoverySource::Probe,
                    );
                    dev.model = model;
                    dev.requires_pairing = true;
                    dev.capabilities = vec![
                        "keys".to_string(),
                        "text_input".to_string(),
                        "apps".to_string(),
                        "media".to_string(),
                    ];
                    return Some(dev);
                }
            }
        }

        // 3. Probe Google Cast (Port 8008 /setup/eureka_info)
        let cast_url = format!(
            "http://{}:8008/setup/eureka_info?params=name,device_info",
            ip
        );
        if let Ok(res) = client
            .get(&cast_url)
            .timeout(Duration::from_millis(300))
            .send()
            .await
        {
            if res.status().is_success() {
                if let Ok(json) = res.json::<serde_json::Value>().await {
                    let name = json
                        .get("name")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string())
                        .unwrap_or_else(|| "Google TV".to_string());
                    let id = format!("cast-{}", ip.replace('.', "-"));

                    debug!(ip = %ip, name = %name, "Probed Google Cast / Android TV successfully");
                    let mut dev = TvDevice::new(
                        id,
                        ip.to_string(),
                        name,
                        "Google".to_string(),
                        ANDROID_GOOGLE_TV,
                        8008,
                        DiscoverySource::Probe,
                    );
                    dev.capabilities = vec![
                        "cast".to_string(),
                        "keys".to_string(),
                        "text_input".to_string(),
                    ];
                    return Some(dev);
                }
            }
        }

        None
    }
}

fn extract_xml_tag(xml: &str, tag: &str) -> Option<String> {
    let open_tag = format!("<{}>", tag);
    let close_tag = format!("</{}>", tag);
    let start = xml.find(&open_tag)? + open_tag.len();
    let end = xml[start..].find(&close_tag)?;
    Some(xml[start..start + end].trim().to_string())
}
