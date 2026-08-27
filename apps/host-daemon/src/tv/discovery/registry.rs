//! Thread-safe Smart TV Device Registry with persistent identity tracking.

use crate::tv::discovery::models::TvDevice;
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::{Duration, SystemTime};
use tracing::{debug, info};

/// Thread-safe Smart TV device cache and registry.
#[derive(Debug, Clone, Default)]
pub struct DeviceRegistry {
    devices: Arc<RwLock<HashMap<String, TvDevice>>>,
    selected_device_id: Arc<RwLock<Option<String>>>,
}

impl DeviceRegistry {
    /// Create a new empty device registry.
    pub fn new() -> Self {
        Self {
            devices: Arc::new(RwLock::new(HashMap::new())),
            selected_device_id: Arc::new(RwLock::new(None)),
        }
    }

    /// Register or update a discovered TV device.
    /// Preserves stable identity, pairing tokens, and recognizes IP changes.
    pub fn upsert_device(&self, mut device: TvDevice) {
        if let Ok(mut lock) = self.devices.write() {
            device.last_seen = SystemTime::now();

            if let Some(existing) = lock.get_mut(&device.id) {
                if existing.ip != device.ip {
                    info!(
                        id = %device.id,
                        old_ip = %existing.ip,
                        new_ip = %device.ip,
                        "Recognized IP change for existing Smart TV"
                    );
                    existing.ip = device.ip;
                }
                existing.last_seen = device.last_seen;
                existing.name = device.name;
                existing.capabilities = device.capabilities;
                if device.model.is_some() {
                    existing.model = device.model;
                }
                debug!(id = %device.id, "Updated Smart TV in registry");
            } else {
                info!(
                    id = %device.id,
                    name = %device.name,
                    brand = %device.brand,
                    ip = %device.ip,
                    "Discovered new Smart TV on LAN"
                );
                lock.insert(device.id.clone(), device);
            }
        }
    }

    /// Retrieve all currently registered TV devices.
    pub fn list_devices(&self) -> Vec<TvDevice> {
        if let Ok(lock) = self.devices.read() {
            lock.values().cloned().collect()
        } else {
            Vec::new()
        }
    }

    /// Find a device by its stable unique ID.
    pub fn get_device(&self, id: &str) -> Option<TvDevice> {
        if let Ok(lock) = self.devices.read() {
            lock.get(id).cloned()
        } else {
            None
        }
    }

    /// Find a device by its LAN IP address.
    pub fn find_by_ip(&self, ip: &str) -> Option<TvDevice> {
        if let Ok(lock) = self.devices.read() {
            lock.values().find(|d| d.ip == ip).cloned()
        } else {
            None
        }
    }

    /// Set the currently selected / active TV device ID.
    pub fn set_selected_device(&self, id: String) -> bool {
        if self.get_device(&id).is_some() {
            if let Ok(mut lock) = self.selected_device_id.write() {
                *lock = Some(id);
                return true;
            }
        }
        false
    }

    /// Get the currently active / selected TV device, if any.
    pub fn get_selected_device(&self) -> Option<TvDevice> {
        let sel_id = self.selected_device_id.read().ok()?.clone();
        if let Some(id) = sel_id {
            self.get_device(&id)
        } else {
            // Default to first available device in registry
            self.list_devices().into_iter().next()
        }
    }

    /// Prune devices that have not been seen for longer than `max_age`.
    pub fn prune_stale(&self, max_age: Duration) {
        if let Ok(mut lock) = self.devices.write() {
            let now = SystemTime::now();
            lock.retain(|_, dev| {
                if let Ok(elapsed) = now.duration_since(dev.last_seen) {
                    elapsed <= max_age
                } else {
                    true
                }
            });
        }
    }

    /// Total number of discovered devices.
    pub fn count(&self) -> usize {
        self.devices.read().map(|l| l.len()).unwrap_or(0)
    }
}
