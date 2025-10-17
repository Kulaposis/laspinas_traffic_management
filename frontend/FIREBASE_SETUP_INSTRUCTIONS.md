# 🔥 Firebase Setup Instructions

Quick guide to configure Firebase for Google Authentication.

## Step 1: Create Firebase Project

1. Visit [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"** (or use existing project)
3. Enter project name (e.g., "Traffic Management")
4. Optional: Disable Google Analytics (can enable later)
5. Click **"Create project"**

## Step 2: Add Web App to Firebase

1. In Firebase Console, click the **Web icon** `</>`
2. Register app nickname: "Traffic Management Web"
3. ✅ Check "Also set up Firebase Hosting" (optional)
4. Click **"Register app"**
5. **Copy the firebaseConfig object** - you'll need this!

```javascript
// Example firebaseConfig (yours will be different)
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};
```

## Step 3: Enable Google Sign-In Method

1. In Firebase Console, go to **Authentication**
2. Click **"Get started"** if first time
3. Go to **"Sign-in method"** tab
4. Click on **Google** in the providers list
5. Toggle **"Enable"**
6. Set **"Public-facing name"**: Your app name
7. Choose **"Project support email"**: Your email
8. Click **"Save"**

## Step 4: Configure Your App

### A. Create `.env` File

In your `frontend` folder:

```bash
# Copy the example file
cp env.example .env
```

### B. Add Firebase Credentials

Edit `.env` with your Firebase config values:

```env
VITE_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef1234567890
```

### C. Install Dependencies

```bash
cd frontend
npm install firebase react-hot-toast
```

## Step 5: Test the Authentication

### Option A: Test Standalone (Recommended)

1. Update `src/main.jsx` temporarily:

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

2. Start dev server:

```bash
npm run dev
```

3. Open browser to `http://localhost:5173`
4. Click "Sign in with Google"
5. Select your Google account
6. You should see the Dashboard!

## Step 6: Authorize Domains (for Production)

1. Go to **Authentication** → **Settings** → **Authorized domains**
2. For development: `localhost` should already be there
3. For production: Click **"Add domain"** and add your domain:
   - `yourdomain.com`
   - `www.yourdomain.com`

## 🔒 Security Best Practices

### 1. Protect Your `.env` File

Make sure `.env` is in `.gitignore`:

```gitignore
# Environment variables
.env
.env.local
.env.production
```

### 2. Enable Firebase Security Rules

Go to **Firestore Database** or **Realtime Database** → **Rules**:

```javascript
// Example rules for Firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 3. Enable App Check (Recommended for Production)

1. Go to **App Check** in Firebase Console
2. Register your app
3. Select provider (reCAPTCHA for web)
4. Add the App Check SDK to your app

## ✅ Checklist

Before deploying, make sure:

- [ ] Firebase project created
- [ ] Web app registered in Firebase
- [ ] Google Sign-In enabled in Authentication
- [ ] `.env` file created with correct credentials
- [ ] Dependencies installed (`firebase`, `react-hot-toast`)
- [ ] Production domain added to Authorized domains
- [ ] `.env` is in `.gitignore`
- [ ] Tested sign-in/sign-out locally

## 🐛 Common Issues

### Popup Blocked

**Problem:** "Popup closed by user" error

**Solution:**
- Allow popups for localhost in browser
- Or use redirect instead of popup (change code in `firebase.js`)

### Unauthorized Domain

**Problem:** "This domain is not authorized"

**Solution:**
- Add domain to Authorized domains in Firebase Console
- For local dev, make sure `localhost` is listed

### Firebase Not Initialized

**Problem:** "Firebase app not initialized"

**Solution:**
- Check `.env` file exists and has correct values
- Restart dev server after creating `.env`
- Make sure env variables start with `VITE_`

## 📚 Next Steps

After setting up authentication:

1. **Add User Profile Management** - Let users update their info
2. **Implement Role-Based Access** - Admin, user, etc.
3. **Add Email/Password Sign-In** - Additional auth method
4. **Set Up Firestore** - Store user data
5. **Add Password Reset** - For email/password users

## 📞 Need Help?

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firebase Authentication Guide](https://firebase.google.com/docs/auth/web/google-signin)
- [Stack Overflow - Firebase Tag](https://stackoverflow.com/questions/tagged/firebase)

---

**Happy coding! 🚀**

