import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ImuSensorPipeline, DEG_TO_RAD, ImuRawSample } from '../sensors/ImuSensorPipeline';

describe('ImuSensorPipeline', () => {
  let pipeline: ImuSensorPipeline;
  let listeners: Record<string, Function[]> = {};

  beforeEach(() => {
    vi.restoreAllMocks();
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
    };

    (globalThis as any).window = mockWindow;
    (globalThis as any).DeviceMotionEvent = mockWindow.DeviceMotionEvent;
  });

  afterEach(() => {
    if (pipeline) {
      pipeline.stop();
    }
  });

  it('correctly converts degrees/s to radians/s with DEG_TO_RAD constant', () => {
    expect(DEG_TO_RAD).toBeCloseTo(0.0174532925, 6);
    expect(180 * DEG_TO_RAD).toBeCloseTo(Math.PI, 6);
    expect(90 * DEG_TO_RAD).toBeCloseTo(Math.PI / 2, 6);
  });

  it('dispatches normalized ImuRawSample to registered listeners on devicemotion event', () => {
    pipeline = new ImuSensorPipeline();
    pipeline.start();

    const samples: ImuRawSample[] = [];
    const unsubscribe = pipeline.onSample((sample) => {
      samples.push(sample);
    });

    // Simulate window devicemotion event
    const motionEvent: any = {
      type: 'devicemotion',
      rotationRate: {
        alpha: 90, // 90 deg/s around Z -> pi/2 rad/s
        beta: -45, // -45 deg/s around X -> -pi/4 rad/s
        gamma: 180, // 180 deg/s around Y -> pi rad/s
      },
      acceleration: {
        x: 1.25,
        y: -0.5,
        z: 9.81,
      },
    };

    (globalThis as any).window.dispatchEvent(motionEvent);

    expect(samples.length).toBe(1);
    const s = samples[0];
    expect(s.gyroYaw).toBeCloseTo(Math.PI / 2, 5);
    expect(s.gyroPitch).toBeCloseTo(-Math.PI / 4, 5);
    expect(s.gyroRoll).toBeCloseTo(Math.PI, 5);
    expect(s.accelX).toBe(1.25);
    expect(s.accelY).toBe(-0.5);
    expect(s.accelZ).toBe(9.81);
    expect(typeof s.timestampUs).toBe('number');
    expect(s.timestampUs).toBeGreaterThanOrEqual(0);

    expect(pipeline.getLastSample()).toEqual(s);

    // Test unsubscribe
    unsubscribe();
    (globalThis as any).window.dispatchEvent(motionEvent);
    expect(samples.length).toBe(1);
  });

  it('handles iOS Safari requestPermission flow', async () => {
    // Mock iOS DeviceMotionEvent.requestPermission
    const mockRequestPermission = vi.fn().mockResolvedValue('granted');
    (globalThis as any).window.DeviceMotionEvent = {
      requestPermission: mockRequestPermission,
    };
    (globalThis as any).DeviceMotionEvent = (globalThis as any).window.DeviceMotionEvent;

    pipeline = new ImuSensorPipeline();
    expect(pipeline.getStatus()).toBe('needs_permission');

    const granted = await pipeline.requestPermission();
    expect(granted).toBe(true);
    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
    expect(pipeline.getStatus()).toBe('granted');
  });

  it('handles iOS Safari requestPermission denied', async () => {
    const mockRequestPermission = vi.fn().mockResolvedValue('denied');
    (globalThis as any).window.DeviceMotionEvent = {
      requestPermission: mockRequestPermission,
    };
    (globalThis as any).DeviceMotionEvent = (globalThis as any).window.DeviceMotionEvent;

    pipeline = new ImuSensorPipeline();
    const granted = await pipeline.requestPermission();
    expect(granted).toBe(false);
    expect(pipeline.getStatus()).toBe('denied');
  });

  it('handles null rotationRate or acceleration gracefully with zeros', () => {
    pipeline = new ImuSensorPipeline();
    pipeline.start();

    const samples: ImuRawSample[] = [];
    pipeline.onSample((s) => samples.push(s));

    const emptyEvent: any = {
      type: 'devicemotion',
      rotationRate: null,
      acceleration: null,
      accelerationIncludingGravity: null,
    };

    (globalThis as any).window.dispatchEvent(emptyEvent);

    expect(samples.length).toBe(1);
    expect(samples[0].gyroYaw).toBe(0);
    expect(samples[0].gyroPitch).toBe(0);
    expect(samples[0].gyroRoll).toBe(0);
    expect(samples[0].accelX).toBe(0);
    expect(samples[0].accelY).toBe(0);
    expect(samples[0].accelZ).toBe(0);
  });
});
