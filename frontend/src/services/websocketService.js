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

      return;
    }

    this.isConnecting = true;
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

    try {
      this.socket = new WebSocket(`${wsUrl}/ws/${numericUserId}`);

      this.setupSocketHandlers();
    } catch (error) {

      this.isConnecting = false;
    }
  }

  connectWithFirebaseAuth() {
    // For Firebase users, we'll use a general connection without user-specific routing
    // The backend should handle this case differently or we can skip WebSocket for Firebase users

    return;
  }

  setupSocketHandlers() {
    this.socket.onopen = () => {

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

      }
    };

    this.socket.onclose = (event) => {

      this.isConnecting = false;

      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }

      // Attempt to reconnect
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;

        setTimeout(() => {
          this.connect();
        }, this.reconnectInterval);
      } else {

      }
    };

    this.socket.onerror = (error) => {

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

        }
      });
    }
  }

  isConnected() {
    return this.socket && this.socket.readyState === WebSocket.OPEN;
  }
}

export default new WebSocketService();
