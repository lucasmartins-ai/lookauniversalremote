//! Priority arbitrator enforcing the strict Smart Context decision hierarchy:
//! Emergency Kill > Manual Client Override > Foreground Profile Match > Default Mode.

use crate::context::profile::{ProfileConfig, TargetControlMode};

/// Classification of the winning source behind the active mode determination.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ArbitrationSource {
    /// Watchdog dead-man trip or emergency stop activated.
    Emergency,
    /// Mobile client explicit manual mode lock.
    ManualOverride,
    /// Foreground active window profile match.
    ProfileMatch,
    /// Fallback default mode when no rules match.
    DefaultMode,
}

/// Result of an arbitration evaluation cycle.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ArbitrationResult {
    /// Effective active control mode.
    pub active_mode: TargetControlMode,
    /// Originating arbitration source that determined the mode.
    pub source: ArbitrationSource,
    /// Name of the matched profile (if source is ProfileMatch).
    pub matched_profile_name: Option<String>,
    /// Whether the resolved mode differs from the previous state.
    pub mode_changed: bool,
}

/// Context Arbitrator executing the priority resolution rules.
#[derive(Debug, Clone)]
pub struct ContextArbitrator {
    current_mode: TargetControlMode,
    manual_override: Option<TargetControlMode>,
    manual_locked: bool,
    emergency_active: bool,
    last_matched_profile: Option<String>,
    last_source: ArbitrationSource,
}

impl ContextArbitrator {
    /// Creates a new ContextArbitrator with the provided initial default mode.
    pub fn new(initial_mode: TargetControlMode) -> Self {
        Self {
            current_mode: initial_mode,
            manual_override: None,
            manual_locked: false,
            emergency_active: false,
            last_matched_profile: None,
            last_source: ArbitrationSource::DefaultMode,
        }
    }

    /// Sets or clears the emergency state (e.g. from DeadManWatchdog).
    pub fn set_emergency(&mut self, emergency: bool) {
        self.emergency_active = emergency;
    }

    /// Returns whether the emergency state is currently active.
    pub fn is_emergency(&self) -> bool {
        self.emergency_active
    }

    /// Sets a manual client override with optional persistence locking.
    pub fn set_manual_override(&mut self, mode: TargetControlMode, locked: bool) {
        self.manual_override = Some(mode);
        self.manual_locked = locked;
    }

    /// Clears any manual client override and returns to automatic foreground switching.
    pub fn clear_manual_override(&mut self) {
        self.manual_override = None;
        self.manual_locked = false;
    }

    /// Returns whether manual override is actively locked by the client.
    pub fn is_manual_locked(&self) -> bool {
        self.manual_locked
    }

    /// Returns the active control mode.
    pub fn current_mode(&self) -> TargetControlMode {
        self.current_mode
    }

    /// Returns the last determined arbitration source.
    pub fn last_source(&self) -> ArbitrationSource {
        self.last_source
    }

    /// Evaluates the priority hierarchy given the current matched profile and default mode.
    pub fn evaluate(
        &mut self,
        matched: Option<(&ProfileConfig, TargetControlMode)>,
        default_mode: TargetControlMode,
    ) -> ArbitrationResult {
        // Priority 1: Emergency Kill
        if self.emergency_active {
            let changed = self.current_mode != default_mode || self.last_source != ArbitrationSource::Emergency;
            self.current_mode = default_mode;
            self.last_source = ArbitrationSource::Emergency;
            self.last_matched_profile = None;

            return ArbitrationResult {
                active_mode: default_mode,
                source: ArbitrationSource::Emergency,
                matched_profile_name: None,
                mode_changed: changed,
            };
        }

        // Priority 2: Manual Client Override (if manual lock is active)
        if self.manual_locked {
            if let Some(manual_mode) = self.manual_override {
                let changed = self.current_mode != manual_mode;
                self.current_mode = manual_mode;
                self.last_source = ArbitrationSource::ManualOverride;
                self.last_matched_profile = None;

                return ArbitrationResult {
                    active_mode: manual_mode,
                    source: ArbitrationSource::ManualOverride,
                    matched_profile_name: None,
                    mode_changed: changed,
                };
            }
        }

        // Priority 3: Foreground Profile Match
        if let Some((prof, mode)) = matched {
            let changed = self.current_mode != mode;
            self.current_mode = mode;
            self.last_source = ArbitrationSource::ProfileMatch;
            self.last_matched_profile = Some(prof.name.clone());

            return ArbitrationResult {
                active_mode: mode,
                source: ArbitrationSource::ProfileMatch,
                matched_profile_name: Some(prof.name.clone()),
                mode_changed: changed,
            };
        }

        // Priority 4: Default Fallback Mode
        let changed = self.current_mode != default_mode;
        self.current_mode = default_mode;
        self.last_source = ArbitrationSource::DefaultMode;
        self.last_matched_profile = None;

        ArbitrationResult {
            active_mode: default_mode,
            source: ArbitrationSource::DefaultMode,
            matched_profile_name: None,
            mode_changed: changed,
        }
    }
}
