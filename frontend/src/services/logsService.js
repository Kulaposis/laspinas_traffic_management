import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    throw error;
  }
);

const logsService = {
  // Activity Logs
  async getActivityLogs(params = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.startDate) queryParams.append('start_date', params.startDate);
      if (params.endDate) queryParams.append('end_date', params.endDate);
      if (params.userId) queryParams.append('user_id', params.userId);
      if (params.activityType) queryParams.append('activity_type', params.activityType);
      if (params.resourceType) queryParams.append('resource_type', params.resourceType);
      if (params.isSuccessful !== undefined) queryParams.append('is_successful', params.isSuccessful);
      if (params.searchQuery) queryParams.append('search_query', params.searchQuery);
      if (params.limit) queryParams.append('limit', params.limit);
      if (params.offset) queryParams.append('offset', params.offset);
      if (params.format) queryParams.append('format', params.format);

      const response = await api.get(`/logs/activity?${queryParams.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      throw error;
    }
  },

  // System Logs
  async getSystemLogs(params = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.startDate) queryParams.append('start_date', params.startDate);
      if (params.endDate) queryParams.append('end_date', params.endDate);
      if (params.logLevel) queryParams.append('log_level', params.logLevel);
      if (params.serviceName) queryParams.append('service_name', params.serviceName);
      if (params.searchQuery) queryParams.append('search_query', params.searchQuery);
      if (params.limit) queryParams.append('limit', params.limit);
      if (params.offset) queryParams.append('offset', params.offset);

      const response = await api.get(`/logs/system?${queryParams.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching system logs:', error);
      throw error;
    }
  },

  // Audit Logs
  async getAuditLogs(params = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.startDate) queryParams.append('start_date', params.startDate);
      if (params.endDate) queryParams.append('end_date', params.endDate);
      if (params.userId) queryParams.append('user_id', params.userId);
      if (params.action) queryParams.append('action', params.action);
      if (params.tableName) queryParams.append('table_name', params.tableName);
      if (params.searchQuery) queryParams.append('search_query', params.searchQuery);
      if (params.limit) queryParams.append('limit', params.limit);
      if (params.offset) queryParams.append('offset', params.offset);

      const response = await api.get(`/logs/audit?${queryParams.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      throw error;
    }
  },

  // Statistics
  async getLogsStatistics(params = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.startDate) queryParams.append('start_date', params.startDate);
      if (params.endDate) queryParams.append('end_date', params.endDate);

      const response = await api.get(`/logs/statistics?${queryParams.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching logs statistics:', error);
      throw error;
    }
  },

  // User Activity Summary
  async getUserActivitySummary(userId, params = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.startDate) queryParams.append('start_date', params.startDate);
      if (params.endDate) queryParams.append('end_date', params.endDate);

      const response = await api.get(`/logs/users/${userId}/summary?${queryParams.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching user activity summary:', error);
      throw error;
    }
  },

  // Create Activity Log
  async createActivityLog(logData) {
    try {
      const response = await api.post('/logs/activity', logData);
      return response.data;
    } catch (error) {
      console.error('Error creating activity log:', error);
      throw error;
    }
  },

  // Create System Log
  async createSystemLog(logData) {
    try {
      const response = await api.post('/logs/system', logData);
      return response.data;
    } catch (error) {
      console.error('Error creating system log:', error);
      throw error;
    }
  },

  // Create Audit Log
  async createAuditLog(logData) {
    try {
      const response = await api.post('/logs/audit', logData);
      return response.data;
    } catch (error) {
      console.error('Error creating audit log:', error);
      throw error;
    }
  },

  // Helper functions for activity tracking
  async logActivity(activityType, description, extraData = {}) {
    try {
      const logData = {
        activity_type: activityType,
        activity_description: description,
        extra_data: extraData,
        ip_address: await this.getClientIP(),
        user_agent: navigator.userAgent,
      };

      return await this.createActivityLog(logData);
    } catch (error) {
      console.error('Error logging activity:', error);
      // Don't throw error to prevent breaking the main functionality
    }
  },

  async getClientIP() {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      // Silently fail for IP detection - this is common in some environments
      // and shouldn't break the main functionality
      return null;
    }
  },

  // Activity type constants
  ActivityTypes: {
    // Authentication
    LOGIN: 'login',
    LOGOUT: 'logout',
    FAILED_LOGIN: 'failed_login',
    PASSWORD_CHANGE: 'password_change',
    
    // Emergency
    EMERGENCY_CREATED: 'emergency_created',
    EMERGENCY_UPDATED: 'emergency_updated',
    EMERGENCY_RESOLVED: 'emergency_resolved',
    COMPLAINT_CREATED: 'complaint_created',
    COMPLAINT_UPDATED: 'complaint_updated',
    
    // Traffic
    TRAFFIC_REPORT_CREATED: 'traffic_report_created',
    TRAFFIC_REPORT_UPDATED: 'traffic_report_updated',
    VIOLATION_REPORTED: 'violation_reported',
    VIOLATION_UPDATED: 'violation_updated',
    
    // Parking
    PARKING_SPOT_CREATED: 'parking_spot_created',
    PARKING_SPOT_UPDATED: 'parking_spot_updated',
    PARKING_VIOLATION_REPORTED: 'parking_violation_reported',
    
    // Reports
    REPORT_CREATED: 'report_created',
    REPORT_UPDATED: 'report_updated',
    REPORT_VERIFIED: 'report_verified',
    REPORT_REJECTED: 'report_rejected',
    
    // Notifications
    NOTIFICATION_SENT: 'notification_sent',
    NOTIFICATION_READ: 'notification_read',
    
    // Weather
    WEATHER_ALERT_CREATED: 'weather_alert_created',
    WEATHER_DATA_UPDATED: 'weather_data_updated',
    
    // System
    DATA_EXPORT: 'data_export',
    SETTINGS_CHANGED: 'settings_changed',
    USER_ROLE_CHANGED: 'user_role_changed',
    
    // Files
    FILE_UPLOADED: 'file_uploaded',
    FILE_DOWNLOADED: 'file_downloaded',
    
    // API
    API_ACCESS: 'api_access',
    BULK_OPERATION: 'bulk_operation'
  },

  // Format helpers
  formatActivityType(activityType) {
    return activityType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  },

  formatDateTime(dateString) {
    return new Date(dateString).toLocaleString();
  },

  getActivityIcon(activityType) {
    const iconMap = {
      login: '🔐',
      logout: '🚪',
      failed_login: '❌',
      password_change: '🔑',
      emergency_created: '🚨',
      emergency_updated: '📝',
      emergency_resolved: '✅',
      complaint_created: '📢',
      complaint_updated: '📝',
      traffic_report_created: '🚦',
      traffic_report_updated: '📝',
      violation_reported: '⚠️',
      violation_updated: '📝',
      parking_spot_created: '🅿️',
      parking_spot_updated: '📝',
      parking_violation_reported: '🚫',
      report_created: '📋',
      report_updated: '📝',
      report_verified: '✅',
      report_rejected: '❌',
      notification_sent: '📢',
      notification_read: '👁️',
      weather_alert_created: '🌦️',
      weather_data_updated: '📊',
      data_export: '📤',
      settings_changed: '⚙️',
      user_role_changed: '👤',
      file_uploaded: '📁',
      file_downloaded: '📥',
      api_access: '🔌',
      bulk_operation: '📦'
    };
    
    return iconMap[activityType] || '📝';
  },

  getActivityColor(activityType) {
    const colorMap = {
      login: 'text-green-600',
      logout: 'text-blue-600',
      failed_login: 'text-red-600',
      password_change: 'text-yellow-600',
      emergency_created: 'text-red-600',
      emergency_updated: 'text-yellow-600',
      emergency_resolved: 'text-green-600',
      complaint_created: 'text-orange-600',
      complaint_updated: 'text-yellow-600',
      traffic_report_created: 'text-blue-600',
      traffic_report_updated: 'text-yellow-600',
      violation_reported: 'text-red-600',
      violation_updated: 'text-yellow-600',
      parking_spot_created: 'text-green-600',
      parking_spot_updated: 'text-yellow-600',
      parking_violation_reported: 'text-red-600',
      report_created: 'text-blue-600',
      report_updated: 'text-yellow-600',
      report_verified: 'text-green-600',
      report_rejected: 'text-red-600',
      notification_sent: 'text-purple-600',
      notification_read: 'text-gray-600',
      weather_alert_created: 'text-orange-600',
      weather_data_updated: 'text-blue-600',
      data_export: 'text-indigo-600',
      settings_changed: 'text-gray-600',
      user_role_changed: 'text-purple-600',
      file_uploaded: 'text-green-600',
      file_downloaded: 'text-blue-600',
      api_access: 'text-gray-600',
      bulk_operation: 'text-indigo-600'
    };
    
    return colorMap[activityType] || 'text-gray-600';
  },

  // Export Activity Logs
  async exportActivityLogs(params = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.startDate) queryParams.append('start_date', params.startDate);
      if (params.endDate) queryParams.append('end_date', params.endDate);
      if (params.userId) queryParams.append('user_id', params.userId);
      if (params.activityType) queryParams.append('activity_type', params.activityType);
      if (params.resourceType) queryParams.append('resource_type', params.resourceType);
      if (params.isSuccessful !== undefined) queryParams.append('is_successful', params.isSuccessful);
      if (params.searchQuery) queryParams.append('search_query', params.searchQuery);

      const response = await api.get(`/logs/activity/export?${queryParams.toString()}`, {
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('Error exporting activity logs:', error);
      throw error;
    }
  }
};

export default logsService;
