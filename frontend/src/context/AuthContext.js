import React, { createContext, useContext, useState, useEffect } from 'react';
import authService from '../services/authService';
import logsService from '../services/logsService';
import sessionService from '../services/sessionService';
import cacheService from '../services/cacheService';
import {
  signInWithGoogle,
  signInWithEmailPassword,
  registerWithEmailPassword,
  signOutUser,
  sendVerificationEmail,
  sendPasswordReset,
  onAuthStateChange,
  getCurrentUser as getFirebaseCurrentUser
} from '../firebase';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMethod, setAuthMethod] = useState(null); // 'firebase' or 'backend'

  // Initialize session management with auto-logout
  useEffect(() => {
    const handleAutoLogout = (reason) => {
      console.log(`🚪 Auto-logout triggered: ${reason}`);
      logout();
    };

    sessionService.init(handleAutoLogout);

    return () => {
      sessionService.destroy();
    };
  }, []);

  useEffect(() => {
    // Debounce auth state changes to prevent rapid firing
    let authTimeout = null;

    // Listen to Firebase auth state changes
    const unsubscribe = onAuthStateChange(async (firebaseUser) => {
      // Clear any existing timeout
      if (authTimeout) {
        clearTimeout(authTimeout);
      }

      // Set a new timeout to debounce rapid auth state changes
      authTimeout = setTimeout(async () => {
        if (firebaseUser) {
          try {
            // Wait for Firebase to fully load user data
            await firebaseUser.reload();

            // Get Firebase ID token to authenticate with backend
            const idToken = await firebaseUser.getIdToken();

            // Sync Firebase user with backend database
            try {
              const syncResponse = await authService.syncFirebaseUser({
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName,
                photoURL: firebaseUser.photoURL,
                emailVerified: firebaseUser.emailVerified,
                idToken: idToken
              });

              // Use backend user data if sync successful
              if (syncResponse && syncResponse.user) {
                // Map backend user data to match frontend format (snake_case to camelCase)
                const mappedBackendUser = {
                  ...syncResponse.user,
                  emailVerified: syncResponse.user.email_verified !== undefined 
                    ? syncResponse.user.email_verified 
                    : firebaseUser.emailVerified, // Fallback to Firebase value
                  photoURL: syncResponse.user.photo_url,
                  displayName: syncResponse.user.full_name
                };
                
                setUser(mappedBackendUser);
                setAuthMethod('firebase');
                localStorage.setItem('user', JSON.stringify(mappedBackendUser));
                
                // Store backend token for API calls (consistent with api.js)
                if (syncResponse.token) {
                  localStorage.setItem('access_token', syncResponse.token);
                }
              } else {
                // Fallback to Firebase user data
                const mappedUser = {
                  id: firebaseUser.uid,
                  uid: firebaseUser.uid,
                  full_name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
                  displayName: firebaseUser.displayName,
                  email: firebaseUser.email,
                  photoURL: firebaseUser.photoURL,
                  emailVerified: firebaseUser.emailVerified || false,
                  role: 'citizen',
                };

                setUser(mappedUser);
                setAuthMethod('firebase');
                localStorage.setItem('user', JSON.stringify(mappedUser));
              }
            } catch (syncError) {
              console.error('Error syncing Firebase user with backend:', syncError);
              
              // Fallback: Use Firebase user data without backend sync
              const mappedUser = {
                id: firebaseUser.uid,
                uid: firebaseUser.uid,
                full_name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
                displayName: firebaseUser.displayName,
                email: firebaseUser.email,
                photoURL: firebaseUser.photoURL,
                emailVerified: firebaseUser.emailVerified || false,
                role: 'citizen',
              };

              setUser(mappedUser);
              setAuthMethod('firebase');
              localStorage.setItem('user', JSON.stringify(mappedUser));
            }
          } catch (error) {
            console.error('Error processing Firebase user:', error);
          }
        } else {
          // User is signed out from Firebase, also check backend auth
          const backendUser = authService.getCurrentUser();
          const backendToken = authService.getToken();

          if (backendUser && backendToken) {
            // Map backend user to include emailVerified and normalize role
            const mappedBackendUser = {
              ...backendUser,
              emailVerified: backendUser.email_verified !== undefined ? backendUser.email_verified : true,
              email_verified: backendUser.email_verified !== undefined ? backendUser.email_verified : true,
              // Normalize role to lowercase for frontend compatibility
              role: backendUser.role?.toLowerCase() || backendUser.role
            };
            setUser(mappedBackendUser);
            setAuthMethod('backend');
            // Update localStorage with mapped user
            localStorage.setItem('user', JSON.stringify(mappedBackendUser));
          } else {
            setUser(null);
            setAuthMethod(null);
            localStorage.removeItem('user');
          }
        }

        setLoading(false);
      }, 100); // 100ms debounce
    });

    // Cleanup subscription on unmount
    return () => {
      if (authTimeout) {
        clearTimeout(authTimeout);
      }
      unsubscribe();
    };
  }, []);

  const login = async (username, password) => {
    try {
      const result = await authService.login(username, password);
      // Map backend user to include emailVerified and normalize role (backend users don't need email verification)
      const mappedUser = {
        ...result.user,
        emailVerified: result.user.email_verified !== undefined ? result.user.email_verified : true, // Default to true for backend users
        email_verified: result.user.email_verified !== undefined ? result.user.email_verified : true,
        // Normalize role to lowercase for frontend compatibility
        role: result.user.role?.toLowerCase() || result.user.role
      };
      setUser(mappedUser);
      setAuthMethod('backend');
      // Store mapped user in localStorage
      localStorage.setItem('user', JSON.stringify(mappedUser));

      // Log successful login activity
      try {
        await logsService.logActivity(
          logsService.ActivityTypes.LOGIN,
          `User ${username} logged in successfully`,
          { login_time: new Date().toISOString() }
        );
      } catch (logError) {
        console.error('Failed to log login activity:', logError);
      }

      return result;
    } catch (error) {
      // Log failed login attempt
      try {
        await logsService.logActivity(
          logsService.ActivityTypes.FAILED_LOGIN,
          `Failed login attempt for user ${username}`,
          {
            attempted_username: username,
            error_message: error.message || 'Login failed'
          }
        );
      } catch (logError) {
        console.error('Failed to log failed login activity:', logError);
      }

      throw error;
    }
  };

  const firebaseLogin = async (email, password) => {
    try {
      const result = await signInWithEmailPassword(email, password);
      if (result && result.success) {
        setUser(result.user);
        setAuthMethod('firebase');
        return result;
      } else {
        // Return failure result instead of throwing to allow backend fallback
        // Don't log credential errors as they're expected for backend-only accounts
        const isCredentialError = result?.error?.includes('INVALID_LOGIN_CREDENTIALS') ||
                                 result?.error?.includes('Invalid login credentials') ||
                                 result?.error?.includes('user-not-found') ||
                                 result?.error?.includes('wrong-password');
        if (!isCredentialError) {
          console.warn('Firebase authentication failed:', result?.error);
        }
        return { success: false, error: result?.error || 'Firebase authentication failed' };
      }
    } catch (error) {
      // Catch any unexpected errors (network errors, etc.) and return failure
      // Don't log credential errors as they're expected for backend-only accounts
      const isCredentialError = error?.message?.includes('INVALID_LOGIN_CREDENTIALS') ||
                               error?.code === 'auth/invalid-credential' ||
                               error?.code === 'auth/invalid-login-credentials' ||
                               error?.code === 'auth/user-not-found' ||
                               error?.code === 'auth/wrong-password';
      if (!isCredentialError) {
        console.warn('Firebase authentication error:', error.message || error);
      }
      // Return failure result instead of throwing to allow backend fallback
      return { success: false, error: error.message || 'Firebase authentication failed' };
    }
  };

  /**
   * Hybrid login - tries Firebase first, then falls back to backend/database
   * This allows both Firebase users (Google Sign-In, email/password) and 
   * database users (admin accounts) to login with the same interface
   */
  const hybridLogin = async (email, password) => {
    try {
      // Use the authService hybridLogin method which handles the fallback logic
      const result = await authService.hybridLogin(email, password, firebaseLogin);
      
      if (result && result.success) {
        // Map user data based on auth method
        const mappedUser = {
          ...result.user,
          emailVerified: result.user.emailVerified || result.user.email_verified || (result.authMethod === 'backend'),
          email_verified: result.user.email_verified || result.user.emailVerified || (result.authMethod === 'backend'),
          role: result.user.role?.toLowerCase() || result.user.role
        };
        
        setUser(mappedUser);
        setAuthMethod(result.authMethod);
        localStorage.setItem('user', JSON.stringify(mappedUser));
        
        // Log successful login
        try {
          await logsService.logActivity(
            logsService.ActivityTypes.LOGIN,
            `User ${email} logged in successfully via ${result.authMethod}`,
            { 
              login_time: new Date().toISOString(),
              auth_method: result.authMethod 
            }
          );
        } catch (logError) {
          console.error('Failed to log login activity:', logError);
        }

        return {
          success: true,
          user: mappedUser,
          authMethod: result.authMethod,
          message: result.message
        };
      }
      
      return { success: false, error: 'Authentication failed' };
    } catch (error) {
      // Log failed login attempt
      try {
        await logsService.logActivity(
          logsService.ActivityTypes.FAILED_LOGIN,
          `Failed login attempt for user ${email}`,
          {
            attempted_email: email,
            error_message: error.message || 'Login failed'
          }
        );
      } catch (logError) {
        console.error('Failed to log failed login activity:', logError);
      }

      throw error;
    }
  };

  const register = async (userData) => {
    try {
      const result = await authService.register(userData);
      return result;
    } catch (error) {
      throw error;
    }
  };

  const firebaseRegister = async (email, password, displayName) => {
    try {
      const result = await registerWithEmailPassword(email, password, displayName);
      if (result.success) {
        setUser(result.user);
        setAuthMethod('firebase');
        return result;
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    const currentUser = user;

    try {
      // Handle logout based on authentication method
      if (authMethod === 'firebase') {
        await signOutUser();
      } else if (authMethod === 'backend') {
        // Call logout endpoint to log the activity on backend
        await authService.logout();
      }
    } catch (error) {
      console.error('Error during logout:', error);
    }

    // Log logout activity
    try {
      if (currentUser) {
        await logsService.logActivity(
          logsService.ActivityTypes.LOGOUT,
          `User ${currentUser.email || currentUser.username} logged out`,
          { logout_time: new Date().toISOString() }
        );
      }
    } catch (logError) {
      console.error('Failed to log logout activity:', logError);
    }

    // Clear session and cache
    // Skip callback to prevent circular call (since we're already in logout)
    sessionService.logout('User initiated logout', true);
    cacheService.clearAll();

    setUser(null);
    setAuthMethod(null);
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const resendVerificationEmail = async () => {
    try {
      const result = await sendVerificationEmail();
      if (result.success) {
        return { success: true };
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      throw error;
    }
  };

  const sendPasswordResetEmail = async (email) => {
    try {
      const result = await sendPasswordReset(email);
      if (result.success) {
        return { success: true };
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      throw error;
    }
  };

  const value = {
    user,
    login,
    firebaseLogin,
    hybridLogin, // NEW: Hybrid authentication method
    register,
    firebaseRegister,
    logout,
    updateUser,
    resendVerificationEmail,
    sendPasswordResetEmail,
    loading,
    authMethod,
    isAuthenticated: !!user,
    hasRole: (role) => user?.role === role,
    canCreateViolations: () => authService.canCreateViolations(),
    canManageUsers: () => authService.canManageUsers(),
    isAdmin: () => authService.isAdmin(),
    isEmailVerified: () => user?.emailVerified === true,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
