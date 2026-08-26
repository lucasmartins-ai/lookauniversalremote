import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GyroAimController } from '../sensors/GyroAimController';
import { ImuSensorPipeline } from '../sensors/ImuSensorPipeline';
import { BiasCalibrator } from '../sensors/BiasCalibrator';
import { MotionSampler } from '../sensors/MotionSampler';
import { ProtocolBridge } from '../transport/ProtocolBridge';

describe('GyroAimController & MotionSampler', () => {
  let pipeline: ImuSensorPipeline;
  let calibrator: BiasCalibrator;
  let controller: GyroAimController;
  let listeners: Record<string, Function[]> = {};

  beforeEach(() => {
    vi.useFakeTimers();
    listeners = {};

    const mockWindow = {
      DeviceMotionEvent: function () {},
      addEventListener: vi.fn((event: string, cb: Function) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(cb);
      }),
      removeEventListener: vi.fn((event: string, cb: Function) => {
        if (listeners[event]) {
          listeners[event] = listeners[event].filter((fn) => fn !== cb);
        }
      }),
      dispatchEvent: (event: any) => {
        const cbs = listeners[event.type] || [];
        for (const cb of cbs) {
          cb(event);
        }
      },
      setInterval: globalThis.setInterval,
      clearInterval: globalThis.clearInterval,
    };

    (globalThis as any).window = mockWindow;
    (globalThis as any).DeviceMotionEvent = mockWindow.DeviceMotionEvent;

    const mockLocalStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    };
    (globalThis as any).localStorage = mockLocalStorage;

    pipeline = new ImuSensorPipeline();
    calibrator = new BiasCalibrator();
    controller = new GyroAimController(pipeline, calibrator, {
      aimMode: 'always_on',
      ltThreshold: 25,
      filterOptions: { deadzoneRad: 0, smoothing: 'none' },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('handles activation modes (always_on, hold_lt, toggle, disabled)', () => {
    // 1. Always On
    controller.setAimMode('always_on');
    expect(controller.isAimActive()).toBe(true);

    // 2. Hold LT
    controller.setAimMode('hold_lt');
    expect(controller.isAimActive()).toBe(false);
    controller.updateGamepadInputs(10, false); // below threshold (25)
    expect(controller.isAimActive()).toBe(false);
    controller.updateGamepadInputs(30, false); // above threshold
    expect(controller.isAimActive()).toBe(true);
    controller.updateGamepadInputs(0, true); // aim button pressed
    expect(controller.isAimActive()).toBe(true);
    controller.updateGamepadInputs(0, false);
    expect(controller.isAimActive()).toBe(false);

    // 3. Toggle
    controller.setAimMode('toggle');
    expect(controller.isAimActive()).toBe(false);
    controller.toggleAim();
    expect(controller.isAimActive()).toBe(true);
    controller.toggleAim();
    expect(controller.isAimActive()).toBe(false);

    // 4. Disabled
    controller.setAimMode('disabled');
    expect(controller.isAimActive()).toBe(false);
  });

  it('samples and transmits MSG_MOTION via ProtocolBridge', () => {
    const mockTransport = {
      send: vi.fn().mockReturnValue(true),
      onData: vi.fn(),
      isConnected: vi.fn().mockReturnValue(true),
      close: vi.fn(),
    };
    const bridge = new ProtocolBridge(mockTransport as any);

    controller.start();
    // Simulate active devicemotion event
    const motionEvent: any = {
      type: 'devicemotion',
      rotationRate: { alpha: 90, beta: 45, gamma: 0 },
      acceleration: { x: 1, y: 2, z: 3 },
    };
    (globalThis as any).window.dispatchEvent(motionEvent);

    const sampler = new MotionSampler(bridge, () => controller.getMotionSnapshot(), 120);

    sampler.sampleAndSend();

    expect(mockTransport.send).toHaveBeenCalledTimes(1);
    const sentData = mockTransport.send.mock.calls[0][0];
    expect(sentData).toBeInstanceOf(Uint8Array);
    expect(sentData[0]).toBe(0x01); // PROTOCOL_VERSION
    expect(sentData[1]).toBe(0x01); // MSG_MOTION

    sampler.start();
    vi.advanceTimersByTime(100); // at 120Hz, ~12 packets
    expect(sampler.getPacketCount()).toBeGreaterThan(5);
    sampler.stop();
  });
});
