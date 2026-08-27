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
