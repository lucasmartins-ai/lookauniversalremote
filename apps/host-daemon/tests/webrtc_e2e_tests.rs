//! End-to-end integration tests for WebRTC DataChannel streaming and zero-allocation packet decoding.

use bytes::Bytes;
use lookaremote_host_daemon::input::events::InputEvent;
use lookaremote_host_daemon::input::watchdog::DeadManWatchdog;
use lookaremote_host_daemon::transport::packet_handler::handle_raw_packet;
use lookaremote_host_daemon::transport::webrtc::{
    configure_data_channel, create_peer_connection, WebRtcConfig,
};
use lookaremote_protocol::decoder::Packet;
use lookaremote_protocol::encoder::encode_packet;
use lookaremote_protocol::header::{Header, HeaderFlags};
use lookaremote_protocol::messages::{GamepadFullMessage, MessageType, MotionMessage};
use lookaremote_protocol::Payload;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{mpsc, Notify};
use webrtc::data_channel::data_channel_init::RTCDataChannelInit;
use webrtc::ice_transport::ice_candidate::{RTCIceCandidate, RTCIceCandidateInit};

#[tokio::test]
async fn test_packet_handler_decoding_and_watchdog_feed() {
    let watchdog = DeadManWatchdog::standard();
    watchdog.arm();

    let (tx, mut rx) = mpsc::channel::<InputEvent>(10);

    // 1. Construct MSG_MOTION packet
    let motion_msg = MotionMessage {
        gyro_yaw: 120,
        gyro_pitch: -340,
        gyro_roll: 560,
        accel_x: 1000,
        accel_y: -2000,
        accel_z: 9810,
        timestamp_us: 100,
    };
    let header = Header::new(MessageType::Motion, HeaderFlags::empty(), 1);
    let packet_motion = Packet::new(header, Payload::Motion(motion_msg));
    let encoded_motion =
        encode_packet(&packet_motion).expect("Encoding motion packet must succeed");

    // Sleep a tiny bit to measure feed
    tokio::time::sleep(Duration::from_millis(15)).await;
    assert!(watchdog.elapsed_since_feed() >= Duration::from_millis(10));

    // 2. Handle raw packet
    let packet = handle_raw_packet(encoded_motion.as_slice(), &watchdog, Some(&tx))
        .expect("Decoding valid packet must succeed");

    assert_eq!(packet.header.sequence, 1);
    assert_eq!(packet.header.msg_type, MessageType::Motion);

    // Watchdog must have been fed
    assert!(
        watchdog.elapsed_since_feed() < Duration::from_millis(10),
        "Watchdog should be fed immediately on packet handle"
    );

    // Event must be dispatched to channel
    let received_event = rx.recv().await.expect("Channel must receive event");
    match received_event {
        InputEvent::Motion(m) => {
            assert_eq!(m.gyro_yaw, 120);
            assert_eq!(m.gyro_pitch, -340);
            assert_eq!(m.accel_z, 9810);
        }
        _ => panic!("Expected InputEvent::Motion"),
    }

    // 3. Construct MSG_GAMEPAD_FULL packet
    let gamepad_msg = GamepadFullMessage {
        buttons: 0x0005, // A + X pressed
        stick_lx: 16000,
        stick_ly: -16000,
        stick_rx: 32000,
        stick_ry: -32000,
        trigger_l: 255,
        trigger_r: 128,
        player_index: 0,
        reserved: 0,
    };
    let gp_header = Header::new(MessageType::GamepadFull, HeaderFlags::empty(), 2);
    let packet_gamepad = Packet::new(gp_header, Payload::GamepadFull(gamepad_msg));
    let encoded_gp = encode_packet(&packet_gamepad).expect("Encoding gamepad packet must succeed");

    let gp_packet = handle_raw_packet(encoded_gp.as_slice(), &watchdog, Some(&tx))
        .expect("Decoding valid gamepad packet must succeed");

    assert_eq!(gp_packet.header.sequence, 2);
    let received_gp_event = rx.recv().await.expect("Channel must receive gamepad event");
    match received_gp_event {
        InputEvent::GamepadFull(g) => {
            assert_eq!(g.buttons, 0x0005);
            assert_eq!(g.stick_lx, 16000);
            assert_eq!(g.trigger_l, 255);
        }
        _ => panic!("Expected InputEvent::GamepadFull"),
    }
}

#[tokio::test]
async fn test_webrtc_loopback_datachannel_end_to_end() {
    let _ = rustls::crypto::ring::default_provider().install_default();
    let config = WebRtcConfig::default();

    // 1. Create Host PeerConnection
    let host_pc = create_peer_connection(&config)
        .await
        .expect("Host peer connection creation failed");

    // 2. Create Client PeerConnection (with DTLS Client role for loopback testing)
    let mut client_media_engine = webrtc::api::media_engine::MediaEngine::default();
    client_media_engine.register_default_codecs().unwrap();
    let mut client_setting_engine = webrtc::api::setting_engine::SettingEngine::default();
    client_setting_engine
        .set_answering_dtls_role(webrtc::dtls_transport::dtls_role::DTLSRole::Client)
        .unwrap();
    let client_api = webrtc::api::APIBuilder::new()
        .with_media_engine(client_media_engine)
        .with_setting_engine(client_setting_engine)
        .build();
    let client_pc = Arc::new(
        client_api
            .new_peer_connection(webrtc::peer_connection::configuration::RTCConfiguration::default())
            .await
            .expect("Client peer connection creation failed"),
    );

    // Connect ICE candidates between peers with pending candidate queues
    let host_candidates_queue =
        Arc::new(tokio::sync::Mutex::new(Vec::<RTCIceCandidateInit>::new()));
    let client_candidates_queue =
        Arc::new(tokio::sync::Mutex::new(Vec::<RTCIceCandidateInit>::new()));

    let host_pc_clone = Arc::clone(&host_pc);
    let client_pc_clone = Arc::clone(&client_pc);
    let client_q = Arc::clone(&client_candidates_queue);
    let host_q = Arc::clone(&host_candidates_queue);

    host_pc.on_ice_candidate(Box::new(move |c: Option<RTCIceCandidate>| {
        let client_pc = Arc::clone(&client_pc_clone);
        let client_q = Arc::clone(&client_q);
        Box::pin(async move {
            if let Some(cand) = c {
                if let Ok(init) = cand.to_json() {
                    if client_pc.add_ice_candidate(init.clone()).await.is_err() {
                        client_q.lock().await.push(init);
                    }
                }
            }
        })
    }));

    client_pc.on_ice_candidate(Box::new(move |c: Option<RTCIceCandidate>| {
        let host_pc = Arc::clone(&host_pc_clone);
        let host_q = Arc::clone(&host_q);
        Box::pin(async move {
            if let Some(cand) = c {
                if let Ok(init) = cand.to_json() {
                    if host_pc.add_ice_candidate(init.clone()).await.is_err() {
                        host_q.lock().await.push(init);
                    }
                }
            }
        })
    }));

    let watchdog = Arc::new(DeadManWatchdog::standard());
    let (event_tx, mut event_rx) = mpsc::channel::<InputEvent>(10);

    let host_opened = Arc::new(Notify::new());
    let host_opened_clone = Arc::clone(&host_opened);

    // Host receives DataChannel
    let wd_for_dc = Arc::clone(&watchdog);
    host_pc.on_data_channel(Box::new(move |dc| {
        let host_opened = Arc::clone(&host_opened_clone);
        dc.on_open(Box::new(move || {
            host_opened.notify_one();
            Box::pin(async {})
        }));

        configure_data_channel(dc, Arc::clone(&wd_for_dc), Some(event_tx.clone()));
        Box::pin(async {})
    }));

    // Client creates DataChannel (ordered: false, max_retransmits: 0)
    let dc_init = RTCDataChannelInit {
        ordered: Some(false),
        max_retransmits: Some(0),
        ..Default::default()
    };
    let client_dc = client_pc
        .create_data_channel("lookaremote-input", Some(dc_init))
        .await
        .expect("Client data channel creation failed");

    let client_opened = Arc::new(Notify::new());
    let client_opened_clone = Arc::clone(&client_opened);
    client_dc.on_open(Box::new(move || {
        client_opened_clone.notify_one();
        Box::pin(async {})
    }));

    // 3. Negotiate SDP Offer/Answer
    let offer = client_pc
        .create_offer(None)
        .await
        .expect("Failed to create offer");
    client_pc
        .set_local_description(offer.clone())
        .await
        .expect("Failed to set client local description");

    host_pc
        .set_remote_description(offer)
        .await
        .expect("Failed to set host remote description");

    // Drain queued candidates to host
    let mut host_q_lock = host_candidates_queue.lock().await;
    for cand in host_q_lock.drain(..) {
        let _ = host_pc.add_ice_candidate(cand).await;
    }
    drop(host_q_lock);

    let answer = host_pc
        .create_answer(None)
        .await
        .expect("Failed to create answer");
    host_pc
        .set_local_description(answer.clone())
        .await
        .expect("Failed to set host local description");

    client_pc
        .set_remote_description(answer)
        .await
        .expect("Failed to set client remote description");

    // Drain queued candidates to client and host with active polling
    let host_pc_f = Arc::clone(&host_pc);
    let client_pc_f = Arc::clone(&client_pc);
    let host_q_f = Arc::clone(&host_candidates_queue);
    let client_q_f = Arc::clone(&client_candidates_queue);

    let _flusher = tokio::spawn(async move {
        for _ in 0..150 {
            tokio::time::sleep(Duration::from_millis(20)).await;
            let mut hq = host_q_f.lock().await;
            for cand in hq.drain(..) {
                let _ = host_pc_f.add_ice_candidate(cand).await;
            }
            let mut cq = client_q_f.lock().await;
            for cand in cq.drain(..) {
                let _ = client_pc_f.add_ice_candidate(cand).await;
            }
        }
    });

    // Wait for DataChannel to open
    tokio::select! {
        _ = client_opened.notified() => {},
        _ = tokio::time::sleep(Duration::from_secs(15)) => panic!("Client DataChannel failed to open in 15s"),
    }

    // 4. Send binary packet from Client to Host over WebRTC DataChannel
    let motion_msg = MotionMessage {
        gyro_yaw: 777,
        gyro_pitch: -888,
        gyro_roll: 999,
        accel_x: 0,
        accel_y: 0,
        accel_z: 9800,
        timestamp_us: 16,
    };
    let header = Header::new(MessageType::Motion, HeaderFlags::empty(), 10);
    let packet = Packet::new(header, Payload::Motion(motion_msg));
    let encoded = encode_packet(&packet).unwrap();

    client_dc
        .send(&Bytes::copy_from_slice(encoded.as_slice()))
        .await
        .expect("DataChannel send failed");

    // 5. Verify Host received and decoded event
    tokio::select! {
        Some(received_event) = event_rx.recv() => {
            match received_event {
                InputEvent::Motion(m) => {
                    assert_eq!(m.gyro_yaw, 777);
                    assert_eq!(m.gyro_pitch, -888);
                    assert_eq!(m.gyro_roll, 999);
                }
                _ => panic!("Expected InputEvent::Motion"),
            }
        }
        _ = tokio::time::sleep(Duration::from_secs(3)) => panic!("Timed out waiting for input event over DataChannel"),
    }

    // Cleanup
    let _ = client_pc.close().await;
    let _ = host_pc.close().await;
}
