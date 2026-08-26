//! Input events, router interfaces, motion processor, and Dead-Man safety watchdog.

pub mod events;
pub mod motion_processor;
pub mod router;
pub mod watchdog;

pub use events::InputEvent;
pub use motion_processor::{MotionAimMode, MotionProcessor, MotionProcessorConfig};
pub use router::InputRouter;
pub use watchdog::DeadManWatchdog;
