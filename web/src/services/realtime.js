/**
 * Realtime updates service (SSE with WebSocket fallback)
 */

import { getToken } from './auth.js';

export class RealtimeClient {
  constructor() {
    this.eventSource = null;
    this.webSocket = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.reconnectTimeoutId = null;
    this.isDisconnecting = false;
  }

  connect() {
    // Don't connect if we're in the process of disconnecting
    if (this.isDisconnecting) {
      return;
    }
    this.connectSSE();
  }

  connectSSE() {
    const token = getToken();
    if (!token) return;

    try {
      const url = `/api/stream?token=${encodeURIComponent(token)}`;
      this.eventSource = new EventSource(url);

      this.eventSource.onopen = () => {
        console.log('SSE connected');
        this.reconnectAttempts = 0;
      };

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleEvent(data);
        } catch (error) {
          console.error('Failed to parse SSE message:', error);
        }
      };

      this.eventSource.onerror = () => {
        console.error('SSE error, falling back to WebSocket');
        this.eventSource.close();
        this.connectWebSocket();
      };
    } catch (error) {
      console.error('SSE connection failed:', error);
      this.connectWebSocket();
    }
  }

  connectWebSocket() {
    const token = getToken();
    if (!token) return;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${window.location.host}/api/ws?token=${encodeURIComponent(token)}`;

      this.webSocket = new WebSocket(url);

      this.webSocket.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
      };

      this.webSocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleEvent(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.webSocket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      this.webSocket.onclose = () => {
        console.log('WebSocket closed');
        this.attemptReconnect();
      };
    } catch (error) {
      console.error('WebSocket connection failed:', error);
      this.attemptReconnect();
    }
  }

  attemptReconnect() {
    // Don't reconnect if we're disconnecting
    if (this.isDisconnecting) {
      return;
    }
    
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    // Store the timeout ID so we can cancel it on disconnect
    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectTimeoutId = null;
      this.connect();
    }, delay);
  }

  handleEvent(data) {
    const { type } = data;
    const handlers = this.listeners.get(type) || [];

    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error('Event handler error:', error);
      }
    });
  }

  on(eventType, handler) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push(handler);
  }

  off(eventType, handler) {
    const handlers = this.listeners.get(eventType) || [];
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
    }
  }

  disconnect() {
    // Set flag to prevent any pending reconnection attempts
    this.isDisconnecting = true;
    
    // Cancel any pending reconnection timeout
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    
    // Reset reconnect attempts
    this.reconnectAttempts = 0;
    
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.webSocket) {
      this.webSocket.close();
      this.webSocket = null;
    }
    this.listeners.clear();
    
    // Reset disconnecting flag after cleanup (allow future connections)
    this.isDisconnecting = false;
  }
}

export const realtimeClient = new RealtimeClient();
