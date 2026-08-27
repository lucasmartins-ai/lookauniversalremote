//! LookARemote Host Daemon Binary Entrypoint.

use clap::Parser;
use lookaremote_host_daemon::core::config::{CliArgs, DaemonConfig};
use lookaremote_host_daemon::core::state::AppState;
use lookaremote_host_daemon::input::events::InputEvent;
use lookaremote_host_daemon::input::watchdog::DeadManWatchdog;
use lookaremote_host_daemon::pairing::crypto::HostKeyPair;
use lookaremote_host_daemon::pairing::nonce::NonceManager;
use lookaremote_host_daemon::pairing::qr::{build_pairing_uri, render_terminal_qr};
use lookaremote_host_daemon::transport::network::{
    discover_local_ip, validate_bind_address,
};
use lookaremote_host_daemon::transport::signaling::create_signaling_router;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc;
use tracing::{info, warn};
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = CliArgs::parse();

    // Initialize Tracing Subscriber
    let filter = if args.debug {
        EnvFilter::new("lookaremote_host_daemon=debug,webrtc=debug,tower_http=debug,axum=debug")
    } else {
        EnvFilter::try_from_default_env().unwrap_or_else(|_| {
            EnvFilter::new("lookaremote_host_daemon=info,tower_http=warn,axum=info")
        })
    };

    tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_target(false)
        .compact()
        .init();

    let config: DaemonConfig = args.clone().into();

    // 1. Resolve Bind Address & Local LAN IP
    let host_ip = match config.bind_addr {
        Some(explicit_ip) => {
            validate_bind_address(&explicit_ip, config.allow_wan)?;
            explicit_ip
        }
        None => discover_local_ip(config.allow_wan)?,
    };

    // 2. Ephemeral Cryptographic Handshake Initialization
    let keypair = HostKeyPair::generate();
    let nonce_mgr = Arc::new(NonceManager::new(Duration::from_secs(config.nonce_ttl_secs)));
    let initial_nonce = nonce_mgr.generate_nonce();

    let host_pubkey_hex = keypair.public_key_hex();
    let initial_nonce_hex = hex::encode(initial_nonce);

    // 3. Build Canonical Pairing URI
    let pairing_uri = build_pairing_uri(
        &host_ip.to_string(),
        config.port,
        &host_pubkey_hex,
        &initial_nonce_hex,
    );

    // 4. Print Banner & Terminal QR Code
    println!("\n╔═══════════════════════════════════════════════════════════════╗");
    println!("║       LOOKAREMOTE HOST DAEMON — ULTRA-LOW LATENCY INPUT       ║");
    println!("╚═══════════════════════════════════════════════════════════════╝\n");
    println!("  • Host IP:           {}", host_ip);
    println!("  • Signaling Port:    {}", config.port);
    println!("  • Public Key:        {}...", &host_pubkey_hex[..16]);
    println!("  • Nonce TTL:         {}s", config.nonce_ttl_secs);
    println!("  • Watchdog Timeout:  {}ms", config.watchdog_timeout_ms);
    println!("  • Pairing URI:       {}\n", pairing_uri);

    if !config.no_qr {
        println!("Scan this QR code with your mobile camera / LookARemote PWA:\n");
        match render_terminal_qr(&pairing_uri) {
            Ok(qr_art) => println!("{qr_art}\n"),
            Err(e) => warn!("Failed to render terminal QR code: {e}"),
        }
    }

    // 5. Check macOS Accessibility Permissions & Initialize Virtual Drivers
    #[cfg(target_os = "macos")]
    lookaremote_host_daemon::drivers::check_macos_accessibility_permissions();

    let gamepad_driver = lookaremote_host_daemon::drivers::create_platform_driver();
    let mouse_driver = lookaremote_host_daemon::drivers::create_platform_mouse_driver();
    let keyboard_driver = lookaremote_host_daemon::drivers::create_platform_keyboard_driver();
    let input_router = Arc::new(lookaremote_host_daemon::input::InputRouter::with_drivers(
        gamepad_driver,
        mouse_driver,
        keyboard_driver,
    ));

    // 6. Initialize Smart Context Engine (Profiles, Matcher, Detector, Arbitrator)
    let config_path = config
        .config_file
        .as_deref()
        .unwrap_or("config.toml");

    let context_config = match lookaremote_host_daemon::context::ContextConfig::from_file(config_path) {
        Ok(cfg) => {
            info!(path = %config_path, profiles = cfg.profiles.len(), "Loaded Smart Context profile configuration");
            cfg
        }
        Err(e) => {
            info!(path = %config_path, error = %e, "No custom config.toml found or parse error; using built-in defaults");
            lookaremote_host_daemon::context::ContextConfig::default()
        }
    };

    let matcher = Arc::new(
        lookaremote_host_daemon::context::ProfileMatcher::from_config(&context_config)
            .unwrap_or_else(|e| {
                warn!("Failed to compile regex patterns in config profiles: {e}");
                lookaremote_host_daemon::context::ProfileMatcher::from_config(
                    &lookaremote_host_daemon::context::ContextConfig::default(),
                )
                .expect("Default profiles are valid")
            }),
    );

    let window_detector: Arc<dyn lookaremote_host_daemon::context::WindowDetector> =
        Arc::from(lookaremote_host_daemon::context::create_platform_window_detector());

    let context_arbitrator = Arc::new(tokio::sync::Mutex::new(
        lookaremote_host_daemon::context::ContextArbitrator::new(context_config.daemon.default_mode),
    ));

    let context_watcher = Arc::new(lookaremote_host_daemon::context::ContextWatcher::new(
        Arc::clone(&window_detector),
        Arc::clone(&matcher),
        Arc::clone(&context_arbitrator),
        context_config.daemon.clone(),
    ));

    // Spawn Context Watcher background monitoring loop
    let _context_watcher_handle = context_watcher.clone().spawn_loop();

    // 7. Watchdog Setup (Dead-Man Switch 100ms)
    let watchdog = Arc::new(DeadManWatchdog::new(
        Duration::from_millis(config.watchdog_timeout_ms),
        Duration::from_millis(config.watchdog_check_interval_ms),
    ));

    // Spawn emergency reset handler wired to InputRouter neutralization & Context Arbitrator
    let watchdog_router = Arc::clone(&input_router);
    let watchdog_arb = Arc::clone(&context_arbitrator);
    let _watchdog_handle = watchdog.spawn_monitor(move || {
        warn!("EMERGENCY RELEASE: Dead-Man switch fired! Neutralizing all virtual controller inputs.");
        if let Err(err) = watchdog_router.neutralize() {
            warn!("Failed to neutralize inputs on watchdog alert: {err}");
        }
        if let Ok(mut arb) = watchdog_arb.try_lock() {
            arb.set_emergency(true);
        }
    });

    // 8. Input Event Channel
    let (event_tx, mut event_rx) = mpsc::channel::<InputEvent>(1024);

    // Background task consuming input events and routing to virtual driver / context engine
    let dispatch_router = Arc::clone(&input_router);
    let dispatch_watcher = Arc::clone(&context_watcher);
    tokio::spawn(async move {
        while let Some(event) = event_rx.recv().await {
            match event {
                InputEvent::ModeSwitch(ref mode_msg) => {
                    dispatch_watcher.handle_client_mode_switch(mode_msg).await;
                }
                _ => {
                    if let Err(err) = dispatch_router.route_event(&event) {
                        tracing::warn!("Failed to route input event to driver: {err}");
                    }
                }
            }
        }
    });

    // 9. Initialize Shared Application State
    let app_state = AppState::with_context(
        config.clone(),
        keypair,
        Arc::clone(&nonce_mgr),
        Arc::clone(&watchdog),
        Some(event_tx),
        Some(Arc::clone(&context_watcher)),
        Some(Arc::clone(&input_router)),
    );

    // 10. Start Desktop System Tray Companion (unless --no-tray is passed)
    if !config.no_tray {
        if let Err(e) = lookaremote_host_daemon::tray::TrayCompanion::spawn(app_state.clone()) {
            warn!("Failed to initialize Desktop System Tray Companion: {e}");
        }
    }

    // 11. Build Axum Router
    let router = create_signaling_router(app_state);

    // 12. Start Axum TCP Listener
    let bind_socket = SocketAddr::new(host_ip, config.port);
    info!("Starting signaling server on http://{}", bind_socket);
    info!("Local QR Code page available at http://{}:{}/qr", host_ip, config.port);

    let listener = tokio::net::TcpListener::bind(bind_socket).await?;

    axum::serve(listener, router)
        .with_graceful_shutdown(async move {
            let _ = tokio::signal::ctrl_c().await;
            info!("Shutdown signal received. Terminating LookARemote daemon...");
            watchdog.stop();
        })
        .await?;

    info!("LookARemote Host Daemon exited cleanly.");
    Ok(())
}
