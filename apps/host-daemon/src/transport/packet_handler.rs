//! Ingestion and zero-allocation decoding of binary protocol frames from DataChannel.

use crate::input::events::InputEvent;
use crate::input::watchdog::DeadManWatchdog;
use lookaremote_protocol::{decode_packet, Packet, ProtocolError};
use tokio::sync::mpsc;
use tracing::{debug, trace, warn};

/// Handles raw incoming binary buffer from WebRTC DataChannel.
/// Performs zero-allocation protocol decoding, feeds the safety watchdog,
/// and routes the resulting event to the input pipeline.
pub fn handle_raw_packet(
    data: &[u8],
    watchdog: &DeadManWatchdog,
    event_tx: Option<&mpsc::Sender<InputEvent>>,
) -> Result<Packet, ProtocolError> {
    match decode_packet(data) {
        Ok(packet) => {
            // Feed watchdog immediately on valid packet arrival
            watchdog.feed();

            trace!(
                seq = packet.header.sequence,
                msg_type = ?packet.header.msg_type,
                flags = packet.header.flags.bits(),
                "Decoded valid protocol packet"
            );

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
                len = data.len(),
                error = %err,
                "Received malformed or corrupted protocol packet"
            );
            Err(err)
        }
    }
}
