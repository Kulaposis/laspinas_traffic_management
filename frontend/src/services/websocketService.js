import authService from './authService';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 5000;
    this.listeners = new Map();
    this.isConnecting = false;
  }

  connect() {
    if (this.isConnecting || (this.socket && this.socket.readyState === WebSocket.OPEN)) {
      return;
    }

    // Try backend auth first, then Firebase auth
    const backendUser = authService.getCurrentUser();
    const backendToken = authService.getToken();

    if (backendUser && backendToken) {
      // Backend authentication - use existing logic
      this.connectWithBackendAuth(backendUser);
    } else {
      // Try Firebase authentication
      this.connectWithFirebaseAuth();
    }
  }

  connectWithBackendAuth(user) {
    // Ensure we pass a numeric user id expected by the backend WS route
    const numericUserId = Number(user.id);
    if (!Number.isInteger(numericUserId)) {
      console.warn('Cannot connect to WebSocket: User id is not numeric');
      return;
    }

    this.isConnecting = true;
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

    try {
      this.socket = new WebSocket(`${wsUrl}/ws/${numericUserId}`);

      this.setupSocketHandlers();
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      this.isConnecting = false;
    }
  }

  connectWithFirebaseAuth() {
    // For Firebase users, we'll use a general connection without user-specific routing
    // The backend should handle this case differently or we can skip WebSocket for Firebase users
    console.log('Firebase user detected - WebSocket connection not available for Firebase-only sessions');
    return;
  }

  setupSocketHandlers() {
    this.socket.onopen = () => {
      console.log('WebSocket connected');
      this.isConnecting = false;
      this.reconnectAttempts = 0;

      // Send ping to keep connection alive
      this.sendPing();
      this.pingInterval = setInterval(() => {
        this.sendPing();
      }, 30000); // Ping every 30 seconds
    };

    this.socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.socket.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code, event.reason);
      this.isConnecting = false;

      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }

      // Attempt to reconnect
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        setTimeout(() => {
          this.connect();
        }, this.reconnectInterval);
      } else {
        console.error('Max reconnection attempts reached');
      }
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.isConnecting = false;
    };
  }

  disconnect() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnection
  }

  sendPing() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'ping' }));
    }
  }

  sendLocationUpdate(latitude, longitude) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        type: 'location_update',
        data: { latitude, longitude, timestamp: new Date().toISOString() }
      }));
    }
  }

  handleMessage(message) {
    const { type, data } = message;
    
    switch (type) {
      case 'pong':
        // Response to ping, connection is alive
        break;
      
      case 'notification':
        this.emit('notification', data);
        break;
      
      case 'traffic_alert':
        this.emit('traffic_alert', data);
        break;
      
      case 'report_update':
        this.emit('report_update', data);
        break;
      
      case 'traffic_heatmap_update':
        this.emit('traffic_heatmap_update', data);
        break;

      case 'footprint_update':
        this.emit('footprint_update', data);
        break;

      case 'weather_update':
        this.emit('weather_update', data);
        break;
      
      default:
        console.log('Unknown message type:', type, data);
    }
  }

  // Event listener management
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in WebSocket event handler for ${event}:`, error);
        }
      });
    }
  }

  isConnected() {
    return this.socket && this.socket.readyState === WebSocket.OPEN;
  }
}

export default new WebSocketService();
