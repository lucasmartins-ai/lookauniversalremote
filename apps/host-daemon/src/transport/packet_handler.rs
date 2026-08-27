//! Ingestion and zero-allocation decoding of binary protocol frames from DataChannel.

use crate::core::multi_peer::MultiPeerSessionManager;
use crate::input::events::InputEvent;
use crate::input::watchdog::DeadManWatchdog;
use lookaremote_protocol::{decode_packet, Packet, Payload, ProtocolError};
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use tracing::{debug, trace, warn};

/// Handles raw incoming binary buffer from WebRTC DataChannel for Player 1 (slot 0).
pub fn handle_raw_packet(
    data: &[u8],
    watchdog: &DeadManWatchdog,
    event_tx: Option<&mpsc::Sender<InputEvent>>,
) -> Result<Packet, ProtocolError> {
    handle_raw_slot_packet(0, data, watchdog, event_tx, None)
}

/// Handles raw incoming binary buffer from WebRTC DataChannel for a specific player slot (0..3).
/// Performs zero-allocation protocol decoding, feeds the safety watchdog and per-slot telemetry,
/// and routes the resulting event to the multi-controller input pipeline.
pub fn handle_raw_slot_packet(
    slot: u8,
    data: &[u8],
    watchdog: &DeadManWatchdog,
    event_tx: Option<&mpsc::Sender<InputEvent>>,
    multi_peer: Option<&Arc<RwLock<MultiPeerSessionManager>>>,
) -> Result<Packet, ProtocolError> {
    match decode_packet(data) {
        Ok(mut packet) => {
            // Feed watchdog immediately on valid packet arrival
            watchdog.feed();

            trace!(
                slot = slot,
                seq = packet.header.sequence,
                msg_type = ?packet.header.msg_type,
                flags = packet.header.flags.bits(),
                "Decoded valid protocol packet for player slot"
            );

            // If GamepadFull, ensure player_index matches the physical connection slot
            if let Payload::GamepadFull(ref mut g) = packet.payload {
                g.player_index = slot;
            }

            // Update slot telemetry if manager provided
            if let Some(mgr_lock) = multi_peer {
                if let Ok(mut mgr) = mgr_lock.try_write() {
                    mgr.feed_slot_packet(slot);
                    if let Payload::SlotAssignment(ref s) = packet.payload {
                        if s.battery_level <= 100 {
                            mgr.update_telemetry(slot, 0, Some(s.battery_level), None);
                        }
                    }
                }
            }

            // Forward to input channel if connected
            if let Some(tx) = event_tx {
                let event = InputEvent::from_payload(&packet.payload);
                if let Err(e) = tx.try_send(event) {
                    debug!("Input event channel full or closed: {e}");
                }
            }

            Ok(packet)
        }
        Err(err) => {
            warn!(
                slot = slot,
                len = data.len(),
                error = %err,
                "Received malformed or corrupted protocol packet"
            );
            Err(err)
        }
    }
}
