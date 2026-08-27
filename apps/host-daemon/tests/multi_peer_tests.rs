//! Multi-Peer Session Manager & Slot Allocation Unit Tests.

use lookaremote_host_daemon::core::multi_peer::{
    MultiPeerError, MultiPeerSessionManager, MAX_PEERS,
};
use lookaremote_host_daemon::core::session::SessionState;

#[test]
fn test_slot_allocation_and_capacity_limits() {
    let mut mgr = MultiPeerSessionManager::new();
    assert_eq!(mgr.active_count(), 0);
    assert!(!mgr.is_full());

    // 1. Allocate Player 1
    let (slot1, id1) = mgr
        .allocate_slot([1u8; 32], [10u8; 32], None)
        .expect("P1 allocation succeeds");
    assert_eq!(slot1, 0);
    assert_eq!(mgr.active_count(), 1);

    // 2. Allocate Player 2
    let (slot2, id2) = mgr
        .allocate_slot([2u8; 32], [20u8; 32], None)
        .expect("P2 allocation succeeds");
    assert_eq!(slot2, 1);
    assert_eq!(mgr.active_count(), 2);

    // 3. Allocate Player 3
    let (slot3, id3) = mgr
        .allocate_slot([3u8; 32], [30u8; 32], None)
        .expect("P3 allocation succeeds");
    assert_eq!(slot3, 2);
    assert_eq!(mgr.active_count(), 3);

    // 4. Allocate Player 4
    let (slot4, id4) = mgr
        .allocate_slot([4u8; 32], [40u8; 32], None)
        .expect("P4 allocation succeeds");
    assert_eq!(slot4, 3);
    assert_eq!(mgr.active_count(), 4);
    assert!(mgr.is_full());

    // 5. Attempt 5th peer allocation -> MaxCapacityReached(4)
    let fifth_err = mgr
        .allocate_slot([5u8; 32], [50u8; 32], None)
        .expect_err("5th peer must be rejected");
    assert_eq!(fifth_err, MultiPeerError::MaxCapacityReached(MAX_PEERS));

    // Verify slots exist by ID
    assert_eq!(mgr.find_slot_by_session_id(&id1).unwrap().slot_index, 0);
    assert_eq!(mgr.find_slot_by_session_id(&id2).unwrap().slot_index, 1);
    assert_eq!(mgr.find_slot_by_session_id(&id3).unwrap().slot_index, 2);
    assert_eq!(mgr.find_slot_by_session_id(&id4).unwrap().slot_index, 3);
}

#[test]
fn test_slot_reuse_lowest_index() {
    let mut mgr = MultiPeerSessionManager::new();

    let (_s0, id0) = mgr.allocate_slot([0u8; 32], [0u8; 32], None).unwrap();
    let (_s1, id1) = mgr.allocate_slot([1u8; 32], [1u8; 32], None).unwrap();
    let (_s2, _id2) = mgr.allocate_slot([2u8; 32], [2u8; 32], None).unwrap();

    assert_eq!(mgr.active_count(), 3);

    // Disconnect Slot 1 (P2)
    let freed = mgr.free_session(&id1);
    assert!(freed.is_some());
    assert_eq!(freed.unwrap().slot_index, 1);
    assert_eq!(mgr.active_count(), 2);

    // Allocate new peer -> must reuse Slot 1
    let (new_slot, new_id) = mgr.allocate_slot([99u8; 32], [99u8; 32], None).unwrap();
    assert_eq!(new_slot, 1);
    assert_eq!(mgr.find_slot(1).unwrap().session_id, new_id);

    // Disconnect Slot 0 (P1)
    mgr.free_slot(0);
    assert_eq!(mgr.find_slot_by_session_id(&id0), None);

    // Next allocation must reuse Slot 0
    let (s0_new, _) = mgr.allocate_slot([100u8; 32], [100u8; 32], None).unwrap();
    assert_eq!(s0_new, 0);
}

#[test]
fn test_telemetry_and_slot_summaries() {
    let mut mgr = MultiPeerSessionManager::new();

    let (slot0, _) = mgr.allocate_slot([1u8; 32], [1u8; 32], None).unwrap();
    mgr.set_slot_state(slot0, SessionState::Connected);
    mgr.update_telemetry(slot0, 4, Some(85), Some(false));
    mgr.feed_slot_packet(slot0);
    mgr.feed_slot_packet(slot0);

    let summaries = mgr.summaries();
    assert_eq!(summaries.len(), 1);
    assert_eq!(summaries[0].slot_index, 0);
    assert_eq!(summaries[0].player_label, "Player 1");
    assert_eq!(summaries[0].color_hex, "#00E5FF");
    assert_eq!(summaries[0].state, SessionState::Connected);
    assert_eq!(summaries[0].battery_level, Some(85));
    assert_eq!(summaries[0].is_charging, Some(false));
    assert_eq!(summaries[0].rtt_ms, 4);
    assert_eq!(summaries[0].packets_received, 2);
}
