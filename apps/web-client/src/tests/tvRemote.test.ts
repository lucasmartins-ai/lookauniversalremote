import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProtocolBridge } from '../transport/ProtocolBridge';
import { ITransport } from '../transport/ITransport';
import {
  TvCommand,
  TargetDeviceType,
  MessageType,
  decodePacket,
} from '@lookaremote/protocol-types';

describe('Smart TV Remote & Air Mouse (PWA Client)', () => {
  let sentBuffer: ArrayBuffer | null = null;
  let mockTransport: ITransport;
  let bridge: ProtocolBridge;

  beforeEach(() => {
    sentBuffer = null;

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
      onData: vi.fn(() => () => {}),
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

  it('sends TV channel up command correctly', () => {
    const success = bridge.sendTvCommand({
      commandCode: TvCommand.CHANNEL_UP,
      targetDevice: TargetDeviceType.SAMSUNG_TIZEN,
    });

    expect(success).toBe(true);
    expect(mockTransport.send).toHaveBeenCalledTimes(1);
    expect(sentBuffer).not.toBeNull();

    const decoded = decodePacket(sentBuffer!);
    expect(decoded.header.type).toBe(MessageType.TV_COMMAND);
    if (decoded.payload.type === 'tv_command') {
      expect(decoded.payload.commandCode).toBe(TvCommand.CHANNEL_UP);
      expect(decoded.payload.targetDevice).toBe(TargetDeviceType.SAMSUNG_TIZEN);
    } else {
      throw new Error('Expected tv_command payload');
    }
  });

  it('sends TV volume down and mute commands correctly', () => {
    bridge.sendTvCommand({
      commandCode: TvCommand.VOLUME_DOWN,
      targetDevice: TargetDeviceType.LG_WEBOS,
    });
    let decoded = decodePacket(sentBuffer!);
    expect(decoded.header.type).toBe(MessageType.TV_COMMAND);
    if (decoded.payload.type === 'tv_command') {
      expect(decoded.payload.commandCode).toBe(TvCommand.VOLUME_DOWN);
      expect(decoded.payload.targetDevice).toBe(TargetDeviceType.LG_WEBOS);
    }

    bridge.sendTvCommand({
      commandCode: TvCommand.MUTE,
      targetDevice: TargetDeviceType.LG_WEBOS,
    });
    decoded = decodePacket(sentBuffer!);
    if (decoded.payload.type === 'tv_command') {
      expect(decoded.payload.commandCode).toBe(TvCommand.MUTE);
    }
  });

  it('sends TV direct text input / search string correctly', () => {
    const text = 'Stranger Things S5';
    const success = bridge.sendTvTextInput(text);

    expect(success).toBe(true);
    expect(sentBuffer).not.toBeNull();

    const decoded = decodePacket(sentBuffer!);
    expect(decoded.header.type).toBe(MessageType.TV_TEXT_INPUT);
    if (decoded.payload.type === 'tv_text_input') {
      expect(decoded.payload.text).toBe(text);
    } else {
      throw new Error('Expected tv_text_input payload');
    }
  });

  it('sends TV numpad digit direct tuning commands', () => {
    bridge.sendTvCommand({
      commandCode: TvCommand.DIGIT_5,
      targetDevice: TargetDeviceType.ANDROID_GOOGLE_TV,
    });

    const decoded = decodePacket(sentBuffer!);
    expect(decoded.header.type).toBe(MessageType.TV_COMMAND);
    if (decoded.payload.type === 'tv_command') {
      expect(decoded.payload.commandCode).toBe(TvCommand.DIGIT_5);
      expect(decoded.payload.targetDevice).toBe(TargetDeviceType.ANDROID_GOOGLE_TV);
    }
  });
});
