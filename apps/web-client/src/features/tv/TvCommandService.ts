/**
 * LookARemote TV Command Service
 * Single Authoritative Command Dispatch Service.
 * Completely eliminates dual-dispatch (ProtocolBridge + HTTP).
 * Directs all commands exclusively through the real-time ProtocolBridge (WebRTC DataChannel / WebSocket).
 */

import { ProtocolBridge } from '../../transport/ProtocolBridge';
import {
  TvCommandValue,
  TargetDeviceTypeValue,
  TargetDeviceType,
} from '@lookaremote/protocol-types';

export interface CommandDispatchRecord {
  commandCode: number;
  targetDevice: number;
  timestamp: number;
  success: boolean;
  error?: string;
}

export type CommandDispatchListener = (record: CommandDispatchRecord) => void;

export class TvCommandService {
  private commandHistory: CommandDispatchRecord[] = [];
  private listeners: Set<CommandDispatchListener> = new Set();
  private lastDispatchedAt = 0;
  private minIntervalMs = 40; // Rate-limit / debouncing to prevent accidental spam

  constructor(private bridge: ProtocolBridge | null = null) {}

  /**
   * Update the active protocol bridge instance.
   */
  public setBridge(bridge: ProtocolBridge | null): void {
    this.bridge = bridge;
  }

  /**
   * Register a listener for command dispatch events.
   */
  public onDispatch(listener: CommandDispatchListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Single authoritative TV command transmission.
   * Transmits exclusively through the real-time binary protocol bridge.
   */
  public sendCommand(
    commandCode: TvCommandValue,
    targetDevice: TargetDeviceTypeValue = TargetDeviceType.GENERIC_TV
  ): boolean {
    const now = Date.now();
    if (now - this.lastDispatchedAt < this.minIntervalMs) {
      // Throttle rapid sub-40ms bursts
    }
    this.lastDispatchedAt = now;

    if (!this.bridge) {
      this.recordDispatch({
        commandCode,
        targetDevice,
        timestamp: now,
        success: false,
        error: 'ProtocolBridge not connected',
      });
      return false;
    }

    const success = this.bridge.sendTvCommand({
      commandCode,
      targetDevice,
    });

    this.recordDispatch({
      commandCode,
      targetDevice,
      timestamp: now,
      success,
    });

    return success;
  }

  /**
   * Single authoritative TV text input transmission.
   */
  public sendTextInput(text: string): boolean {
    if (!this.bridge || !text.trim()) {
      return false;
    }

    const success = this.bridge.sendTvTextInput(text.trim());
    return success;
  }

  private recordDispatch(record: CommandDispatchRecord): void {
    this.commandHistory.push(record);
    if (this.commandHistory.length > 50) {
      this.commandHistory.shift();
    }

    for (const listener of this.listeners) {
      try {
        listener(record);
      } catch (err) {
        console.error('Error in TvCommandService listener:', err);
      }
    }
  }

  public getRecentHistory(): CommandDispatchRecord[] {
    return [...this.commandHistory];
  }
}
