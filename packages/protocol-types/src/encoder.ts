/**
 * Zero-allocation, zero-GC packet serializer using pre-allocated ArrayBuffer & DataView.
 */

import {
  HEADER_SIZE,
  MAX_PACKET_SIZE,
  MessageType,
  MessageSize,
  PROTOCOL_VERSION,
} from './constants.js';
import type {
  GamepadFullPayload,
  HapticEventPayload,
  Header,
  HeartbeatPayload,
  KeyboardPayload,
  MediaPayload,
  ModeSwitchPayload,
  MessagePayload,
  MotionPayload,
  Packet,
  TouchpadPayload,
} from './types.js';

export class ProtocolEncoder {
  private readonly buffer: ArrayBuffer;
  private readonly view: DataView;
  private readonly u8View: Uint8Array;

  constructor(capacity = MAX_PACKET_SIZE) {
    this.buffer = new ArrayBuffer(capacity);
    this.view = new DataView(this.buffer);
    this.u8View = new Uint8Array(this.buffer);
  }

  private writeHeader(type: number, flags: number, sequence: number): void {
    this.view.setUint8(0, PROTOCOL_VERSION);
    this.view.setUint8(1, type);
    this.view.setUint8(2, flags);
    this.view.setUint16(3, sequence, true); // Little-Endian
  }

  /**
   * Encodes MSG_MOTION (0x01, 21 bytes total).
   */
  public encodeMotion(sequence: number, flags: number, payload: Omit<MotionPayload, 'type'>): Uint8Array {
    this.writeHeader(MessageType.MOTION, flags, sequence);

    this.view.setInt16(5, payload.gyroYaw, true);
    this.view.setInt16(7, payload.gyroPitch, true);
    this.view.setInt16(9, payload.gyroRoll, true);
    this.view.setInt16(11, payload.accelX, true);
    this.view.setInt16(13, payload.accelY, true);
    this.view.setInt16(15, payload.accelZ, true);
    this.view.setUint32(17, payload.timestampUs, true);

    return this.u8View.subarray(0, MessageSize.MOTION.TOTAL);
  }

  /**
   * Encodes MSG_GAMEPAD_FULL (0x02, 19 bytes total).
   */
  public encodeGamepadFull(
    sequence: number,
    flags: number,
    payload: Omit<GamepadFullPayload, 'type'>
  ): Uint8Array {
    this.writeHeader(MessageType.GAMEPAD_FULL, flags, sequence);

    this.view.setUint16(5, payload.buttons, true);
    this.view.setInt16(7, payload.stickLx, true);
    this.view.setInt16(9, payload.stickLy, true);
    this.view.setInt16(11, payload.stickRx, true);
    this.view.setInt16(13, payload.stickRy, true);
    this.view.setUint8(15, payload.triggerL);
    this.view.setUint8(16, payload.triggerR);
    this.view.setUint16(17, payload.reserved ?? 0, true);

    return this.u8View.subarray(0, MessageSize.GAMEPAD_FULL.TOTAL);
  }

  /**
   * Encodes MSG_TOUCHPAD (0x04, 12 bytes total).
   */
  public encodeTouchpad(
    sequence: number,
    flags: number,
    payload: Omit<TouchpadPayload, 'type'>
  ): Uint8Array {
    this.writeHeader(MessageType.TOUCHPAD, flags, sequence);

    this.view.setInt16(5, payload.dx, true);
    this.view.setInt16(7, payload.dy, true);
    this.view.setInt8(9, payload.scrollV);
    this.view.setInt8(10, payload.scrollH);
    this.view.setUint8(11, payload.buttonsMask);

    return this.u8View.subarray(0, MessageSize.TOUCHPAD.TOTAL);
  }

  /**
   * Encodes MSG_KEYBOARD (0x05, 9 bytes total).
   */
  public encodeKeyboard(
    sequence: number,
    flags: number,
    payload: Omit<KeyboardPayload, 'type'>
  ): Uint8Array {
    this.writeHeader(MessageType.KEYBOARD, flags, sequence);

    this.view.setUint16(5, payload.keyCode, true);
    this.view.setUint8(7, payload.state);
    this.view.setUint8(8, payload.modifiers);

    return this.u8View.subarray(0, MessageSize.KEYBOARD.TOTAL);
  }

  /**
   * Encodes MSG_MEDIA (0x06, 7 bytes total).
   */
  public encodeMedia(
    sequence: number,
    flags: number,
    payload: Omit<MediaPayload, 'type'>
  ): Uint8Array {
    this.writeHeader(MessageType.MEDIA, flags, sequence);

    this.view.setUint8(5, payload.mediaAction);
    this.view.setUint8(6, payload.reserved ?? 0);

    return this.u8View.subarray(0, MessageSize.MEDIA.TOTAL);
  }

  /**
   * Encodes MSG_MODE_SWITCH (0x07, 7 bytes total).
   */
  public encodeModeSwitch(
    sequence: number,
    flags: number,
    payload: Omit<ModeSwitchPayload, 'type'>
  ): Uint8Array {
    this.writeHeader(MessageType.MODE_SWITCH, flags, sequence);

    this.view.setUint8(5, payload.targetMode);
    this.view.setUint8(6, payload.flags);

    return this.u8View.subarray(0, MessageSize.MODE_SWITCH.TOTAL);
  }

  /**
   * Encodes MSG_HEARTBEAT (0x08, 13 bytes total).
   */
  public encodeHeartbeat(
    sequence: number,
    flags: number,
    payload: Omit<HeartbeatPayload, 'type'>
  ): Uint8Array {
    this.writeHeader(MessageType.HEARTBEAT, flags, sequence);

    this.view.setUint32(5, payload.clientEpochMs, true);
    this.view.setUint32(9, payload.echoToken, true);

    return this.u8View.subarray(0, MessageSize.HEARTBEAT.TOTAL);
  }

  /**
   * Encodes MSG_HAPTIC_EVENT (0x0A, 9 bytes total).
   */
  public encodeHapticEvent(
    sequence: number,
    flags: number,
    payload: Omit<HapticEventPayload, 'type'>
  ): Uint8Array {
    this.writeHeader(MessageType.HAPTIC_EVENT, flags, sequence);

    this.view.setUint8(5, payload.motorIndex);
    this.view.setUint8(6, payload.intensity);
    this.view.setUint16(7, payload.durationMs, true);

    return this.u8View.subarray(0, MessageSize.HAPTIC_EVENT.TOTAL);
  }

  /**
   * Encodes a generic Packet or Header+Payload.
   */
  public encode(packet: Packet): Uint8Array {
    const { header, payload } = packet;
    switch (payload.type) {
      case 'motion':
        return this.encodeMotion(header.sequence, header.flags, payload);
      case 'gamepad_full':
        return this.encodeGamepadFull(header.sequence, header.flags, payload);
      case 'touchpad':
        return this.encodeTouchpad(header.sequence, header.flags, payload);
      case 'keyboard':
        return this.encodeKeyboard(header.sequence, header.flags, payload);
      case 'media':
        return this.encodeMedia(header.sequence, header.flags, payload);
      case 'mode_switch':
        return this.encodeModeSwitch(header.sequence, header.flags, payload);
      case 'heartbeat':
        return this.encodeHeartbeat(header.sequence, header.flags, payload);
      case 'haptic':
        return this.encodeHapticEvent(header.sequence, header.flags, payload);
    }
  }
}

/** Global default encoder instance for convenience. */
export const defaultEncoder = new ProtocolEncoder();
