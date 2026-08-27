//! Periodic background watcher for foreground application changes with debounce and protocol broadcasting.

use crate::context::arbitrator::{ArbitrationResult, ContextArbitrator};
use crate::context::profile::{DaemonSection, ProfileMatcher, TargetControlMode};
use crate::context::window_detector::{ActiveWindowInfo, WindowDetector};
use bytes::Bytes;
use lookaremote_protocol::messages::{mode_switch_flags, ModeSwitchMessage};
use lookaremote_protocol::{encode_packet, Header, HeaderFlags, MessageType, Packet, Payload};
use std::sync::atomic::{AtomicU16, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{broadcast, Mutex, RwLock};
use tracing::{debug, info, trace, warn};
use webrtc::data_channel::RTCDataChannel;

/// Event emitted by the ContextWatcher whenever an arbitration decision occurs.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ContextWatcherEvent {
    /// Active foreground window details.
    pub active_window: ActiveWindowInfo,
    /// Arbitration result.
    pub arbitration: ArbitrationResult,
}

/// Internal state tracking debounce windows across consecutive poll cycles.
pub struct WatcherDebounceState {
    /// Last confirmed active window.
    pub confirmed_window: ActiveWindowInfo,
    /// Pending candidate window under evaluation.
    pub candidate_window: Option<ActiveWindowInfo>,
    /// Instant when the current candidate was first observed.
    pub candidate_since: Instant,
}

impl Default for WatcherDebounceState {
    fn default() -> Self {
        Self {
            confirmed_window: ActiveWindowInfo::default(),
            candidate_window: None,
            candidate_since: Instant::now(),
        }
    }
}

/// Periodic background watcher managing window polling, debounce, and client synchronization.
#[derive(Clone)]
pub struct ContextWatcher {
    detector: Arc<dyn WindowDetector>,
    matcher: Arc<ProfileMatcher>,
    arbitrator: Arc<Mutex<ContextArbitrator>>,
    config: DaemonSection,
    event_tx: broadcast::Sender<ContextWatcherEvent>,
    active_data_channel: Arc<RwLock<Option<Arc<RTCDataChannel>>>>,
    sequence: Arc<AtomicU16>,
}

impl ContextWatcher {
    /// Initializes a new ContextWatcher.
    pub fn new(
        detector: Arc<dyn WindowDetector>,
        matcher: Arc<ProfileMatcher>,
        arbitrator: Arc<Mutex<ContextArbitrator>>,
        config: DaemonSection,
    ) -> Self {
        let (event_tx, _) = broadcast::channel(32);
        Self {
            detector,
            matcher,
            arbitrator,
            config,
            event_tx,
            active_data_channel: Arc::new(RwLock::new(None)),
            sequence: Arc::new(AtomicU16::new(1)),
        }
    }

    /// Attaches an active WebRTC DataChannel for broadcasting `MSG_MODE_SWITCH` frames.
    pub fn set_data_channel(&self, data_channel: Option<Arc<RTCDataChannel>>) {
        let lock = Arc::clone(&self.active_data_channel);
        tokio::spawn(async move {
            let mut writer = lock.write().await;
            *writer = data_channel;
        });
    }

    /// Returns a shared reference to the active data channel slot.
    pub fn data_channel_slot(&self) -> Arc<RwLock<Option<Arc<RTCDataChannel>>>> {
        Arc::clone(&self.active_data_channel)
    }

    /// Subscribes to context watcher events.
    pub fn subscribe(&self) -> broadcast::Receiver<ContextWatcherEvent> {
        self.event_tx.subscribe()
    }

    /// Sets or clears a manual mode override.
    pub async fn set_manual_override(&self, mode: Option<TargetControlMode>) -> ArbitrationResult {
        let mut arb = self.arbitrator.lock().await;
        if let Some(target) = mode {
            arb.set_manual_override(target, true);
        } else {
            arb.set_manual_override(TargetControlMode::Gamepad, false);
        }
        let current_window = self.detector.get_active_window().unwrap_or_default();
        let matched = self.matcher.match_window(&current_window);
        let result = arb.evaluate(matched, self.matcher.default_mode());

        let event = ContextWatcherEvent {
            active_window: current_window,
            arbitration: result.clone(),
        };
        let _ = self.event_tx.send(event);
        result
    }

    /// Handles a mode switch request received from the client.
    pub async fn handle_client_mode_switch(&self, msg: &ModeSwitchMessage) -> ArbitrationResult {
        if let Some(target) = TargetControlMode::from_u8(msg.target_mode) {
            let mut arb = self.arbitrator.lock().await;
            arb.set_manual_override(target, msg.is_manual_override());
            let current_window = self.detector.get_active_window().unwrap_or_default();
            let matched = self.matcher.match_window(&current_window);
            let result = arb.evaluate(matched, self.matcher.default_mode());

            let event = ContextWatcherEvent {
                active_window: current_window,
                arbitration: result.clone(),
            };
            let _ = self.event_tx.send(event);
            result
        } else {
            let mut arb = self.arbitrator.lock().await;
            let current_window = self.detector.get_active_window().unwrap_or_default();
            let matched = self.matcher.match_window(&current_window);
            arb.evaluate(matched, self.matcher.default_mode())
        }
    }

    /// Executes a single discrete polling and debounce evaluation cycle.
    pub async fn poll_step(&self, debounce_state: &mut WatcherDebounceState) -> Option<ContextWatcherEvent> {
        let current_window = match self.detector.get_active_window() {
            Ok(w) => w,
            Err(e) => {
                trace!("Window detector returned error: {e}");
                return None;
            }
        };

        let debounce_duration = Duration::from_millis(self.config.debounce_ms);
        let now = Instant::now();

        // Check if window changed compared to current confirmed window
        if current_window != debounce_state.confirmed_window {
            match &debounce_state.candidate_window {
                Some(candidate) if candidate == &current_window => {
                    // Same candidate observed; check if debounce period elapsed
                    if now.duration_since(debounce_state.candidate_since) >= debounce_duration {
                        debounce_state.confirmed_window = current_window.clone();
                        debounce_state.candidate_window = None;
                    } else {
                        // Still in debounce stabilization window
                        return None;
                    }
                }
                _ => {
                    // New candidate observed, start debounce timer
                    debounce_state.candidate_window = Some(current_window.clone());
                    debounce_state.candidate_since = now;
                    return None;
                }
            }
        } else {
            // Window matches confirmed, clear candidate
            debounce_state.candidate_window = None;
        }

        // Window confirmed; perform profile matching and priority arbitration
        let matched = self.matcher.match_window(&debounce_state.confirmed_window);
        let mut arb = self.arbitrator.lock().await;
        let arb_result = arb.evaluate(matched, self.matcher.default_mode());

        if arb_result.mode_changed {
            info!(
                mode = ?arb_result.active_mode,
                source = ?arb_result.source,
                profile = ?arb_result.matched_profile_name,
                process = %debounce_state.confirmed_window.process_name,
                "Smart Context mode switch triggered"
            );

            // Broadcast MSG_MODE_SWITCH over active DataChannel
            let seq = self.sequence.fetch_add(1, Ordering::Relaxed);
            let mut flags = mode_switch_flags::NONE;
            if arb.is_manual_locked() {
                flags |= mode_switch_flags::IS_MANUAL_OVERRIDE;
            }
            if arb_result.source == crate::context::arbitrator::ArbitrationSource::Emergency {
                flags |= mode_switch_flags::IS_ENFORCED_BY_HOST;
            }

            let mode_msg = ModeSwitchMessage::new(arb_result.active_mode.as_u8(), flags);
            let header = Header::new(MessageType::ModeSwitch, HeaderFlags::empty(), seq);
            let packet = Packet::new(header, Payload::ModeSwitch(mode_msg));

            if let Ok(encoded) = encode_packet(&packet) {
                let data = Bytes::copy_from_slice(encoded.as_slice());
                let dc_lock = self.active_data_channel.read().await;
                if let Some(ref dc) = *dc_lock {
                    if let Err(e) = dc.send(&data).await {
                        warn!("Failed to broadcast MSG_MODE_SWITCH over DataChannel: {e}");
                    } else {
                        debug!("Broadcasted MSG_MODE_SWITCH ({:?}) to client", arb_result.active_mode);
                    }
                }
            }
        }

        let event = ContextWatcherEvent {
            active_window: debounce_state.confirmed_window.clone(),
            arbitration: arb_result,
        };

        let _ = self.event_tx.send(event.clone());
        Some(event)
    }

    /// Spawns the background monitoring loop.
    pub fn spawn_loop(&self) -> tokio::task::JoinHandle<()> {
        let watcher = self.clone();
        tokio::spawn(async move {
            let mut debounce_state = WatcherDebounceState::default();
            let poll_duration = Duration::from_millis(watcher.config.poll_interval_ms.max(100));

            debug!(interval_ms = watcher.config.poll_interval_ms, "ContextWatcher loop started");

            loop {
                tokio::time::sleep(poll_duration).await;
                watcher.poll_step(&mut debounce_state).await;
            }
        })
    }
}
