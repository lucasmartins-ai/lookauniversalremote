//! macOS Accessibility (TCC) Permissions Checker.
//!
//! Checks whether the host daemon process has been granted macOS Accessibility
//! permissions (required by CoreGraphics `CGEventPost` to inject synthetic input events).

use tracing::{info, warn};

#[cfg(target_os = "macos")]
#[link(name = "ApplicationServices", kind = "framework")]
extern "C" {
    fn AXIsProcessTrusted() -> bool;
}

/// Checks if the current process has macOS Accessibility permissions.
///
/// On macOS: calls `AXIsProcessTrusted()`. If not trusted, logs detailed instructions
/// guiding the user to grant permission in System Settings.
/// On other platforms: returns `true`.
pub fn check_macos_accessibility_permissions() -> bool {
    #[cfg(target_os = "macos")]
    {
        let is_trusted = unsafe { AXIsProcessTrusted() };
        if is_trusted {
            info!("macOS Accessibility (TCC) permissions: GRANTED");
            true
        } else {
            warn!(
                "\n\
                ⚠️  ===============================================================\n\
                ⚠️  LOOKAREMOTE WARNING: ACCESSIBILITY PERMISSION REQUIRED (macOS)\n\
                ⚠️  ===============================================================\n\
                LookARemote requires Accessibility permissions to inject mouse and\n\
                keyboard input events via CoreGraphics.\n\n\
                To grant permission:\n\
                  1. Open System Settings (Ajustes do Sistema)\n\
                  2. Go to Privacy & Security > Accessibility (Privacidade e Segurança > Acessibilidade)\n\
                  3. Enable your terminal or LookARemote Host Daemon in the list.\n\
                  4. If already enabled, toggle it off and on again.\n\
                ===============================================================\n"
            );
            false
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        true
    }
}
