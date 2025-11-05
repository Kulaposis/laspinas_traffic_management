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
      // Map backend user to include emailVerified and normalize role for frontend compatibility
      const mappedUser = {
        ...userResponse.data,
        emailVerified: userResponse.data.email_verified !== undefined ? userResponse.data.email_verified : true,
        email_verified: userResponse.data.email_verified !== undefined ? userResponse.data.email_verified : true,
        // Normalize role to lowercase for frontend (backend returns lowercase from serializer)
        role: userResponse.data.role?.toLowerCase() || userResponse.data.role
      };
      localStorage.setItem('user', JSON.stringify(mappedUser));
      
      return {
        token: access_token,
        user: mappedUser,
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

  async syncFirebaseUser(firebaseData) {
    try {
      // Send Firebase user data to backend to create/update user and get backend token
      const response = await api.post('/auth/firebase-sync', {
        uid: firebaseData.uid,
        email: firebaseData.email,
        full_name: firebaseData.displayName || firebaseData.email?.split('@')[0] || 'User',
        photo_url: firebaseData.photoURL,
        email_verified: firebaseData.emailVerified,
        firebase_token: firebaseData.idToken
      });

      // Store backend token and user data
      if (response.data.access_token) {
        localStorage.setItem('access_token', response.data.access_token);
      }
      
      if (response.data.user) {
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }

      return {
        user: response.data.user,
        token: response.data.access_token
      };
    } catch (error) {
      
      // Don't throw - allow fallback to Firebase-only auth
      return null;
    }
  }

  async logout() {
    try {
      // Call logout endpoint to log the activity
      await api.post('/auth/logout');
    } catch (error) {
      
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
    // Normalize both to lowercase for comparison
    const userRole = user?.role?.toLowerCase();
    const checkRole = role?.toLowerCase();
    return userRole === checkRole;
  }

  canCreateViolations() {
    const user = this.getCurrentUser();
    const userRole = user?.role?.toLowerCase();
    return ['traffic_enforcer', 'admin'].includes(userRole);
  }

  canManageUsers() {
    const user = this.getCurrentUser();
    const userRole = user?.role?.toLowerCase();
    return ['admin', 'lgu_staff'].includes(userRole);
  }

  isAdmin() {
    const user = this.getCurrentUser();
    const userRole = user?.role?.toLowerCase();
    return userRole === 'admin';
  }
}

export default new AuthService();
