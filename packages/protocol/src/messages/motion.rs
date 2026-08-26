//! MSG_MOTION (0x01) — IMU Gyroscope & Accelerometer deltas (16 bytes payload).

use crate::header::HEADER_SIZE;
use crate::ProtocolError;

/// Payload size for MSG_MOTION in bytes.
pub const MOTION_PAYLOAD_SIZE: usize = 16;
/// Total frame size for MSG_MOTION in bytes (Header + Payload).
pub const MOTION_TOTAL_SIZE: usize = HEADER_SIZE + MOTION_PAYLOAD_SIZE;

/// MSG_MOTION payload (0x01) — 16 bytes.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct MotionMessage {
    /// Yaw rate in rad/s * 1000 (-32768 to 32767).
    pub gyro_yaw: i16,
    /// Pitch rate in rad/s * 1000 (-32768 to 32767).
    pub gyro_pitch: i16,
    /// Roll rate in rad/s * 1000 (-32768 to 32767).
    pub gyro_roll: i16,
    /// Linear acceleration X in m/s^2 * 100 (-32768 to 32767).
    pub accel_x: i16,
    /// Linear acceleration Y in m/s^2 * 100 (-32768 to 32767).
    pub accel_y: i16,
    /// Linear acceleration Z in m/s^2 * 100 (-32768 to 32767).
    pub accel_z: i16,
    /// Client microsecond timestamp for jitter/latency calculation.
    pub timestamp_us: u32,
}

impl MotionMessage {
    /// Decode payload from slice of at least 16 bytes.
    #[inline(always)]
    pub fn decode_payload(payload: &[u8]) -> Result<Self, ProtocolError> {
        if payload.len() < MOTION_PAYLOAD_SIZE {
            return Err(ProtocolError::BufferTooShort {
                expected: MOTION_PAYLOAD_SIZE,
                actual: payload.len(),
            });
        }

        let gyro_yaw = i16::from_le_bytes([payload[0], payload[1]]);
        let gyro_pitch = i16::from_le_bytes([payload[2], payload[3]]);
        let gyro_roll = i16::from_le_bytes([payload[4], payload[5]]);
        let accel_x = i16::from_le_bytes([payload[6], payload[7]]);
        let accel_y = i16::from_le_bytes([payload[8], payload[9]]);
        let accel_z = i16::from_le_bytes([payload[10], payload[11]]);
        let timestamp_us = u32::from_le_bytes([payload[12], payload[13], payload[14], payload[15]]);

        Ok(Self {
            gyro_yaw,
            gyro_pitch,
            gyro_roll,
            accel_x,
            accel_y,
            accel_z,
            timestamp_us,
        })
    }

    /// Encode payload into a fixed 16-byte array.
    #[inline(always)]
    pub fn encode_payload(&self) -> [u8; MOTION_PAYLOAD_SIZE] {
        let yaw = self.gyro_yaw.to_le_bytes();
        let pitch = self.gyro_pitch.to_le_bytes();
        let roll = self.gyro_roll.to_le_bytes();
        let ax = self.accel_x.to_le_bytes();
        let ay = self.accel_y.to_le_bytes();
        let az = self.accel_z.to_le_bytes();
        let ts = self.timestamp_us.to_le_bytes();

        [
            yaw[0], yaw[1],
            pitch[0], pitch[1],
            roll[0], roll[1],
            ax[0], ax[1],
            ay[0], ay[1],
            az[0], az[1],
            ts[0], ts[1], ts[2], ts[3],
        ]
    }

    /// Write encoded payload into a destination slice.
    #[inline(always)]
    pub fn write_payload_to_slice(&self, dest: &mut [u8]) -> Result<(), ProtocolError> {
        if dest.len() < MOTION_PAYLOAD_SIZE {
            return Err(ProtocolError::BufferTooShort {
                expected: MOTION_PAYLOAD_SIZE,
                actual: dest.len(),
            });
        }
        dest[..MOTION_PAYLOAD_SIZE].copy_from_slice(&self.encode_payload());
        Ok(())
    }
}
