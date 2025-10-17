# Integration Example: Google Auth + Traffic Management System

How to integrate Google Firebase Authentication with your existing Traffic Management System.

## 🎯 Overview

This guide shows you how to combine:
- ✅ Google Firebase Authentication (new)
- ✅ Existing Traffic Management Backend API
- ✅ Current AuthContext and routing system

## 📋 Integration Options

### Option 1: Replace Existing Auth (Full Migration)

Replace the current authentication system with Firebase Google Auth.

### Option 2: Add Google as Additional Provider (Recommended)

Keep your existing auth but add "Sign in with Google" as an option.

---

## 🚀 Option 2: Add Google Sign-In to Existing System

This is the **recommended approach** as it preserves your current system.

### Step 1: Update AuthContext

Modify `src/context/AuthContext.js`:

```javascript
import React, { createContext, useState, useContext, useEffect } from 'react';
import { signInWithGoogle, signOutUser, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authMethod, setAuthMethod] = useState(null); // 'google' or 'traditional'

  useEffect(() => {
    // Check for traditional auth
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
      setIsAuthenticated(true);
      setAuthMethod('traditional');
      setLoading(false);
      return;
    }

    // Listen for Google Firebase auth
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const userData = {
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName,
          email: firebaseUser.email,
          photoURL: firebaseUser.photoURL,
          emailVerified: firebaseUser.emailVerified,
          role: 'user' // Default role, can be fetched from Firestore
        };
        setUser(userData);
        setIsAuthenticated(true);
        setAuthMethod('google');
      } else {
        setUser(null);
        setIsAuthenticated(false);
        setAuthMethod(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Traditional login (existing)
  const login = async (credentials) => {
    try {
      const response = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) throw new Error('Login failed');

      const data = await response.json();
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      setUser(data.user);
      setIsAuthenticated(true);
      setAuthMethod('traditional');
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Google login (new)
  const loginWithGoogle = async () => {
    const result = await signInWithGoogle();
    if (result.success) {
      // Optionally sync with your backend
      await syncGoogleUserWithBackend(result.user);
      return { success: true, user: result.user };
    }
    return result;
  };

  // Sync Google user with your backend (optional)
  const syncGoogleUserWithBackend = async (googleUser) => {
    try {
      const token = await auth.currentUser.getIdToken();
      
      await fetch('http://localhost:8000/api/auth/google-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          uid: googleUser.uid,
          email: googleUser.email,
          displayName: googleUser.displayName,
          photoURL: googleUser.photoURL
        })
      });
    } catch (error) {
      console.error('Failed to sync with backend:', error);
    }
  };

  // Unified logout
  const logout = async () => {
    if (authMethod === 'google') {
      await signOutUser();
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    
    setUser(null);
    setIsAuthenticated(false);
    setAuthMethod(null);
  };

  const value = {
    user,
    isAuthenticated,
    loading,
    authMethod,
    login,
    loginWithGoogle,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
```

### Step 2: Update Login Page

Modify `src/pages/Login.jsx` to add Google Sign-In button:

```jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const Login = () => {
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  // Traditional login
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const result = await login(credentials);
    
    setLoading(false);

    if (result.success) {
      toast.success('Login successful!');
      navigate('/dashboard');
    } else {
      toast.error(result.error || 'Login failed');
    }
  };

  // Google login
  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    
    const result = await loginWithGoogle();
    
    setGoogleLoading(false);

    if (result.success) {
      toast.success(`Welcome, ${result.user.displayName}!`);
      navigate('/dashboard');
    } else {
      toast.error(result.error || 'Google sign-in failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-bold text-center mb-6">
          Traffic Management System
        </h2>

        {/* Traditional Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={credentials.email}
              onChange={(e) => setCredentials({...credentials, email: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              value={credentials.password}
              onChange={(e) => setCredentials({...credentials, password: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">Or continue with</span>
          </div>
        </div>

        {/* Google Sign-In Button */}
        <button
          onClick={handleGoogleLogin}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-300 rounded-lg px-4 py-2 text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-400 transition-all disabled:opacity-50"
        >
          {googleLoading ? (
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          <span>Sign in with Google</span>
        </button>
      </div>
    </div>
  );
};

export default Login;
```

### Step 3: Update Navbar (Show User Photo)

Modify `src/components/Navbar.jsx` to show Google profile picture:

```jsx
import { useAuth } from '../context/AuthContext';

const Navbar = ({ onMobileMenuClick }) => {
  const { user, authMethod, logout } = useAuth();

  return (
    <nav className="bg-white shadow-sm">
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={onMobileMenuClick} className="lg:hidden">
          {/* Menu icon */}
        </button>

        <div className="flex items-center gap-4">
          {/* User Profile */}
          <div className="flex items-center gap-3">
            {authMethod === 'google' && user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName}
                className="w-8 h-8 rounded-full border-2 border-blue-500"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
                {user?.displayName?.[0] || user?.email?.[0] || 'U'}
              </div>
            )}
            
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-gray-900">
                {user?.displayName || user?.email}
              </p>
              <p className="text-xs text-gray-500 capitalize">
                {authMethod === 'google' ? 'Google Account' : user?.role}
              </p>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={logout}
            className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
```

### Step 4: Add Toast to Main App

Update `src/App.js`:

```jsx
import { Toaster } from 'react-hot-toast';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Toaster position="top-center" />
          <AppContent />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}
```

### Step 5: Backend Integration (Optional)

Create a new endpoint in your backend to handle Google-authenticated users:

```python
# backend/app/routers/auth.py

from fastapi import APIRouter, Depends, HTTPException
from firebase_admin import auth as firebase_auth
import firebase_admin
from firebase_admin import credentials

router = APIRouter()

# Initialize Firebase Admin (do this once in main.py)
# cred = credentials.Certificate("path/to/serviceAccountKey.json")
# firebase_admin.initialize_app(cred)

@router.post("/auth/google-login")
async def google_login(token: str):
    try:
        # Verify the Firebase token
        decoded_token = firebase_auth.verify_id_token(token)
        uid = decoded_token['uid']
        email = decoded_token.get('email')
        
        # Check if user exists in your database
        user = db.query(User).filter(User.firebase_uid == uid).first()
        
        if not user:
            # Create new user
            user = User(
                firebase_uid=uid,
                email=email,
                name=decoded_token.get('name'),
                photo_url=decoded_token.get('picture'),
                auth_provider='google',
                role='user'
            )
            db.add(user)
            db.commit()
        
        return {
            "success": True,
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "role": user.role
            }
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")
```

## 🎯 Testing the Integration

1. **Install dependencies:**
   ```bash
   cd frontend
   npm install firebase react-hot-toast
   ```

2. **Set up Firebase credentials** (see `FIREBASE_SETUP_INSTRUCTIONS.md`)

3. **Start the app:**
   ```bash
   npm run dev
   ```

4. **Test both login methods:**
   - Traditional login with email/password
   - Google Sign-In button

## ✅ Benefits of This Approach

- ✅ **Preserves existing system** - Traditional auth still works
- ✅ **User choice** - Users can choose their preferred method
- ✅ **Easy migration** - Can gradually move users to Google
- ✅ **Better UX** - One-click sign-in for Google users
- ✅ **Reduced friction** - No password creation needed

## 🔄 Migration Path

If you want to fully migrate to Google Auth later:

1. Keep both methods running in parallel
2. Encourage users to link their Google account
3. Monitor usage analytics
4. After majority migrates, deprecate traditional auth
5. Remove old authentication code

---

**This integration gives you the best of both worlds! 🚀**

