import api from './api';

class AuthService {
  async login(username, password) {
    try {
      const formData = new FormData();
      formData.append('username', username);
      formData.append('password', password);

      const response = await api.post('/auth/login', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const { access_token, token_type } = response.data;
      
      // Store token
      localStorage.setItem('access_token', access_token);
      
      // Get user info
      const userResponse = await api.get('/users/me');
      localStorage.setItem('user', JSON.stringify(userResponse.data));
      
      return {
        token: access_token,
        user: userResponse.data,
      };
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Login failed');
    }
  }

  async register(userData) {
    try {
      const response = await api.post('/auth/register', userData);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Registration failed');
    }
  }

  async logout() {
    try {
      // Call logout endpoint to log the activity
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Error calling logout endpoint:', error);
    }
    
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  }

  getCurrentUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }

  getToken() {
    return localStorage.getItem('access_token');
  }

  isAuthenticated() {
    return !!this.getToken();
  }

  hasRole(role) {
    const user = this.getCurrentUser();
    return user?.role === role;
  }

  canCreateViolations() {
    const user = this.getCurrentUser();
    return ['traffic_enforcer', 'admin'].includes(user?.role);
  }

  canManageUsers() {
    const user = this.getCurrentUser();
    return ['admin', 'lgu_staff'].includes(user?.role);
  }

  isAdmin() {
    return this.hasRole('admin');
  }
}

export default new AuthService();
