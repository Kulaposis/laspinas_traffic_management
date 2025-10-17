# ✅ Google Authentication Setup Checklist

Use this checklist to ensure everything is properly configured.

## 📋 Pre-Setup Checklist

Before you begin:

- [ ] Node.js installed (v16 or higher)
- [ ] npm or yarn installed
- [ ] Google account created
- [ ] Modern web browser installed
- [ ] Text editor ready (VS Code recommended)

---

## 🔥 Firebase Setup Checklist

### Step 1: Create Firebase Project

- [ ] Visited [Firebase Console](https://console.firebase.google.com/)
- [ ] Clicked "Add project" (or selected existing)
- [ ] Named project (e.g., "Traffic Management")
- [ ] Chose Google Analytics preference
- [ ] Project created successfully

### Step 2: Register Web App

- [ ] Clicked Web icon `</>` in Firebase project
- [ ] Entered app nickname
- [ ] Checked Firebase Hosting (optional)
- [ ] Clicked "Register app"
- [ ] **Copied firebaseConfig object** (keep it handy!)

### Step 3: Enable Google Authentication

- [ ] Navigated to Authentication section
- [ ] Clicked "Get started" (if first time)
- [ ] Went to "Sign-in method" tab
- [ ] Found Google in providers list
- [ ] Clicked on Google
- [ ] Toggled "Enable" to ON
- [ ] Set public-facing name for project
- [ ] Chose support email
- [ ] Clicked "Save"
- [ ] Verified Google provider is "Enabled"

### Step 4: Configure Authorized Domains

- [ ] Went to Authentication → Settings
- [ ] Checked "Authorized domains" tab
- [ ] Verified `localhost` is in list (for development)
- [ ] Added production domain (if deploying)

---

## 💻 Local Setup Checklist

### Step 1: Install Dependencies

```bash
cd frontend
npm install firebase react-hot-toast
```

Verify installation:
- [ ] `firebase` in `package.json` dependencies
- [ ] `react-hot-toast` in `package.json` dependencies
- [ ] `node_modules` folder updated
- [ ] No error messages during installation

### Step 2: Environment Configuration

- [ ] Copied `env.example` to `.env`
- [ ] Opened `.env` file in editor
- [ ] Pasted `VITE_FIREBASE_API_KEY` from Firebase
- [ ] Pasted `VITE_FIREBASE_AUTH_DOMAIN` from Firebase
- [ ] Pasted `VITE_FIREBASE_PROJECT_ID` from Firebase
- [ ] Pasted `VITE_FIREBASE_STORAGE_BUCKET` from Firebase
- [ ] Pasted `VITE_FIREBASE_MESSAGING_SENDER_ID` from Firebase
- [ ] Pasted `VITE_FIREBASE_APP_ID` from Firebase
- [ ] Saved `.env` file
- [ ] Verified `.env` is in `.gitignore`

### Step 3: Verify Files Exist

Check these files are present:

- [ ] `src/firebase.js` exists
- [ ] `src/components/Login.jsx` exists
- [ ] `src/components/Dashboard.jsx` exists
- [ ] `src/AppGoogleAuth.jsx` exists
- [ ] `env.example` exists
- [ ] `.env` exists (created by you)

---

## 🚀 Testing Checklist

### Step 1: Update Entry Point (for standalone test)

Edit `src/main.jsx`:

- [ ] Imported `AppGoogleAuth` instead of `App`
- [ ] Replaced `<App />` with `<AppGoogleAuth />`
- [ ] Saved file

### Step 2: Start Development Server

```bash
npm run dev
```

Verify:
- [ ] Server started without errors
- [ ] Terminal shows URL (e.g., `http://localhost:5173`)
- [ ] No build errors displayed

### Step 3: Test in Browser

- [ ] Opened browser to development URL
- [ ] Login page loaded
- [ ] Google logo visible
- [ ] "Sign in with Google" button visible
- [ ] No console errors (F12 → Console tab)

### Step 4: Test Sign-In Flow

- [ ] Clicked "Sign in with Google" button
- [ ] Google popup opened
- [ ] Selected Google account
- [ ] Granted permissions
- [ ] Popup closed automatically
- [ ] Success toast appeared ("Welcome, [Name]!")
- [ ] Redirected to Dashboard

### Step 5: Verify Dashboard

- [ ] Profile picture displayed
- [ ] Name displayed correctly
- [ ] Email displayed correctly
- [ ] Email verification badge shows (if verified)
- [ ] Account information section visible
- [ ] Account status section visible
- [ ] Quick actions buttons visible
- [ ] "Sign Out" button visible

### Step 6: Test Sign-Out

- [ ] Clicked "Sign Out" button
- [ ] Success toast appeared ("Signed out successfully")
- [ ] Redirected to Login page
- [ ] User session cleared

### Step 7: Test Session Persistence

- [ ] Signed in again
- [ ] Refreshed browser (F5)
- [ ] Still logged in (Dashboard shown)
- [ ] User data still displayed

---

## 🐛 Troubleshooting Checklist

### If Popup Doesn't Open

- [ ] Checked browser popup blocker
- [ ] Allowed popups for localhost
- [ ] Tried different browser
- [ ] Checked browser console for errors

### If "Unauthorized Domain" Error

- [ ] Verified domain in Firebase Authorized domains
- [ ] Added `localhost` to authorized domains
- [ ] Waited 1-2 minutes for changes to propagate
- [ ] Refreshed browser

### If Environment Variables Not Working

- [ ] File named exactly `.env` (not `.env.txt`)
- [ ] Variables start with `VITE_` prefix
- [ ] No quotes around values
- [ ] Restarted dev server after creating `.env`
- [ ] File is in `frontend/` directory

### If Firebase Not Initialized

- [ ] Checked all env variables are filled
- [ ] Verified no typos in variable names
- [ ] Checked Firebase config object syntax
- [ ] Looked at browser console for specific error

### If Components Not Found

- [ ] Verified all files in correct directories
- [ ] Checked import paths are correct
- [ ] Ran `npm install` again
- [ ] Restarted dev server

---

## 📱 Mobile Testing Checklist

### Responsive Design

- [ ] Opened developer tools (F12)
- [ ] Toggled device toolbar (mobile view)
- [ ] Tested on mobile size (375px width)
- [ ] Tested on tablet size (768px width)
- [ ] Verified layout adapts correctly
- [ ] Buttons are touch-friendly (big enough)
- [ ] No horizontal scrolling

### Actual Device Testing

- [ ] Tested on real phone (if available)
- [ ] Sign-in works on mobile
- [ ] Dashboard displays correctly
- [ ] Logout button accessible

---

## 🔒 Security Checklist

### Development

- [ ] `.env` file in `.gitignore`
- [ ] No Firebase credentials in code
- [ ] Using environment variables
- [ ] `.env` not committed to Git

### Production Preparation

- [ ] Production domain in Authorized domains
- [ ] Created production `.env` file
- [ ] Different Firebase project for prod (optional)
- [ ] Considered enabling App Check
- [ ] Reviewed Firebase Security Rules

---

## 📊 Performance Checklist

### Initial Load

- [ ] Page loads in < 3 seconds
- [ ] No layout shifts
- [ ] Images load properly
- [ ] No console warnings

### Sign-In Flow

- [ ] Button responds immediately
- [ ] Loading state shows quickly
- [ ] Popup opens in < 1 second
- [ ] Redirect happens smoothly

---

## 📚 Documentation Checklist

Have you read:

- [ ] `QUICK_START_GOOGLE_AUTH.md` - Quick setup guide
- [ ] `FIREBASE_SETUP_INSTRUCTIONS.md` - Firebase config
- [ ] `GOOGLE_AUTH_README.md` - Main documentation
- [ ] `GOOGLE_AUTH_SETUP.md` - Complete setup guide
- [ ] `GOOGLE_AUTH_FLOW.md` - Understanding the flow

Optional reading:

- [ ] `INTEGRATION_EXAMPLE.md` - Integration with existing app
- [ ] `UI_PREVIEW.md` - UI design details
- [ ] `GOOGLE_AUTH_IMPLEMENTATION_SUMMARY.md` - Full summary

---

## ✅ Final Verification

Before considering setup complete:

- [ ] Can sign in successfully
- [ ] Can see user profile
- [ ] Can sign out
- [ ] Session persists on refresh
- [ ] No errors in console
- [ ] Mobile view works
- [ ] Ready for integration (if needed)

---

## 🎯 Common Issues Quick Reference

| Issue | Quick Fix |
|-------|-----------|
| Popup blocked | Allow popups in browser settings |
| Unauthorized domain | Add domain to Firebase console |
| Env vars not working | Restart dev server |
| Component not found | Check import paths |
| Firebase error | Verify all env variables |

---

## 📝 Setup Completion

Once all items are checked:

✅ **Setup is complete!**

You can now:
1. Use the authentication system as-is
2. Integrate with your existing app
3. Customize the UI to match your brand
4. Deploy to production

---

## 🎓 Next Steps

After successful setup:

- [ ] Customize UI colors/branding
- [ ] Add to existing app (see `INTEGRATION_EXAMPLE.md`)
- [ ] Set up user roles (if needed)
- [ ] Configure Firestore (if storing user data)
- [ ] Add analytics tracking
- [ ] Prepare for production deployment

---

## 💡 Pro Tips

- ✅ Use version control (Git) but exclude `.env`
- ✅ Test in multiple browsers (Chrome, Firefox, Safari)
- ✅ Keep Firebase Console open during testing
- ✅ Check browser console for helpful error messages
- ✅ Start with standalone test before integrating
- ✅ Read error messages carefully - they're helpful!

---

## 📞 Need Help?

If stuck:

1. **Check console** - Browser dev tools (F12)
2. **Review docs** - Especially troubleshooting sections
3. **Firebase Console** - Check Authentication → Users
4. **Network tab** - See what requests are failing
5. **Start fresh** - Clear localStorage, restart server

---

**Happy building! 🚀**

*Print this checklist and check off items as you complete them.*

