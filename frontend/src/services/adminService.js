import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

class AdminService {
  constructor() {
    this.api = axios.create({
      baseURL: `${API_URL}/admin`,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add auth token to requests
    this.api.interceptors.request.use((config) => {
      const token = localStorage.getItem('access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  // Dashboard and Analytics
  async getDashboardData() {
    const response = await this.api.get('/dashboard');
    return response.data;
  }

  async getSystemAnalytics() {
    const response = await this.api.get('/analytics/system');
    return response.data;
  }

  async getSystemHealth() {
    const response = await this.api.get('/health');
    return response.data;
  }

  // System Settings
  async getSystemSettings(category = null) {
    const params = category ? { category } : {};
    const response = await this.api.get('/settings', { params });
    return response.data;
  }

  async getSystemSetting(key) {
    const response = await this.api.get(`/settings/${key}`);
    return response.data;
  }

  async createSystemSetting(settingData) {
    const response = await this.api.post('/settings', settingData);
    return response.data;
  }

  async updateSystemSetting(key, settingData) {
    const response = await this.api.put(`/settings/${key}`, settingData);
    return response.data;
  }

  async deleteSystemSetting(key) {
    const response = await this.api.delete(`/settings/${key}`);
    return response.data;
  }

  // User Management
  async getUserStats() {
    const response = await this.api.get('/users/stats');
    return response.data;
  }

  async getUserActivitySummary(userId) {
    const response = await this.api.get(`/users/${userId}/activity`);
    return response.data;
  }

  async bulkUserOperation(operationData) {
    const response = await this.api.post('/users/bulk-operation', operationData);
    return response.data;
  }

  // System Alerts
  async getSystemAlerts() {
    const response = await this.api.get('/alerts');
    return response.data;
  }

  async createSystemAlert(alertData) {
    const response = await this.api.post('/alerts', alertData);
    return response.data;
  }

  // Security Events
  async getSecurityEvents(params = {}) {
    const response = await this.api.get('/security/events', { params });
    return response.data;
  }

  async createSecurityEvent(eventData) {
    const response = await this.api.post('/security/events', eventData);
    return response.data;
  }

  async resolveSecurityEvent(eventId) {
    const response = await this.api.put(`/security/events/${eventId}/resolve`);
    return response.data;
  }

  // Data Export
  async createExportJob(exportRequest) {
    const response = await this.api.post('/export', exportRequest);
    return response.data;
  }

  async getExportJobs() {
    const response = await this.api.get('/export/jobs');
    return response.data;
  }

  // Content Moderation
  async getModerationQueue(params = {}) {
    const response = await this.api.get('/moderation', { params });
    return response.data;
  }

  async moderateContent(moderationId, action) {
    const response = await this.api.put(`/moderation/${moderationId}`, action);
    return response.data;
  }

  // Notification Templates
  async getNotificationTemplates(templateType = null) {
    const params = templateType ? { template_type: templateType } : {};
    const response = await this.api.get('/templates', { params });
    return response.data;
  }

  async createNotificationTemplate(templateData) {
    const response = await this.api.post('/templates', templateData);
    return response.data;
  }

  async updateNotificationTemplate(templateId, templateData) {
    const response = await this.api.put(`/templates/${templateId}`, templateData);
    return response.data;
  }

  // Maintenance and Backup
  async createBackup(backupRequest) {
    const response = await this.api.post('/maintenance/backup', backupRequest);
    return response.data;
  }

  async setMaintenanceMode(maintenanceData) {
    const response = await this.api.post('/maintenance/mode', maintenanceData);
    return response.data;
  }

  // Quick Actions
  async clearCache() {
    const response = await this.api.post('/actions/clear-cache');
    return response.data;
  }

  async optimizeDatabase() {
    const response = await this.api.post('/actions/optimize-database');
    return response.data;
  }

  async getSystemInfo() {
    const response = await this.api.get('/actions/system-info');
    return response.data;
  }

  // Utility Methods
  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  formatDuration(minutes) {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  }

  getAlertTypeColor(alertType) {
    const colors = {
      info: 'bg-blue-100 text-blue-800 border-blue-200',
      warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      error: 'bg-red-100 text-red-800 border-red-200',
      maintenance: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[alertType] || colors.info;
  }

  getSeverityColor(severity) {
    const colors = {
      low: 'text-green-600',
      medium: 'text-yellow-600',
      high: 'text-orange-600',
      critical: 'text-red-600'
    };
    return colors[severity] || colors.low;
  }

  getStatusColor(status) {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  }
}

export default new AdminService();
