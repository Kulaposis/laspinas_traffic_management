# Google Account Login with Firebase Authentication

Complete implementation of Google Sign-In using Firebase Authentication for React applications.

## 📋 Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Firebase Setup](#firebase-setup)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [File Structure](#file-structure)
- [Components Overview](#components-overview)
- [Troubleshooting](#troubleshooting)

## ✨ Features

- ✅ Google Sign-In with popup authentication
- ✅ User session persistence using localStorage
- ✅ Firebase Authentication state management
- ✅ Mobile-responsive UI (Google-like design)
- ✅ Loading states and error handling
- ✅ Toast notifications for success/error feedback
- ✅ Sign-out functionality
- ✅ User profile display (name, email, photo)
- ✅ Email verification status indicator

## 📦 Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Firebase account (free tier is sufficient)
- React application with Vite or Create React App

## 🔥 Firebase Setup

### Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Follow the setup wizard (you can disable Google Analytics for testing)

### Step 2: Register Web App

1. In your Firebase project, click the **Web icon** (`</>`) to add a web app
2. Register your app with a nickname (e.g., "Traffic Management Web")
3. Copy the Firebase configuration object (you'll need this later)

### Step 3: Enable Google Sign-In

1. In Firebase Console, go to **Authentication** → **Sign-in method**
2. Click on **Google** provider
3. Toggle "Enable"
4. Set a public-facing name for your project
5. Add your support email
6. Click **Save**

### Step 4: Configure Authorized Domains

1. In **Authentication** → **Settings** → **Authorized domains**
2. Make sure `localhost` is in the list (it should be by default)
3. Add your production domain when deploying (e.g., `yourapp.com`)

## 📥 Installation

### 1. Install Dependencies

```bash
cd frontend
npm install firebase react-hot-toast
```

Or if you prefer yarn:

```bash
yarn add firebase react-hot-toast
```

### 2. Update package.json

The following dependencies are required:

```json
{
  "dependencies": {
    "firebase": "^10.8.0",
    "react": "^19.1.1",
    "react-dom": "^19.1.1",
    "react-hot-toast": "^2.4.1"
  }
}
```

## ⚙️ Configuration

### 1. Create Environment File

Copy the example environment file:

```bash
cp .env.example .env
```

### 2. Add Firebase Credentials

Edit `.env` and add your Firebase configuration:

```env
VITE_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef1234567890
```

> **Important:** Never commit `.env` to version control. It's already in `.gitignore`.

### 3. Firebase Configuration File

The Firebase config is located in `src/firebase.js`. It automatically reads from environment variables.

## 🚀 Usage

### Option 1: Use the Standalone App (Recommended for Demo)

To test the Google Authentication system independently:

1. Temporarily update `src/main.jsx`:

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import AppGoogleAuth from './AppGoogleAuth.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppGoogleAuth />
  </React.StrictMode>,
)
```

2. Start the development server:

```bash
npm run dev
```

3. Open your browser to `http://localhost:5173`

### Option 2: Integrate with Existing App

To integrate Google Authentication into your existing application:

1. Import the components in your main `App.js`:

```jsx
import { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { auth, getCurrentUser } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = getCurrentUser();
    if (storedUser) {
      setUser(storedUser);
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const userData = {
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName,
          email: firebaseUser.email,
          photoURL: firebaseUser.photoURL,
          emailVerified: firebaseUser.emailVerified
        };
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
      } else {
        setUser(null);
        localStorage.removeItem('user');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <Toaster position="top-center" />
      {user ? (
        <Dashboard user={user} onLogout={() => setUser(null)} />
      ) : (
        <Login onLoginSuccess={setUser} />
      )}
    </>
  );
}

export default App;
```

## 📁 File Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── Login.jsx           # Google Sign-In component
│   │   └── Dashboard.jsx       # User dashboard with profile
│   ├── firebase.js             # Firebase configuration & helpers
│   ├── AppGoogleAuth.jsx       # Standalone authentication app
│   └── main.jsx                # App entry point
├── .env.example                # Environment variables template
├── .env                        # Your Firebase credentials (gitignored)
└── package.json
```

## 🧩 Components Overview

### 1. `firebase.js`

Main Firebase configuration file with helper functions:

- `signInWithGoogle()` - Handles Google Sign-In with popup
- `signOutUser()` - Signs out the current user
- `getCurrentUser()` - Gets user from localStorage
- Error handling for common Firebase auth errors

### 2. `Login.jsx`

Login component featuring:

- Google Sign-In button with loading state
- Mobile-responsive design
- Google-style UI (clean and minimal)
- Toast notifications for success/error

### 3. `Dashboard.jsx`

User dashboard displaying:

- User profile (photo, name, email)
- Email verification badge
- Account information
- Account status
- Quick action buttons
- Sign-out functionality

### 4. `AppGoogleAuth.jsx`

Main app component with:

- Authentication state management
- Route protection (login/dashboard)
- Firebase auth state listener
- localStorage persistence
- Loading screen

## 🔧 Troubleshooting

### Issue: "Popup blocked by browser"

**Solution:** Allow popups for localhost in your browser settings, or use `signInWithRedirect` instead.

### Issue: "Firebase not initialized"

**Solution:** Make sure your `.env` file has the correct Firebase credentials and the file is named exactly `.env` (not `.env.example`).

### Issue: "Unauthorized domain"

**Solution:** 
1. Go to Firebase Console → Authentication → Settings → Authorized domains
2. Add your domain (e.g., `localhost` for development)

### Issue: Toast notifications not showing

**Solution:** Make sure you've imported the Toaster component in your main App:

```jsx
import { Toaster } from 'react-hot-toast';

// In your JSX
<Toaster position="top-center" />
```

### Issue: User not persisting after page refresh

**Solution:** The app uses both localStorage and Firebase's `onAuthStateChanged`. Make sure:
1. localStorage is enabled in your browser
2. You're not in incognito/private mode
3. The auth state listener is properly set up

### Issue: "Module not found: Can't resolve 'firebase'"

**Solution:** Install Firebase:

```bash
npm install firebase
```

## 🎨 Customization

### Change Toast Position

Edit `AppGoogleAuth.jsx`:

```jsx
<Toaster position="bottom-right" /> // or top-left, bottom-center, etc.
```

### Modify Sign-In UI

Edit `components/Login.jsx` to customize:
- Colors (Tailwind classes)
- Logo/branding
- Button text
- Layout

### Add More Auth Providers

In `firebase.js`, you can add:

```javascript
import { FacebookAuthProvider, TwitterAuthProvider } from 'firebase/auth';

const facebookProvider = new FacebookAuthProvider();
const twitterProvider = new TwitterAuthProvider();
```

## 📱 Mobile Responsiveness

The UI is fully responsive with:
- Mobile-first design approach
- Tailwind CSS breakpoints (sm, md, lg)
- Touch-friendly buttons
- Optimized layouts for all screen sizes

## 🔒 Security Notes

1. **Never commit `.env` to Git** - It contains sensitive Firebase credentials
2. **Use Firebase Security Rules** - Restrict database access in production
3. **Enable App Check** - Protect your app from abuse (recommended for production)
4. **Rate Limiting** - Firebase has built-in rate limiting for authentication

## 📚 Additional Resources

- [Firebase Authentication Docs](https://firebase.google.com/docs/auth)
- [React Hot Toast Docs](https://react-hot-toast.com/)
- [Tailwind CSS Docs](https://tailwindcss.com/)

## 🎉 Success!

You now have a fully functional Google Sign-In system. Test it by:

1. Starting your dev server: `npm run dev`
2. Clicking "Sign in with Google"
3. Selecting your Google account
4. Viewing your profile in the Dashboard
5. Clicking "Sign Out" to return to login

Enjoy! 🚀

