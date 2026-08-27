//! Smart TV and Universal Remote integration module.

pub mod adapters;
pub mod commands;
pub mod discovery;
pub mod dispatcher;

pub use commands::*;
pub use dispatcher::{TvDispatcher, TvDispatcherStats};
