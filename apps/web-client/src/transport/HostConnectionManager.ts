/**
 * LookARemote Host Connection Manager
 * Centralizes host URL resolution, protocol scheme handling (HTTP/HTTPS, WS/WSS),
 * Local Network Access (LNA) diagnostics, and connection endpoints.
 */

export interface HostTarget {
  host: string;
  port: number;
}

export interface ConnectionDiagnostics {
  isHttpsPage: boolean;
  isTargetLocal: boolean;
  isMixedContentRisk: boolean;
  recommendedWsScheme: 'ws:' | 'wss:';
  recommendedHttpScheme: 'http:' | 'https:';
}

export interface HostHealthStatus {
  reachable: boolean;
  version?: string;
  sessionState?: string;
  activePeers?: number;
  error?: string;
}

export class HostConnectionManager {
  public static readonly DEFAULT_PORT = 8765;

  /**
   * Determine whether current client runtime is loaded over HTTPS.
   */
  public static isHttps(): boolean {
    if (typeof window === 'undefined') return false;
    return window.location.protocol === 'https:';
  }

  /**
   * Check if running in standalone installed PWA mode.
   */
  public static isStandalonePwa(): boolean {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    );
  }

  /**
   * Check if a given host is a loopback/localhost address.
   */
  public static isLocalhost(host: string): boolean {
    const cleanHost = host.trim().toLowerCase();
    return (
      cleanHost === 'localhost' ||
      cleanHost === '127.0.0.1' ||
      cleanHost === '::1' ||
      cleanHost.endsWith('.localhost')
    );
  }

  /**
   * Check if a given host string is a private RFC 1918 / local network IP.
   */
  public static isPrivateIp(host: string): boolean {
    const cleanHost = host.trim().toLowerCase();
    if (this.isLocalhost(cleanHost)) return true;

    // IPv4 private ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16
    const ipv4Match = cleanHost.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4Match) {
      const oct1 = parseInt(ipv4Match[1], 10);
      const oct2 = parseInt(ipv4Match[2], 10);

      if (oct1 === 10) return true;
      if (oct1 === 172 && oct2 >= 16 && oct2 <= 31) return true;
      if (oct1 === 192 && oct2 === 168) return true;
      if (oct1 === 169 && oct2 === 254) return true;
    }

    return cleanHost.endsWith('.local');
  }

  /**
   * Analyze connection security and mixed-content risks between page origin and host target.
   */
  public static getDiagnostics(host: string): ConnectionDiagnostics {
    const isHttpsPage = this.isHttps();
    const isTargetLocal = this.isPrivateIp(host);

    // Mixed content risk occurs when HTTPS PWA attempts to connect directly to plain local HTTP/WS
    const isMixedContentRisk = isHttpsPage && isTargetLocal;

    // In modern browsers, WSS is required from HTTPS pages unless connecting to localhost in dev
    const recommendedWsScheme = isHttpsPage && !this.isLocalhost(host) ? 'wss:' : 'ws:';
    const recommendedHttpScheme = isHttpsPage && !this.isLocalhost(host) ? 'https:' : 'http:';

    return {
      isHttpsPage,
      isTargetLocal,
      isMixedContentRisk,
      recommendedWsScheme,
      recommendedHttpScheme,
    };
  }

  /**
   * Resolve HTTP base URL for a given host and port.
   */
  public static getHttpBaseUrl(host: string, port = this.DEFAULT_PORT): string {
    const cleanHost = host.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    const hasPort = cleanHost.includes(':');
    const hostWithPort = hasPort ? cleanHost : `${cleanHost}:${port}`;

    // Use http:// for local network targets to communicate directly with daemon
    // If on HTTPS and host is localhost, browsers allow http://localhost:PORT
    const scheme = this.isHttps() && !this.isPrivateIp(cleanHost) ? 'https:' : 'http:';
    return `${scheme}//${hostWithPort}`;
  }

  /**
   * Resolve WebSocket signaling URL for a given host and port.
   */
  public static getSignalingWsUrl(host: string, port = this.DEFAULT_PORT, sessionId?: string): string {
    const cleanHost = host.trim().replace(/^wss?:\/\//i, '').replace(/\/.*$/, '');
    const hasPort = cleanHost.includes(':');
    const hostWithPort = hasPort ? cleanHost : `${cleanHost}:${port}`;

    // When page is HTTPS and target is external, use wss. For local network daemon, use ws.
    const wsScheme = this.isHttps() && !this.isPrivateIp(cleanHost) ? 'wss:' : 'ws:';
    const basePath = `${wsScheme}//${hostWithPort}/ws/signaling`;

    return sessionId ? `${basePath}?session_id=${encodeURIComponent(sessionId)}` : basePath;
  }

  /**
   * Resolve Pairing endpoint URL (`/api/pair`).
   */
  public static getPairingEndpoint(host: string, port = this.DEFAULT_PORT): string {
    return `${this.getHttpBaseUrl(host, port)}/api/pair`;
  }

  /**
   * Resolve Health Check endpoint URL (`/health` or `/api/v1/health`).
   */
  public static getHealthEndpoint(host: string, port = this.DEFAULT_PORT): string {
    return `${this.getHttpBaseUrl(host, port)}/health`;
  }

  /**
   * Resolve a versioned or legacy API URL with optional host fallback.
   */
  public static getHttpEndpoint(path: string, host?: string, port = this.DEFAULT_PORT): string {
    const targetHost = host || (typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1') || '127.0.0.1';
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.getHttpBaseUrl(targetHost, port)}${normalizedPath}`;
  }

  /**
   * Resolve a versioned or legacy API URL.
   */
  public static getApiUrl(host: string, path: string, port = this.DEFAULT_PORT): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.getHttpBaseUrl(host, port)}${normalizedPath}`;
  }

  /**
   * Perform an active health check ping to verify connectivity with host daemon.
   */
  public static async checkHealth(
    host: string,
    port = this.DEFAULT_PORT,
    timeoutMs = 2500
  ): Promise<HostHealthStatus> {
    const endpoint = this.getHealthEndpoint(host, port);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!response.ok) {
        return {
          reachable: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();
      return {
        reachable: true,
        version: data.version,
        sessionState: data.session_state,
        activePeers: data.active_peers,
      };
    } catch (err: any) {
      clearTimeout(timer);
      const isAbort = err.name === 'AbortError';
      const diag = this.getDiagnostics(host);

      let msg = isAbort ? 'Connection timed out.' : err.message || 'Failed to fetch host.';
      if (diag.isMixedContentRisk) {
        msg += ' (Notice: Browser Local Network Access / Mixed Content security might require approving local permissions).';
      }

      return {
        reachable: false,
        error: msg,
      };
    }
  }
}
