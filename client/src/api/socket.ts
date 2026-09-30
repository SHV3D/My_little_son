import { WsClientMessage, WsServerEvent } from '@shared/wsTypes';

export interface SocketConnectOptions {
  familyId?: string;
  role?: string;
  userId?: string;
  token?: string;
  url?: string;
}

export class FamilySocket {
  private ws: WebSocket | null = null;
  private connected: boolean = false;
  private familyId: string | null = null;
  private role: string | null = null;
  private userId: string | null = null;
  private token: string | null = null;
  private customUrl: string | null = null;
  private onlineRoles: string[] = [];

  private reconnectAttempts: number = 0;
  private reconnectTimer: any = null;
  private pingTimer: any = null;
  private isExplicitlyClosed: boolean = false;

  private messageListeners = new Set<(event: WsServerEvent) => void>();
  private statusListeners = new Set<(connected: boolean) => void>();
  private presenceListeners = new Set<(roles: string[]) => void>();

  constructor(options?: SocketConnectOptions) {
    if (options) {
      this.familyId = options.familyId || null;
      this.role = options.role || null;
      this.userId = options.userId || null;
      this.token = options.token || null;
      this.customUrl = options.url || null;
    }
  }

  private getDefaultWsUrl(): string {
    if (this.customUrl) {
      return this.customUrl;
    }
    if (typeof window !== 'undefined' && window.location) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${window.location.host}/ws`;
    }
    return 'ws://localhost:3001/ws';
  }

  public connect(options?: SocketConnectOptions): void {
    if (options) {
      if (options.familyId !== undefined) this.familyId = options.familyId;
      if (options.role !== undefined) this.role = options.role;
      if (options.userId !== undefined) this.userId = options.userId;
      if (options.token !== undefined) this.token = options.token;
      if (options.url !== undefined) this.customUrl = options.url;
    }

    this.isExplicitlyClosed = false;

    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      // If already connected and familyId is set, ensure joined
      if (this.ws.readyState === WebSocket.OPEN && this.familyId) {
        this.sendJoinMessage();
      }
      return;
    }

    this.clearTimers();

    let wsUrl = this.getDefaultWsUrl();
    const queryParams: string[] = [];
    if (this.token) {
      queryParams.push(`token=${encodeURIComponent(this.token)}`);
    } else if (this.familyId) {
      queryParams.push(`familyId=${encodeURIComponent(this.familyId)}`);
      if (this.role) queryParams.push(`role=${encodeURIComponent(this.role)}`);
      if (this.userId) queryParams.push(`userId=${encodeURIComponent(this.userId)}`);
    }
    if (queryParams.length > 0) {
      const sep = wsUrl.includes('?') ? '&' : '?';
      wsUrl += `${sep}${queryParams.join('&')}`;
    }

    try {
      this.ws = new WebSocket(wsUrl);
    } catch (err) {
      this.handleDisconnect();
      return;
    }

    this.ws.onopen = () => {
      this.connected = true;
      this.reconnectAttempts = 0;
      this.notifyStatusListeners(true);

      if (this.familyId) {
        this.sendJoinMessage();
      }

      this.startHeartbeat();
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as WsServerEvent;
        this.handleIncomingMessage(data);
      } catch {
        // Non-JSON message ignored
      }
    };

    this.ws.onclose = () => {
      this.handleDisconnect();
    };

    this.ws.onerror = () => {
      this.handleDisconnect();
    };
  }

  public joinFamily(familyId: string, role?: string, userId?: string, token?: string): void {
    this.familyId = familyId;
    if (role !== undefined) this.role = role;
    if (userId !== undefined) this.userId = userId;
    if (token !== undefined) this.token = token;

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendJoinMessage();
    } else {
      this.connect();
    }
  }

  private sendJoinMessage(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.familyId) return;

    const msg: WsClientMessage = {
      type: 'JOIN_FAMILY',
      familyId: this.familyId,
      role: this.role || undefined,
      userId: this.userId || undefined,
      token: this.token || undefined,
    };
    try {
      this.ws.send(JSON.stringify(msg));
    } catch (err) {
      console.error('Failed to send JOIN_FAMILY:', err);
    }
  }

  private handleIncomingMessage(data: WsServerEvent): void {
    if (data.type === 'FAMILY_PRESENCE') {
      const roles = data.onlineRoles || data.payload?.onlineRoles || [];
      this.onlineRoles = roles;
      this.notifyPresenceListeners(roles);
    } else if (data.type === 'JOINED_FAMILY') {
      if (data.onlineRoles) {
        this.onlineRoles = data.onlineRoles;
        this.notifyPresenceListeners(data.onlineRoles);
      }
    }

    this.notifyMessageListeners(data);
  }

  private handleDisconnect(): void {
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      this.ws.onmessage = null;
      this.ws = null;
    }

    this.onlineRoles = [];
    this.notifyPresenceListeners([]);

    const wasConnected = this.connected;
    this.connected = false;
    this.clearTimers();

    if (wasConnected) {
      this.notifyStatusListeners(false);
    }

    if (this.isExplicitlyClosed) return;

    // Exponential backoff: 1s, 1.5s, 2.25s, ... max 15s
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 15000);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      if (!this.isExplicitlyClosed) {
        this.connect();
      }
    }, delay);
  }

  private startHeartbeat(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
    }
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'PING' }));
        } catch {}
      }
    }, 25000);
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  public disconnect(): void {
    this.isExplicitlyClosed = true;
    this.clearTimers();
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      this.ws.onmessage = null;
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.connected = false;
    this.onlineRoles = [];
    this.notifyPresenceListeners([]);
    this.notifyStatusListeners(false);
  }

  public send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const payload = typeof message === 'string' ? message : JSON.stringify(message);
      this.ws.send(payload);
    }
  }

  public onMessage(callback: (event: WsServerEvent) => void): () => void {
    this.messageListeners.add(callback);
    return () => {
      this.messageListeners.delete(callback);
    };
  }

  public onStatusChange(callback: (connected: boolean) => void): () => void {
    this.statusListeners.add(callback);
    callback(this.connected);
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  public onPresenceChange(callback: (roles: string[]) => void): () => void {
    this.presenceListeners.add(callback);
    callback(this.onlineRoles);
    return () => {
      this.presenceListeners.delete(callback);
    };
  }

  private notifyMessageListeners(event: WsServerEvent): void {
    for (const listener of this.messageListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in WS message listener:', err);
      }
    }
  }

  private notifyStatusListeners(status: boolean): void {
    for (const listener of this.statusListeners) {
      try {
        listener(status);
      } catch (err) {
        console.error('Error in WS status listener:', err);
      }
    }
  }

  private notifyPresenceListeners(roles: string[]): void {
    for (const listener of this.presenceListeners) {
      try {
        listener(roles);
      } catch (err) {
        console.error('Error in WS presence listener:', err);
      }
    }
  }

  public getIsConnected(): boolean {
    return this.connected;
  }

  public getOnlineRoles(): string[] {
    return this.onlineRoles;
  }
}

export const familySocket = new FamilySocket();
