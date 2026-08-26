/**
 * Protocol frame deserializer for LookARemote Binary Protocol v1.
 */

import {
  HEADER_SIZE,
  MessageType,
  MessageSize,
  PROTOCOL_VERSION,
  type KeyStateValue,
  type MediaActionValue,
  type HapticMotorValue,
  type TargetModeValue,
} from './constants.js';
import type {
  Header,
  MessagePayload,
  Packet,
} from './types.js';

export class ProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProtocolError';
  }
}

/**
 * Normalizes ArrayBuffer / TypedArray inputs to a DataView.
 */
function toDataView(input: ArrayBuffer | ArrayBufferView): DataView {
  if (input instanceof DataView) {
    return input;
  }
  if (input instanceof ArrayBuffer) {
    return new DataView(input);
  }
  if (ArrayBuffer.isView(input)) {
    return new DataView(input.buffer, input.byteOffset, input.byteLength);
  }
  throw new ProtocolError('Invalid binary input: expected ArrayBuffer or TypedArray');
}

/**
 * Decodes raw binary input into a typed LookARemote `Packet`.
 */
export function decodePacket(input: ArrayBuffer | ArrayBufferView): Packet {
  const view = toDataView(input);

  if (view.byteLength < HEADER_SIZE) {
    throw new ProtocolError(
      `Buffer too short for header: expected at least ${HEADER_SIZE} bytes, got ${view.byteLength}`
    );
  }

  const version = view.getUint8(0);
  if (version !== PROTOCOL_VERSION) {
    throw new ProtocolError(
      `Invalid protocol version 0x${version.toString(16).padStart(2, '0')} (expected 0x${PROTOCOL_VERSION.toString(16).padStart(2, '0')})`
    );
  }

  const type = view.getUint8(1);
  const flags = view.getUint8(2);
  const sequence = view.getUint16(3, true);

  const header: Header = {
    version,
    type: type as any,
    flags,
    sequence,
  };

  let payload: MessagePayload;

  switch (type) {
    case MessageType.MOTION: {
      if (view.byteLength !== MessageSize.MOTION.TOTAL) {
        throw new ProtocolError(
          `Invalid frame size for MSG_MOTION: expected ${MessageSize.MOTION.TOTAL} bytes, got ${view.byteLength}`
        );
      }
      payload = {
        type: 'motion',
        gyroYaw: view.getInt16(5, true),
        gyroPitch: view.getInt16(7, true),
        gyroRoll: view.getInt16(9, true),
        accelX: view.getInt16(11, true),
        accelY: view.getInt16(13, true),
        accelZ: view.getInt16(15, true),
        timestampUs: view.getUint32(17, true),
      };
      break;
    }

    case MessageType.GAMEPAD_FULL: {
      if (view.byteLength !== MessageSize.GAMEPAD_FULL.TOTAL) {
        throw new ProtocolError(
          `Invalid frame size for MSG_GAMEPAD_FULL: expected ${MessageSize.GAMEPAD_FULL.TOTAL} bytes, got ${view.byteLength}`
        );
      }
      payload = {
        type: 'gamepad_full',
        buttons: view.getUint16(5, true),
        stickLx: view.getInt16(7, true),
        stickLy: view.getInt16(9, true),
        stickRx: view.getInt16(11, true),
        stickRy: view.getInt16(13, true),
        triggerL: view.getUint8(15),
        triggerR: view.getUint8(16),
        reserved: view.getUint16(17, true),
      };
      break;
    }

    case MessageType.TOUCHPAD: {
      if (view.byteLength !== MessageSize.TOUCHPAD.TOTAL) {
        throw new ProtocolError(
          `Invalid frame size for MSG_TOUCHPAD: expected ${MessageSize.TOUCHPAD.TOTAL} bytes, got ${view.byteLength}`
        );
      }
      payload = {
        type: 'touchpad',
        dx: view.getInt16(5, true),
        dy: view.getInt16(7, true),
        scrollV: view.getInt8(9),
        scrollH: view.getInt8(10),
        buttonsMask: view.getUint8(11),
      };
      break;
    }

    case MessageType.KEYBOARD: {
      if (view.byteLength !== MessageSize.KEYBOARD.TOTAL) {
        throw new ProtocolError(
          `Invalid frame size for MSG_KEYBOARD: expected ${MessageSize.KEYBOARD.TOTAL} bytes, got ${view.byteLength}`
        );
      }
      payload = {
        type: 'keyboard',
        keyCode: view.getUint16(5, true),
        state: view.getUint8(7) as KeyStateValue,
        modifiers: view.getUint8(8),
      };
      break;
    }

    case MessageType.MEDIA: {
      if (view.byteLength !== MessageSize.MEDIA.TOTAL) {
        throw new ProtocolError(
          `Invalid frame size for MSG_MEDIA: expected ${MessageSize.MEDIA.TOTAL} bytes, got ${view.byteLength}`
        );
      }
      payload = {
        type: 'media',
        mediaAction: view.getUint8(5) as MediaActionValue,
        reserved: view.getUint8(6),
      };
      break;
    }

    case MessageType.MODE_SWITCH: {
      if (view.byteLength !== MessageSize.MODE_SWITCH.TOTAL) {
        throw new ProtocolError(
          `Invalid frame size for MSG_MODE_SWITCH: expected ${MessageSize.MODE_SWITCH.TOTAL} bytes, got ${view.byteLength}`
        );
      }
      payload = {
        type: 'mode_switch',
        targetMode: view.getUint8(5) as TargetModeValue,
        flags: view.getUint8(6),
      };
      break;
    }

    case MessageType.HEARTBEAT: {
      if (view.byteLength !== MessageSize.HEARTBEAT.TOTAL) {
        throw new ProtocolError(
          `Invalid frame size for MSG_HEARTBEAT: expected ${MessageSize.HEARTBEAT.TOTAL} bytes, got ${view.byteLength}`
        );
      }
      payload = {
        type: 'heartbeat',
        clientEpochMs: view.getUint32(5, true),
        echoToken: view.getUint32(9, true),
      };
      break;
    }

    case MessageType.HAPTIC_EVENT: {
      if (view.byteLength !== MessageSize.HAPTIC_EVENT.TOTAL) {
        throw new ProtocolError(
          `Invalid frame size for MSG_HAPTIC_EVENT: expected ${MessageSize.HAPTIC_EVENT.TOTAL} bytes, got ${view.byteLength}`
        );
      }
      payload = {
        type: 'haptic',
        motorIndex: view.getUint8(5) as HapticMotorValue,
        intensity: view.getUint8(6),
        durationMs: view.getUint16(7, true),
      };
      break;
    }

    default:
      throw new ProtocolError(`Unknown or unsupported message type: 0x${type.toString(16).padStart(2, '0')}`);
  }

  return { header, payload };
}

/**
 * ProtocolDecoder class offering configurable decoding behaviors.
 */
export class ProtocolDecoder {
  public decode(input: ArrayBuffer | ArrayBufferView): Packet {
    return decodePacket(input);
  }
}

/** Global default decoder instance. */
export const defaultDecoder = new ProtocolDecoder();
