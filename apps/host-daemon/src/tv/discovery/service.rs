//! Smart TV Discovery Service coordinating SSDP, mDNS, and capability probes.

use crate::tv::discovery::mdns::MdnsDiscovery;
use crate::tv::discovery::probe::TvProbe;
use crate::tv::discovery::registry::DeviceRegistry;
use crate::tv::discovery::ssdp::SsdpDiscovery;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::task::JoinHandle;
use tracing::{info, warn};

/// Service managing periodic and on-demand LAN Smart TV discovery.
#[derive(Clone)]
pub struct TvDiscoveryService {
    registry: DeviceRegistry,
    http_client: reqwest::Client,
    is_running: Arc<AtomicBool>,
}

impl TvDiscoveryService {
    /// Create a new discovery service attached to the given device registry.
    pub fn new(registry: DeviceRegistry) -> Self {
        let http_client = reqwest::Client::builder()
            .timeout(Duration::from_millis(500))
            .build()
            .unwrap_or_default();

        Self {
            registry,
            http_client,
            is_running: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Access the underlying device registry.
    pub fn registry(&self) -> &DeviceRegistry {
        &self.registry
    }

    /// Run a complete discovery cycle (SSDP + mDNS + probe validation).
    pub async fn run_discovery_cycle(&self) {
        info!("Initiating LAN Smart TV discovery cycle...");

        // 1. Run SSDP Discovery
        let ssdp_devices = SsdpDiscovery::scan(Duration::from_millis(1500)).await;
        for dev in ssdp_devices {
            self.registry.upsert_device(dev);
        }

        // 2. Run mDNS Discovery
        let mdns_devices = MdnsDiscovery::scan(Duration::from_millis(1500)).await;
        for dev in mdns_devices {
            self.registry.upsert_device(dev);
        }

        // 3. Perform probe enrichment on discovered IPs
        let current_devices = self.registry.list_devices();
        for dev in current_devices {
            if let Some(enriched) = TvProbe::probe_ip(&self.http_client, &dev.ip).await {
                self.registry.upsert_device(enriched);
            }
        }

        // 4. Subnet probe fallback if multicast was blocked/isolated on Wi-Fi
        if self.registry.count() == 0 {
            let local_prefix = if let Ok(s) = std::net::UdpSocket::bind("0.0.0.0:0") {
                if s.connect("8.8.8.8:80").is_ok() {
                    if let Ok(addr) = s.local_addr() {
                        let ip_str = addr.ip().to_string();
                        let parts: Vec<&str> = ip_str.split('.').collect();
                        if parts.len() == 4 {
                            Some(format!("{}.{}.{}", parts[0], parts[1], parts[2]))
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                } else {
                    None
                }
            } else {
                None
            };

            let mut prefixes_to_try = Vec::new();
            if let Some(ref p) = local_prefix {
                prefixes_to_try.push(p.clone());
            }
            for cp in &["192.168.1", "192.168.0", "192.168.15", "10.0.0"] {
                if !prefixes_to_try.contains(&cp.to_string()) {
                    prefixes_to_try.push(cp.to_string());
                }
            }

            let common_hosts = [1, 2, 3, 4, 5, 10, 15, 20, 50, 100, 101, 102, 103, 104, 105, 110, 120, 150, 200];
            let mut join_set = tokio::task::JoinSet::new();
            for prefix in prefixes_to_try.into_iter().take(2) {
                for host in common_hosts {
                    let ip = format!("{}.{}", prefix, host);
                    let client = self.http_client.clone();
                    join_set.spawn(async move {
                        TvProbe::probe_ip(&client, &ip).await
                    });
                }
            }

            while let Some(res) = join_set.join_next().await {
                if let Ok(Some(dev)) = res {
                    info!(ip = %dev.ip, brand = %dev.brand, "Discovered Smart TV via subnet probe");
                    self.registry.upsert_device(dev);
                }
            }
        }

        // 4. Prune stale devices (> 15 minutes inactive)
        self.registry.prune_stale(Duration::from_secs(900));

        info!(
            total_discovered = self.registry.count(),
            "Smart TV discovery cycle completed."
        );
    }

    /// Spawn background periodic discovery task (runs every 60s).
    pub fn start_background_discovery(self: Arc<Self>) -> Option<JoinHandle<()>> {
        if self.is_running.swap(true, Ordering::SeqCst) {
            warn!("TV Discovery background task is already running.");
            return None;
        }

        let svc = Arc::clone(&self);
        let handle = tokio::spawn(async move {
            info!("Starting periodic Smart TV discovery task (interval: 60s)");
            // Initial scan on boot
            svc.run_discovery_cycle().await;

            let mut interval = tokio::time::interval(Duration::from_secs(60));
            while svc.is_running.load(Ordering::Relaxed) {
                interval.tick().await;
                svc.run_discovery_cycle().await;
            }
            info!("Periodic Smart TV discovery task terminated.");
        });

        Some(handle)
    }

    /// Stop background discovery task.
    pub fn stop(&self) {
        self.is_running.store(false, Ordering::SeqCst);
    }
}
