import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

class UserService {
  constructor() {
    this.api = axios.create({
      baseURL: `${API_URL}/users`,
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

  // Get current user info
  async getCurrentUser() {
    const response = await this.api.get('/me');
    return response.data;
  }

  // Get all users (admin/staff only)
  async getUsers(params = {}) {
    const response = await this.api.get('/', { params });
    return response.data;
  }

  // Get specific user by ID
  async getUser(userId) {
    const response = await this.api.get(`/${userId}`);
    return response.data;
  }

  // Update current user
  async updateCurrentUser(userData) {
    const response = await this.api.put('/me', userData);
    return response.data;
  }

  // Update user by ID (admin only)
  async updateUser(userId, userData) {
    const response = await this.api.put(`/${userId}`, userData);
    return response.data;
  }

  // Create new user (admin only)
  async createUser(userData) {
    const response = await this.api.post('/', userData);
    return response.data;
  }

  // Delete user (admin only)
  async deleteUser(userId) {
    const response = await this.api.delete(`/${userId}`);
    return response.data;
  }

  // Utility methods
  getRoleColor(role) {
    const colors = {
      admin: 'bg-red-100 text-red-800 border-red-200',
      lgu_staff: 'bg-blue-100 text-blue-800 border-blue-200',
      traffic_enforcer: 'bg-green-100 text-green-800 border-green-200',
      citizen: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[role] || colors.citizen;
  }

  getRoleLabel(role) {
    const labels = {
      admin: 'Administrator',
      lgu_staff: 'LGU Staff',
      traffic_enforcer: 'Traffic Enforcer',
      citizen: 'Citizen'
    };
    return labels[role] || 'Unknown';
  }

  getStatusColor(isActive) {
    return isActive 
      ? 'bg-green-100 text-green-800 border-green-200'
      : 'bg-red-100 text-red-800 border-red-200';
  }

  formatDate(dateString) {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  }

  formatDateTime(dateString) {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  }

  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  validateUsername(username) {
    // Username should be 3-20 characters, alphanumeric and underscores only
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    return usernameRegex.test(username);
  }

  validatePhoneNumber(phone) {
    if (!phone) return true; // Phone is optional
    // Basic phone validation (adjust based on your requirements)
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  }
}

export default new UserService();
