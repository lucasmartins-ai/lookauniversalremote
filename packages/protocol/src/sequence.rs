//! 16-bit wrapping sequence filter and sequence generator.

/// Half the 16-bit sequence space (32768).
pub const SEQUENCE_WINDOW_MAX: u16 = 32768;

/// Evaluates whether `incoming` is a valid advance over `latest` according to modular arithmetic:
/// `0 < (incoming - latest) mod 65536 < 32768`.
#[inline(always)]
pub fn is_valid_sequence_advance(latest: u16, incoming: u16) -> bool {
    let diff = incoming.wrapping_sub(latest);
    diff > 0 && diff < SEQUENCE_WINDOW_MAX
}

/// Tracks the latest received sequence number and filters out duplicate or out-of-order frames.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SequenceTracker {
    latest: u16,
    initialized: bool,
}

/// Alias for `SequenceTracker`.
pub type SequenceFilter = SequenceTracker;

impl Default for SequenceTracker {
    #[inline(always)]
    fn default() -> Self {
        Self::new()
    }
}

impl SequenceTracker {
    /// Create a new uninitialized sequence tracker.
    /// The first packet received will always be accepted and initialize the tracker.
    #[inline(always)]
    pub const fn new() -> Self {
        Self {
            latest: 0,
            initialized: false,
        }
    }

    /// Create a sequence tracker initialized with a specific starting sequence.
    #[inline(always)]
    pub const fn with_initial(sequence: u16) -> Self {
        Self {
            latest: sequence,
            initialized: true,
        }
    }

    /// Returns the highest sequence number processed so far, if initialized.
    #[inline(always)]
    pub const fn latest(&self) -> Option<u16> {
        if self.initialized {
            Some(self.latest)
        } else {
            None
        }
    }

    /// Reset tracker state (e.g. on emergency reset or new session).
    #[inline(always)]
    pub fn reset(&mut self) {
        self.latest = 0;
        self.initialized = false;
    }

    /// Check if incoming sequence number is valid without updating state.
    #[inline(always)]
    pub fn check(&self, incoming: u16) -> bool {
        if !self.initialized {
            return true;
        }
        is_valid_sequence_advance(self.latest, incoming)
    }

    /// Process incoming sequence number.
    /// Returns `true` if accepted (and updates latest), or `false` if rejected (out of order or duplicate).
    #[inline(always)]
    pub fn check_and_update(&mut self, incoming: u16) -> bool {
        if !self.initialized {
            self.latest = incoming;
            self.initialized = true;
            return true;
        }

        if is_valid_sequence_advance(self.latest, incoming) {
            self.latest = incoming;
            true
        } else {
            false
        }
    }
}

/// Monotonic 16-bit sequence generator.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SequenceGenerator {
    current: u16,
}

impl Default for SequenceGenerator {
    #[inline(always)]
    fn default() -> Self {
        Self::new()
    }
}

impl SequenceGenerator {
    /// Create a sequence generator starting at `1`.
    #[inline(always)]
    pub const fn new() -> Self {
        Self { current: 1 }
    }

    /// Create a sequence generator starting at a custom value.
    #[inline(always)]
    pub const fn with_start(start: u16) -> Self {
        Self { current: start }
    }

    /// Get current sequence without advancing.
    #[inline(always)]
    pub const fn current(&self) -> u16 {
        self.current
    }

    /// Yield next sequence number and advance monotonically with 16-bit wraparound.
    #[inline(always)]
    pub fn next_sequence(&mut self) -> u16 {
        let seq = self.current;
        self.current = self.current.wrapping_add(1);
        seq
    }
}
