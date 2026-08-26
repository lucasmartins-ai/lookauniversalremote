/**
 * 16-bit sequence validation and tracking with wraparound support.
 */

export const SEQUENCE_WINDOW_MAX = 32768;

/**
 * Checks if incoming sequence is a valid forward advance from latest sequence.
 * Enforces modular condition: `0 < (incoming - latest) mod 65536 < 32768`.
 */
export function isValidSequenceAdvance(latest: number, incoming: number): boolean {
  const diff = (incoming - latest) & 0xffff;
  return diff > 0 && diff < SEQUENCE_WINDOW_MAX;
}

/**
 * Tracks received packet sequences and drops out-of-order or duplicate packets.
 */
export class SequenceTracker {
  private _latest = 0;
  private _initialized = false;

  constructor(initialSequence?: number) {
    if (initialSequence !== undefined) {
      this._latest = initialSequence & 0xffff;
      this._initialized = true;
    }
  }

  public get latest(): number | null {
    return this._initialized ? this._latest : null;
  }

  public get isInitialized(): boolean {
    return this._initialized;
  }

  public reset(): void {
    this._latest = 0;
    this._initialized = false;
  }

  public check(incoming: number): boolean {
    if (!this._initialized) {
      return true;
    }
    return isValidSequenceAdvance(this._latest, incoming & 0xffff);
  }

  public checkAndUpdate(incoming: number): boolean {
    const seq = incoming & 0xffff;
    if (!this._initialized) {
      this._latest = seq;
      this._initialized = true;
      return true;
    }

    if (isValidSequenceAdvance(this._latest, seq)) {
      this._latest = seq;
      return true;
    }
    return false;
  }
}

/**
 * Monotonically increasing 16-bit sequence generator.
 */
export class SequenceGenerator {
  private _current: number;

  constructor(start = 1) {
    this._current = start & 0xffff;
  }

  public get current(): number {
    return this._current;
  }

  public next(): number {
    const seq = this._current;
    this._current = (this._current + 1) & 0xffff;
    return seq;
  }
}
