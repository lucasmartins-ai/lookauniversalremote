import { ProtocolBridge } from '../../transport/ProtocolBridge';
import { type GamepadFullPayload } from '@lookaremote/protocol-types';

export class GamepadSampler {
  private timerId: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly bridge: ProtocolBridge,
    private readonly getSnapshot: () => Omit<GamepadFullPayload, 'type'>,
    private sampleRateHz = 120
  ) {}

  public setSampleRate(hz: number): void {
    this.sampleRateHz = Math.max(30, Math.min(240, hz));
    if (this.running) {
      this.stop();
      this.start();
    }
  }

  public getSampleRate(): number {
    return this.sampleRateHz;
  }

  public isRunning(): boolean {
    return this.running;
  }

  /**
   * Starts the high-precision sampling loop.
   */
  public start(): void {
    if (this.running) return;
    this.running = true;

    const intervalMs = Math.max(4, Math.round(1000 / this.sampleRateHz));

    this.timerId = setInterval(() => {
      this.sampleOnce();
    }, intervalMs);
  }

  /**
   * Samples a single frame and dispatches it over the protocol bridge.
   */
  public sampleOnce(): boolean {
    const snapshot = this.getSnapshot();
    return this.bridge.sendGamepadFull(snapshot);
  }

  /**
   * Stops the sampling loop.
   */
  public stop(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.running = false;
  }
}
