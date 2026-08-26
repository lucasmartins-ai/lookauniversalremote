/**
 * Protocol Bridge connecting UI / Input Samplers to the WebRtcTransport
 * Utilizing zero-allocation @lookaremote/protocol-types codecs.
 */

import {
  ProtocolEncoder,
  SequenceGenerator,
  decodePacket,
  MessageType,
  HeaderFlags,
  type MotionPayload,
  type GamepadFullPayload,
  type TouchpadPayload,
  type KeyboardPayload,
  type MediaPayload,
  type ModeSwitchPayload,
  type HeartbeatPayload,
  type Packet,
} from '@lookaremote/protocol-types';
import { ITransport } from './ITransport';
import { haptics } from '../ui/haptics/hapticEngine';

export type PacketHandler = (packet: Packet) => void;
export type RttCalculatedHandler = (rttMs: number, echoToken: number) => void;

export class ProtocolBridge {
  private readonly encoder: ProtocolEncoder;
  private readonly sequenceGen: SequenceGenerator;
  private readonly packetHandlers: Set<PacketHandler> = new Set();
  private readonly rttHandlers: Set<RttCalculatedHandler> = new Set();
  private unbindTransportData: (() => void) | null = null;

  constructor(private readonly transport: ITransport) {
    this.encoder = new ProtocolEncoder();
    this.sequenceGen = new SequenceGenerator(1);
    this.bindTransport();
  }

  public bindTransport(): void {
    if (this.unbindTransportData) {
      this.unbindTransportData();
    }

    this.unbindTransportData = this.transport.onData((data: ArrayBuffer) => {
      this.handleIncomingData(data);
    });
  }

  public destroy(): void {
    if (this.unbindTransportData) {
      this.unbindTransportData();
      this.unbindTransportData = null;
    }
  }

  /**
   * Encodes and transmits MSG_MOTION (0x01).
   */
  public sendMotion(payload: Omit<MotionPayload, 'type'>, flags = 0): boolean {
    const seq = this.sequenceGen.next();
    const encoded = this.encoder.encodeMotion(seq, flags, payload);
    return this.transport.send(encoded);
  }

  /**
   * Encodes and transmits MSG_GAMEPAD_FULL (0x02).
   */
  public sendGamepadFull(payload: Omit<GamepadFullPayload, 'type'>, flags = 0): boolean {
    const seq = this.sequenceGen.next();
    const encoded = this.encoder.encodeGamepadFull(seq, flags, payload);
    return this.transport.send(encoded);
  }

  /**
   * Encodes and transmits MSG_TOUCHPAD (0x04).
   */
  public sendTouchpad(payload: Omit<TouchpadPayload, 'type'>, flags = 0): boolean {
    const seq = this.sequenceGen.next();
    const encoded = this.encoder.encodeTouchpad(seq, flags, payload);
    return this.transport.send(encoded);
  }

  /**
   * Encodes and transmits MSG_KEYBOARD (0x05).
   */
  public sendKeyboard(payload: Omit<KeyboardPayload, 'type'>, flags = 0): boolean {
    const seq = this.sequenceGen.next();
    const encoded = this.encoder.encodeKeyboard(seq, flags, payload);
    return this.transport.send(encoded);
  }

  /**
   * Encodes and transmits MSG_MEDIA (0x06).
   */
  public sendMedia(payload: Omit<MediaPayload, 'type'>, flags = 0): boolean {
    const seq = this.sequenceGen.next();
    const encoded = this.encoder.encodeMedia(seq, flags, payload);
    return this.transport.send(encoded);
  }

  /**
   * Encodes and transmits MSG_MODE_SWITCH (0x07).
   */
  public sendModeSwitch(payload: Omit<ModeSwitchPayload, 'type'>, flags = 0): boolean {
    const seq = this.sequenceGen.next();
    const encoded = this.encoder.encodeModeSwitch(seq, flags, payload);
    return this.transport.send(encoded);
  }

  /**
   * Encodes and transmits MSG_HEARTBEAT (0x08).
   */
  public sendHeartbeat(echoToken = Math.floor(Math.random() * 0xffffffff), flags = 0): boolean {
    const seq = this.sequenceGen.next();
    const clientEpochMs = Date.now() & 0xffffffff;
    const encoded = this.encoder.encodeHeartbeat(seq, flags, {
      clientEpochMs,
      echoToken,
    });
    return this.transport.send(encoded);
  }

  /**
   * Sends an Emergency Reset flag on a heartbeat or null payload.
   */
  public sendEmergencyReset(): boolean {
    return this.sendHeartbeat(0, HeaderFlags.EMERGENCY_RESET);
  }

  public onPacket(handler: PacketHandler): () => void {
    this.packetHandlers.add(handler);
    return () => this.packetHandlers.delete(handler);
  }

  public onRtt(handler: RttCalculatedHandler): () => void {
    this.rttHandlers.add(handler);
    return () => this.rttHandlers.delete(handler);
  }

  private handleIncomingData(data: ArrayBuffer): void {
    try {
      const packet = decodePacket(data);

      // Handle Heartbeat Echo / RTT
      if (packet.header.type === MessageType.HEARTBEAT) {
        const hb = packet.payload as HeartbeatPayload;
        const now = Date.now() & 0xffffffff;
        const rttMs = Math.max(0, (now - hb.clientEpochMs) & 0xffffffff);

        for (const handler of this.rttHandlers) {
          try {
            handler(rttMs, hb.echoToken);
          } catch (e) {
            console.error('Error in RTT handler:', e);
          }
        }
      }

      // Handle Host Haptic Event Trigger
      if (packet.header.type === MessageType.HAPTIC_EVENT) {
        const haptic = packet.payload as any;
        if (haptic.durationMs > 0) {
          haptics.vibrate(haptic.durationMs);
        }
      }

      // Forward to general packet listeners
      for (const handler of this.packetHandlers) {
        try {
          handler(packet);
        } catch (e) {
          console.error('Error in packet handler:', e);
        }
      }
    } catch (err) {
      console.warn('Failed to decode incoming packet on ProtocolBridge:', err);
    }
  }
}
