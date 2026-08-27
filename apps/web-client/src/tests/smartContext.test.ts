import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  targetModeToInputMode,
  inputModeToTargetMode,
} from '../features/context/useSmartContext';
import {
  MessageType,
  TargetMode,
  ModeSwitchFlags,
  decodePacket,
  type Packet,
} from '@lookaremote/protocol-types';
import { ProtocolBridge } from '../transport/ProtocolBridge';
import { ITransport } from '../transport/ITransport';

describe('Smart Context Engine (PWA Client & Protocol Integration)', () => {
  describe('Mode conversions', () => {
    it('correctly maps TargetMode protocol numbers to client mode strings', () => {
      expect(targetModeToInputMode(TargetMode.TV_REMOTE)).toBe('tv');
      expect(targetModeToInputMode(TargetMode.AIR_MOUSE)).toBe('airmouse');
      expect(targetModeToInputMode(TargetMode.GAMEPAD)).toBe('gamepad');
      expect(targetModeToInputMode(TargetMode.TRACKPAD)).toBe('trackpad');
      expect(targetModeToInputMode(TargetMode.KEYBOARD)).toBe('keyboard');
      expect(targetModeToInputMode(TargetMode.MEDIA_REMOTE)).toBe('media');
    });

    it('correctly maps client mode strings to TargetMode protocol numbers', () => {
      expect(inputModeToTargetMode('tv')).toBe(TargetMode.TV_REMOTE);
      expect(inputModeToTargetMode('airmouse')).toBe(TargetMode.AIR_MOUSE);
      expect(inputModeToTargetMode('gamepad')).toBe(TargetMode.GAMEPAD);
      expect(inputModeToTargetMode('trackpad')).toBe(TargetMode.TRACKPAD);
      expect(inputModeToTargetMode('keyboard')).toBe(TargetMode.KEYBOARD);
      expect(inputModeToTargetMode('media')).toBe(TargetMode.MEDIA_REMOTE);
    });
  });

  describe('ProtocolBridge MSG_MODE_SWITCH Transmission & Reception', () => {
    let sentBuffer: ArrayBuffer | null = null;
    let dataHandler: ((data: ArrayBuffer) => void) | null = null;
    let mockTransport: ITransport;
    let bridge: ProtocolBridge;

    beforeEach(() => {
      sentBuffer = null;
      dataHandler = null;

      mockTransport = {
        state: 'connected',
        connect: vi.fn(async () => {}),
        disconnect: vi.fn(),
        send: vi.fn((data: Uint8Array | ArrayBuffer) => {
          sentBuffer =
            data instanceof Uint8Array
              ? (data.buffer.slice(
                  data.byteOffset,
                  data.byteOffset + data.byteLength
                ) as ArrayBuffer)
              : (data as ArrayBuffer);
          return true;
        }),
        onStateChange: vi.fn(() => () => {}),
        onData: vi.fn((cb) => {
          dataHandler = cb;
          return () => {
            dataHandler = null;
          };
        }),
        onError: vi.fn(() => () => {}),
        onStats: vi.fn(() => () => {}),
        getStats: vi.fn(() => ({
          rttMs: 0,
          packetsSent: 0,
          packetsReceived: 0,
          bytesSent: 0,
          bytesReceived: 0,
          jitterMs: 0,
          packetLossRatio: 0,
          lastHeartbeatTs: 0,
        })),
      };

      bridge = new ProtocolBridge(mockTransport);
    });

    it('encodes and sends MSG_MODE_SWITCH to host', () => {
      const success = bridge.sendModeSwitch({
        targetMode: TargetMode.KEYBOARD,
        flags: ModeSwitchFlags.IS_MANUAL_OVERRIDE,
      });

      expect(success).toBe(true);
      expect(mockTransport.send).toHaveBeenCalledTimes(1);
      expect(sentBuffer).not.toBeNull();

      const decoded = decodePacket(sentBuffer!);
      expect(decoded.header.type).toBe(MessageType.MODE_SWITCH);
      if (decoded.payload.type === 'mode_switch') {
        expect(decoded.payload.targetMode).toBe(TargetMode.KEYBOARD);
        expect(decoded.payload.flags).toBe(ModeSwitchFlags.IS_MANUAL_OVERRIDE);
      } else {
        throw new Error('Expected mode_switch payload');
      }
    });

    it('receives incoming MSG_MODE_SWITCH from host and notifies packet listeners', () => {
      let receivedPacket: Packet | null = null;
      bridge.onPacket((p) => {
        receivedPacket = p;
      });

      // Craft raw MSG_MODE_SWITCH packet buffer from host
      const hostPayload = {
        targetMode: TargetMode.GAMEPAD,
        flags: ModeSwitchFlags.IS_ENFORCED_BY_HOST,
      };
      const encoder = new (bridge as any).encoder.constructor();
      const rawBytes = encoder.encodeModeSwitch(42, 0, hostPayload);

      // Simulate incoming packet on transport
      dataHandler!(rawBytes.buffer.slice(rawBytes.byteOffset, rawBytes.byteOffset + rawBytes.byteLength));

      expect(receivedPacket).not.toBeNull();
      expect(receivedPacket!.header.type).toBe(MessageType.MODE_SWITCH);
      if (receivedPacket!.payload.type === 'mode_switch') {
        expect(receivedPacket!.payload.targetMode).toBe(TargetMode.GAMEPAD);
        expect(receivedPacket!.payload.flags).toBe(ModeSwitchFlags.IS_ENFORCED_BY_HOST);
        expect(targetModeToInputMode(receivedPacket!.payload.targetMode)).toBe('gamepad');
      } else {
        throw new Error('Expected mode_switch payload');
      }
    });
  });

  describe('Smart Context Auto-Switch Decision Logic', () => {
    function shouldAutoSwitch(
      _targetModeNum: number,
      flags: number,
      autoSwitchEnabled: boolean,
      manualOverrideLock: boolean
    ): boolean {
      const isEnforced = (flags & ModeSwitchFlags.IS_ENFORCED_BY_HOST) !== 0;
      return isEnforced || (autoSwitchEnabled && !manualOverrideLock);
    }

    it('approves auto-switch when autoSwitchEnabled is true and manual lock is false', () => {
      expect(shouldAutoSwitch(TargetMode.GAMEPAD, 0, true, false)).toBe(true);
    });

    it('blocks auto-switch when manualOverrideLock is true', () => {
      expect(shouldAutoSwitch(TargetMode.GAMEPAD, 0, true, true)).toBe(false);
    });

    it('blocks auto-switch when autoSwitchEnabled is false', () => {
      expect(shouldAutoSwitch(TargetMode.GAMEPAD, 0, false, false)).toBe(false);
    });

    it('bypasses manual lock when host enforcement flag is active', () => {
      expect(
        shouldAutoSwitch(
          TargetMode.MEDIA_REMOTE,
          ModeSwitchFlags.IS_ENFORCED_BY_HOST,
          false,
          true
        )
      ).toBe(true);
    });
  });
});
