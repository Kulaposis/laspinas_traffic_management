# ⚡ Quick Start: Google Authentication

Get Google Sign-In working in **5 minutes**!

## 🎯 Prerequisites

- Node.js installed
- Google account
- 5 minutes of your time

## 📝 Step-by-Step Setup

### 1️⃣ Firebase Setup (2 minutes)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"** → Name it → Click "Continue" → Create
3. Click the **Web icon** `</>` → Name: "My Web App" → Register
4. **Copy the config** (keep this tab open!)

### 2️⃣ Enable Google Sign-In (1 minute)

1. Firebase Console → **Authentication** → "Get started"
2. **Sign-in method** tab → Click **Google**
3. Toggle **Enable** → Add support email → Save

### 3️⃣ Install & Configure (1 minute)

```bash
# 1. Go to frontend folder
cd frontend

# 2. Install packages
npm install firebase react-hot-toast

# 3. Create .env file
cp env.example .env
```

Now edit `.env` with your Firebase config:

```env
VITE_FIREBASE_API_KEY=paste_your_apiKey_here
VITE_FIREBASE_AUTH_DOMAIN=paste_your_authDomain_here
VITE_FIREBASE_PROJECT_ID=paste_your_projectId_here
VITE_FIREBASE_STORAGE_BUCKET=paste_your_storageBucket_here
VITE_FIREBASE_MESSAGING_SENDER_ID=paste_your_messagingSenderId_here
VITE_FIREBASE_APP_ID=paste_your_appId_here
```

### 4️⃣ Test It! (1 minute)

Update `src/main.jsx`:

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

Run the app:

```bash
npm run dev
```

Open `http://localhost:5173` and click **"Sign in with Google"** 🎉

## ✅ That's It!

You should now see:
1. Login page with Google button
2. Click it → Choose Google account
3. Dashboard with your profile!

## 🐛 Troubleshooting

### "Popup was blocked"
→ Allow popups for localhost in browser settings

### "This domain is not authorized"  
→ Firebase Console → Authentication → Settings → Authorized domains → Add `localhost`

### Environment variables not loading
→ Restart dev server (`Ctrl+C` then `npm run dev`)

### Still having issues?
→ Check [GOOGLE_AUTH_SETUP.md](./GOOGLE_AUTH_SETUP.md) for detailed troubleshooting

## 📚 Next Steps

- [Full Documentation](./GOOGLE_AUTH_README.md)
- [Integration Guide](./INTEGRATION_EXAMPLE.md)
- [Firebase Setup Details](./FIREBASE_SETUP_INSTRUCTIONS.md)

## 🎨 Files You Got

```
✅ firebase.js              - Firebase config & helpers
✅ Login.jsx               - Beautiful login page
✅ Dashboard.jsx           - User profile dashboard  
✅ AppGoogleAuth.jsx       - Main app with auth flow
✅ env.example             - Environment template
```

## 🚀 Production Deployment

Before deploying:

1. Add your domain to Firebase Authorized domains
2. Update `.env` for production
3. Build: `npm run build`
4. Deploy the `dist/` folder

---

**Enjoy your Google Sign-In! 🎉**

Questions? Check the full docs or ask for help!

