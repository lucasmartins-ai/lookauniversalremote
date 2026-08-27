import { describe, it, expect, vi } from 'vitest';
import { TvCommandService } from '../features/tv/TvCommandService';
import { TvCommand, TargetDeviceType } from '@lookaremote/protocol-types';

describe('TvCommandService', () => {
  it('should fail cleanly if ProtocolBridge is not attached', () => {
    const service = new TvCommandService(null);
    const sent = service.sendCommand(TvCommand.POWER, TargetDeviceType.SAMSUNG_TIZEN);
    expect(sent).toBe(false);

    const history = service.getRecentHistory();
    expect(history.length).toBe(1);
    expect(history[0].success).toBe(false);
    expect(history[0].error).toBe('ProtocolBridge not connected');
  });

  it('should dispatch command authoritatively via bridge with no HTTP fallback', () => {
    const mockBridge = {
      sendTvCommand: vi.fn().mockReturnValue(true),
      sendTvTextInput: vi.fn().mockReturnValue(true),
    };

    const service = new TvCommandService(mockBridge as any);
    const dispatchedEvents: any[] = [];
    service.onDispatch((e) => dispatchedEvents.push(e));

    const sent = service.sendCommand(TvCommand.VOLUME_UP, TargetDeviceType.LG_WEBOS);
    expect(sent).toBe(true);
    expect(mockBridge.sendTvCommand).toHaveBeenCalledWith({
      commandCode: TvCommand.VOLUME_UP,
      targetDevice: TargetDeviceType.LG_WEBOS,
    });
    expect(dispatchedEvents.length).toBe(1);
    expect(dispatchedEvents[0].success).toBe(true);

    const textSent = service.sendTextInput('The Matrix');
    expect(textSent).toBe(true);
    expect(mockBridge.sendTvTextInput).toHaveBeenCalledWith('The Matrix');
  });
});
