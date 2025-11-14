import api from './api';

class NotificationService {
  async getNotifications(params = {}) {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        // In Google-only sessions, notifications require backend auth; return empty quietly
        return [];
      }
      const { skip = 0, limit = 50, unread_only = false } = params;
      const queryParams = new URLSearchParams({
        skip: skip.toString(),
        limit: limit.toString(),
        unread_only: unread_only.toString(),
      });

      const response = await api.get(`/notifications/?${queryParams}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch notifications');
    }
  }

  async getUnreadCount() {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        // No backend token: treat as zero and avoid network noise
        return 0;
      }
      const response = await api.get('/notifications/unread-count');
      return response.data.unread_count;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch unread count');
    }
  }

  async markAsRead(notificationId) {
    try {
      const response = await api.put(`/notifications/${notificationId}/read`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to mark notification as read');
    }
  }

  async markAllAsRead() {
    try {
      const response = await api.put('/notifications/mark-all-read');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to mark all notifications as read');
    }
  }

  async createNotification(notificationData) {
    try {
      const response = await api.post('/notifications/', notificationData);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to create notification');
    }
  }

  async createBroadcastNotification(notificationData) {
    try {
      const response = await api.post('/notifications/broadcast', notificationData);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to create broadcast notification');
    }
  }

  getNotificationTypeColor(type) {
    const key = (type || '').toString().toLowerCase();
    const colors = {
      traffic_alert: '#f59e0b',          // amber
      violation_update: '#3b82f6',       // blue
      report_update: '#10b981',          // emerald
      system_announcement: '#8b5cf6',    // violet
      weather_alert: '#06b6d4',          // cyan
      emergency: '#ef4444',              // red
    };
    return colors[key] || colors.system_announcement;
  }

  getNotificationPriorityColor(priority) {
    const key = (priority || '').toString().toLowerCase();
    const colors = {
      low: '#6b7280',           // gray
      medium: '#3b82f6',        // blue
      high: '#f59e0b',          // amber
      urgent: '#ef4444',        // red
    };
    return colors[key] || colors.medium;
  }

  getNotificationTypeIcon(type) {
    const key = (type || '').toString().toLowerCase();
    const icons = {
      traffic_alert: '🚦',
      violation_update: '🚔',
      report_update: '📋',
      system_announcement: '📢',
      weather_alert: '🌧️',
      emergency: '🚨',
    };
    return icons[key] || '📢';
  }

  formatNotificationTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMilliseconds = now - date;
    const diffInMinutes = Math.floor(diffInMilliseconds / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) {
      return 'Just now';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else if (diffInDays < 7) {
      return `${diffInDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  }
}

export default new NotificationService();
