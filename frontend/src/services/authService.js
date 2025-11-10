import api from './api';

class AuthService {
  /**
   * Backend/Database login (for admin and database users)
   * This is the direct login to Supabase database
   */
  async login(username, password) {
    try {
      // Use URLSearchParams for proper form-urlencoded format required by OAuth2PasswordRequestForm
      const params = new URLSearchParams();
      params.append('username', username);
      params.append('password', password);

      const response = await api.post('/auth/login', params.toString(), {
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
        success: true,
        token: access_token,
        user: mappedUser,
        authMethod: 'backend'
      };
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Login failed');
    }
  }

  /**
   * Hybrid login - tries Firebase first, then falls back to backend/database
   * This allows both Firebase users and database users (like admin) to login
   */
  async hybridLogin(email, password, firebaseLoginFn) {
    console.log('🔐 Starting hybrid authentication for:', email);
    
    // Step 1: Try Firebase authentication first
    try {
      console.log('🔥 Attempting Firebase authentication...');
      const firebaseResult = await firebaseLoginFn(email, password);
      
      if (firebaseResult && firebaseResult.success) {
        console.log('✅ Firebase authentication successful');
        return {
          success: true,
          user: firebaseResult.user,
          authMethod: 'firebase',
          message: 'Logged in with Firebase'
        };
      }
    } catch (firebaseError) {
      console.log('⚠️ Firebase authentication failed:', firebaseError.message);
      // Continue to backend fallback
    }

    // Step 2: If Firebase fails, try backend/database authentication
    try {
      console.log('🗄️ Attempting backend/database authentication...');
      const backendResult = await this.login(email, password);
      
      if (backendResult && backendResult.success) {
        console.log('✅ Backend authentication successful');
        return {
          success: true,
          user: backendResult.user,
          token: backendResult.token,
          authMethod: 'backend',
          message: 'Logged in with database credentials'
        };
      }
    } catch (backendError) {
      console.log('❌ Backend authentication failed:', backendError.message);
      // Both methods failed
      throw new Error('Invalid email or password. Please check your credentials and try again.');
    }

    // If we reach here, both methods failed
    throw new Error('Authentication failed. Please check your credentials.');
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
