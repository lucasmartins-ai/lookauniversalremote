//! TvAdapterManager routing incoming protocol commands to isolated vendor adapters.

use crate::tv::adapters::traits::{TvAdapter, TvCommandResult, TvError};
use crate::tv::discovery::registry::DeviceRegistry;
use lookaremote_protocol::messages::{TvCommandMessage, TvTextInputMessage};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, RwLock};
use tracing::{debug, info, warn};

/// Adapter Manager coordinating TV vendor adapters and active device routing.
pub struct TvAdapterManager {
    adapters: Arc<RwLock<HashMap<u8, Arc<dyn TvAdapter>>>>,
    registry: DeviceRegistry,
    commands_routed: AtomicU64,
    text_routed: AtomicU64,
}

impl TvAdapterManager {
    /// Create a new adapter manager attached to the given device registry.
    pub fn new(registry: DeviceRegistry) -> Self {
        Self {
            adapters: Arc::new(RwLock::new(HashMap::new())),
            registry,
            commands_routed: AtomicU64::new(0),
            text_routed: AtomicU64::new(0),
        }
    }

    /// Register a vendor adapter instance for a protocol ID.
    pub fn register_adapter(&self, adapter: Arc<dyn TvAdapter>) {
        let proto = adapter.protocol_id();
        let brand = adapter.brand();
        if let Ok(mut lock) = self.adapters.write() {
            info!(protocol = proto, brand = %brand, "Registered TV Vendor Adapter");
            lock.insert(proto, adapter);
        }
    }

    /// Access the underlying device registry.
    pub fn registry(&self) -> &DeviceRegistry {
        &self.registry
    }

    /// Authoritatively dispatch a TV command to the target vendor adapter.
    pub async fn dispatch_command(
        &self,
        msg: &TvCommandMessage,
    ) -> Result<TvCommandResult, TvError> {
        self.commands_routed.fetch_add(1, Ordering::Relaxed);
        let proto = msg.target_device;

        let adapter = {
            let lock = self
                .adapters
                .read()
                .map_err(|_| TvError::Internal("Lock poisoned".into()))?;
            lock.get(&proto).cloned()
        };

        if let Some(adapter) = adapter {
            debug!(
                protocol = proto,
                command_code = msg.command_code,
                brand = %adapter.brand(),
                "Routing TV command to vendor adapter"
            );
            adapter.send_command(msg.command_code).await
        } else {
            warn!(
                protocol = proto,
                command_code = msg.command_code,
                "No registered TV adapter for target device"
            );
            Ok(TvCommandResult::Unsupported)
        }
    }

    /// Authoritatively dispatch text input to the target vendor adapter.
    pub async fn dispatch_text_input(
        &self,
        msg: &TvTextInputMessage,
    ) -> Result<TvCommandResult, TvError> {
        self.text_routed.fetch_add(1, Ordering::Relaxed);
        let text = msg.as_str();

        // Get currently selected device or first available adapter
        let target_proto = self
            .registry
            .get_selected_device()
            .map(|d| d.protocol)
            .unwrap_or(lookaremote_protocol::messages::tv_target_devices::GENERIC_TV);

        let adapter = {
            let lock = self
                .adapters
                .read()
                .map_err(|_| TvError::Internal("Lock poisoned".into()))?;
            lock.get(&target_proto).cloned()
        };

        if let Some(adapter) = adapter {
            debug!(
                protocol = target_proto,
                text = %text,
                brand = %adapter.brand(),
                "Routing TV text input to vendor adapter"
            );
            adapter.send_text(text).await
        } else {
            warn!(
                protocol = target_proto,
                "No registered TV adapter for text input"
            );
            Ok(TvCommandResult::Unsupported)
        }
    }

    /// Total commands routed count.
    pub fn total_commands_routed(&self) -> u64 {
        self.commands_routed.load(Ordering::Relaxed)
    }

    /// Total text inputs routed count.
    pub fn total_text_routed(&self) -> u64 {
        self.text_routed.load(Ordering::Relaxed)
    }
}
