//! Smart TV LAN Discovery & Device Registry Subsystem.

pub mod mdns;
pub mod models;
pub mod probe;
pub mod registry;
pub mod service;
pub mod ssdp;

pub use models::{DiscoverySource, TvDevice};
pub use registry::DeviceRegistry;
pub use service::TvDiscoveryService;
