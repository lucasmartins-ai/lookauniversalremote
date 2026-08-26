//! Integration tests for DeadManWatchdog (100ms dead-man safety switch).

use lookaremote_host_daemon::input::watchdog::DeadManWatchdog;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;

#[tokio::test]
async fn test_watchdog_feed_and_elapsed() {
    let watchdog = DeadManWatchdog::new(Duration::from_millis(100), Duration::from_millis(10));
    assert!(!watchdog.is_armed());

    watchdog.arm();
    assert!(watchdog.is_armed());

    tokio::time::sleep(Duration::from_millis(30)).await;
    let elapsed = watchdog.elapsed_since_feed();
    assert!(
        elapsed >= Duration::from_millis(25),
        "Elapsed duration should be ~30ms"
    );

    // Feed resets elapsed
    watchdog.feed();
    let elapsed_after = watchdog.elapsed_since_feed();
    assert!(
        elapsed_after < Duration::from_millis(10),
        "Elapsed duration right after feed should be close to 0"
    );

    watchdog.disarm();
    assert!(!watchdog.is_armed());
}

#[tokio::test]
async fn test_watchdog_emergency_trigger_on_timeout() {
    let timeout = Duration::from_millis(60);
    let check_interval = Duration::from_millis(10);
    let watchdog = Arc::new(DeadManWatchdog::new(timeout, check_interval));

    let triggered_flag = Arc::new(AtomicBool::new(false));
    let trigger_count = Arc::new(AtomicU64::new(0));

    let flag_clone = Arc::clone(&triggered_flag);
    let count_clone = Arc::clone(&trigger_count);

    let monitor_handle = watchdog.spawn_monitor(move || {
        flag_clone.store(true, Ordering::SeqCst);
        count_clone.fetch_add(1, Ordering::SeqCst);
    });

    watchdog.arm();

    // 1. Feed continuously for 120ms (every 20ms < 60ms timeout)
    for _ in 0..6 {
        tokio::time::sleep(Duration::from_millis(20)).await;
        watchdog.feed();
    }

    assert!(
        !triggered_flag.load(Ordering::SeqCst),
        "Watchdog should NOT trigger while actively fed"
    );
    assert_eq!(trigger_count.load(Ordering::SeqCst), 0);

    // 2. Stop feeding and wait for timeout (>60ms)
    tokio::time::sleep(Duration::from_millis(85)).await;

    assert!(
        triggered_flag.load(Ordering::SeqCst),
        "Watchdog MUST trigger emergency release after 60ms inactivity"
    );
    assert_eq!(
        trigger_count.load(Ordering::SeqCst),
        1,
        "Watchdog should trigger emergency release exactly once per stale cycle"
    );
    assert!(watchdog.is_triggered());

    // 3. Resume feeding -> should reset triggered state
    watchdog.feed();
    assert!(!watchdog.is_triggered());

    // Stop watchdog
    watchdog.stop();
    let _ = monitor_handle.await;
}
