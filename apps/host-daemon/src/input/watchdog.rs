//! High-priority 100ms Dead-Man Switch safety watchdog.
//!
//! Prevents stuck keys or runaway analog inputs if client connection drops.

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Notify;
use tracing::{info, warn};

/// Thread-safe Dead-Man Switch monitor.
pub struct DeadManWatchdog {
    /// Timestamp of last received packet in micros from reference epoch
    last_feed_micros: Arc<AtomicU64>,
    /// Reference start instant
    epoch: Instant,
    /// Timeout duration threshold (default 100ms)
    timeout: Duration,
    /// Sampling interval (default 10ms)
    check_interval: Duration,
    /// Whether watchdog monitoring is armed (active session)
    armed: Arc<AtomicBool>,
    /// Whether watchdog is currently in a triggered/degraded state
    triggered: Arc<AtomicBool>,
    /// Total count of emergency resets triggered
    emergency_trigger_count: Arc<AtomicU64>,
    /// Notification handle to wake monitoring task or abort
    stop_notify: Arc<Notify>,
}

impl DeadManWatchdog {
    /// Creates a new DeadManWatchdog instance.
    pub fn new(timeout: Duration, check_interval: Duration) -> Self {
        let epoch = Instant::now();
        Self {
            last_feed_micros: Arc::new(AtomicU64::new(0)),
            epoch,
            timeout,
            check_interval,
            armed: Arc::new(AtomicBool::new(false)),
            triggered: Arc::new(AtomicBool::new(false)),
            emergency_trigger_count: Arc::new(AtomicU64::new(0)),
            stop_notify: Arc::new(Notify::new()),
        }
    }

    /// Creates a watchdog with standard 100ms timeout and 10ms polling interval.
    pub fn standard() -> Self {
        Self::new(Duration::from_millis(100), Duration::from_millis(10))
    }

    /// Feeds the watchdog with a fresh valid packet arrival timestamp.
    pub fn feed(&self) {
        let elapsed_us = self.epoch.elapsed().as_micros() as u64;
        self.last_feed_micros.store(elapsed_us, Ordering::Release);
        self.triggered.store(false, Ordering::Release);
    }

    /// Arms the watchdog when an active controller streaming session begins.
    pub fn arm(&self) {
        self.feed();
        self.armed.store(true, Ordering::Release);
        self.triggered.store(false, Ordering::Release);
        info!("DeadManWatchdog armed (timeout: {:?})", self.timeout);
    }

    /// Disarms the watchdog on intentional disconnect or pause.
    pub fn disarm(&self) {
        self.armed.store(false, Ordering::Release);
        self.triggered.store(false, Ordering::Release);
        info!("DeadManWatchdog disarmed");
    }

    /// Returns whether the watchdog is armed.
    pub fn is_armed(&self) -> bool {
        self.armed.load(Ordering::Acquire)
    }

    /// Returns whether the watchdog has triggered emergency reset.
    pub fn is_triggered(&self) -> bool {
        self.triggered.load(Ordering::Acquire)
    }

    /// Returns time elapsed since last feed.
    pub fn elapsed_since_feed(&self) -> Duration {
        let last_us = self.last_feed_micros.load(Ordering::Acquire);
        let now_us = self.epoch.elapsed().as_micros() as u64;
        let delta_us = now_us.saturating_sub(last_us);
        Duration::from_micros(delta_us)
    }

    /// Returns total number of emergency triggers since start.
    pub fn trigger_count(&self) -> u64 {
        self.emergency_trigger_count.load(Ordering::Acquire)
    }

    /// Spawns the asynchronous watchdog background monitor loop.
    pub fn spawn_monitor<F>(&self, on_emergency_release: F) -> tokio::task::JoinHandle<()>
    where
        F: Fn() + Send + Sync + 'static,
    {
        let last_feed = Arc::clone(&self.last_feed_micros);
        let armed = Arc::clone(&self.armed);
        let triggered = Arc::clone(&self.triggered);
        let trigger_count = Arc::clone(&self.emergency_trigger_count);
        let stop_notify = Arc::clone(&self.stop_notify);
        let epoch = self.epoch;
        let timeout_us = self.timeout.as_micros() as u64;
        let check_interval = self.check_interval;
        let on_emergency = Arc::new(on_emergency_release);

        tokio::spawn(async move {
            let mut interval = tokio::time::interval(check_interval);
            interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

            loop {
                tokio::select! {
                    _ = stop_notify.notified() => {
                        info!("DeadManWatchdog monitoring loop stopped");
                        break;
                    }
                    _ = interval.tick() => {
                        if !armed.load(Ordering::Acquire) {
                            continue;
                        }

                        let now_us = epoch.elapsed().as_micros() as u64;
                        let last_us = last_feed.load(Ordering::Acquire);
                        let elapsed_us = now_us.saturating_sub(last_us);

                        if elapsed_us > timeout_us {
                            // Only trigger once per stale period
                            if !triggered.swap(true, Ordering::AcqRel) {
                                trigger_count.fetch_add(1, Ordering::Relaxed);
                                warn!(
                                    "WATCHDOG DEAD-MAN SWITCH TRIGGERED: No packets for {:.1}ms (> {:.1}ms threshold). Releasing all inputs!",
                                    elapsed_us as f64 / 1000.0,
                                    timeout_us as f64 / 1000.0
                                );
                                on_emergency();
                            }
                        }
                    }
                }
            }
        })
    }

    /// Stops the monitor task.
    pub fn stop(&self) {
        self.stop_notify.notify_waiters();
    }
}
