// Firebase Configuration and Initialization
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  onAuthStateChanged,
  updateProfile,
  getAdditionalUserInfo,
  applyActionCode,
  checkActionCode
} from 'firebase/auth';

// Firebase configuration object
// Using environment variables for security
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Validate that all required environment variables are present
const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !import.meta.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('Missing required Firebase environment variables:', missingEnvVars);
  console.error('Please check your .env file and ensure all Firebase configuration values are set.');
  throw new Error(`Missing Firebase configuration: ${missingEnvVars.join(', ')}`);
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Analytics is intentionally not initialized to avoid blocked tracking requests

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Initialize Google Auth Provider
const googleProvider = new GoogleAuthProvider();

// Configure Google Provider (optional settings)
googleProvider.setCustomParameters({
  prompt: 'select_account' // Force account selection even if one account is available
});

// Export Google Provider for use in components
export { googleProvider };

// Helper function: Map Firebase user to app user shape used across the app (includes role fallback)
const mapFirebaseUserToAppUser = (firebaseUser) => {
  return {
    id: firebaseUser.uid, // app commonly uses numeric id; we use uid string fallback
    uid: firebaseUser.uid,
    full_name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
    displayName: firebaseUser.displayName,
    email: firebaseUser.email,
    photoURL: firebaseUser.photoURL,
    emailVerified: firebaseUser.emailVerified,
    role: 'citizen', // default role for Google sign-in unless mapped by backend later
  };
};

// Helper function: Sign in with Google
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    const mappedUser = mapFirebaseUserToAppUser(user);

    // Persist for app routing (no backend token for Google-only flow)
    localStorage.setItem('user', JSON.stringify(mappedUser));

    return { success: true, user: mappedUser };
  } catch (error) {
    console.error('Error signing in with Google:', error);

    // Handle specific error codes
    let errorMessage = 'An error occurred during sign-in';

    switch (error.code) {
      case 'auth/popup-closed-by-user':
        errorMessage = 'Sign-in cancelled';
        break;
      case 'auth/popup-blocked':
        errorMessage = 'Popup blocked by browser. Please allow popups for this site.';
        break;
      case 'auth/cancelled-popup-request':
        errorMessage = 'Sign-in cancelled';
        break;
      case 'auth/network-request-failed':
        errorMessage = 'Network error. Please check your connection.';
        break;
      default:
        errorMessage = error.message;
    }

    return { success: false, error: errorMessage };
  }
};

// Helper function: Sign in with email and password
export const signInWithEmailPassword = async (email, password) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const user = result.user;

    const mappedUser = mapFirebaseUserToAppUser(user);

    // Persist for app routing
    localStorage.setItem('user', JSON.stringify(mappedUser));

    return { success: true, user: mappedUser };
  } catch (error) {
    console.error('Error signing in with email/password:', error);

    let errorMessage = 'An error occurred during sign-in';

    switch (error.code) {
      case 'auth/user-not-found':
        errorMessage = 'No account found with this email address';
        break;
      case 'auth/wrong-password':
        errorMessage = 'Incorrect password';
        break;
      case 'auth/invalid-email':
        errorMessage = 'Invalid email address';
        break;
      case 'auth/user-disabled':
        errorMessage = 'This account has been disabled';
        break;
      case 'auth/too-many-requests':
        errorMessage = 'Too many failed attempts. Please try again later';
        break;
      case 'auth/network-request-failed':
        errorMessage = 'Network error. Please check your connection.';
        break;
      default:
        errorMessage = error.message;
    }

    return { success: false, error: errorMessage };
  }
};

// Helper function: Register with email and password
export const registerWithEmailPassword = async (email, password, displayName) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const user = result.user;

    // Update display name if provided
    if (displayName) {
      await updateProfile(user, {
        displayName: displayName
      });
    }

    // Send email verification
    await sendEmailVerification(user);

    const mappedUser = mapFirebaseUserToAppUser(user);

    // Persist for app routing
    localStorage.setItem('user', JSON.stringify(mappedUser));

    return { success: true, user: mappedUser, needsVerification: true };
  } catch (error) {
    console.error('Error registering with email/password:', error);

    let errorMessage = 'An error occurred during registration';

    switch (error.code) {
      case 'auth/email-already-in-use':
        errorMessage = 'An account with this email already exists';
        break;
      case 'auth/invalid-email':
        errorMessage = 'Invalid email address';
        break;
      case 'auth/weak-password':
        errorMessage = 'Password should be at least 6 characters';
        break;
      case 'auth/network-request-failed':
        errorMessage = 'Network error. Please check your connection.';
        break;
      default:
        errorMessage = error.message;
    }

    return { success: false, error: errorMessage };
  }
};

// Helper function: Send email verification
export const sendVerificationEmail = async (customUrl = null) => {
  try {
    const user = auth.currentUser;
    if (user) {
      // Configure email verification with proper redirect URL
      const actionCodeSettings = {
        url: `${window.location.origin}/?verified=true&email=${encodeURIComponent(user.email)}`,
        handleCodeInApp: false, // Let Firebase handle the redirect, then our app will process it
      };

      await sendEmailVerification(user, actionCodeSettings);
      return { success: true };
    } else {
      return { success: false, error: 'No authenticated user found' };
    }
  } catch (error) {
    console.error('Error sending verification email:', error);
    return { success: false, error: error.message };
  }
};

// Helper function: Send password reset email
export const sendPasswordReset = async (email) => {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (error) {
    console.error('Error sending password reset email:', error);

    let errorMessage = 'An error occurred while sending password reset email';

    switch (error.code) {
      case 'auth/invalid-email':
        errorMessage = 'Invalid email address';
        break;
      case 'auth/user-not-found':
        errorMessage = 'No account found with this email address';
        break;
      case 'auth/network-request-failed':
        errorMessage = 'Network error. Please check your connection.';
        break;
      default:
        errorMessage = error.message;
    }

    return { success: false, error: errorMessage };
  }
};

// Helper function: Listen to auth state changes
export const onAuthStateChange = (callback) => {
  return onAuthStateChanged(auth, callback);
};

// Helper function: Handle email verification action code from URL
export const handleEmailVerificationAction = async (actionCode) => {
  try {
    // Verify the action code
    const info = await checkActionCode(auth, actionCode);

    // Apply the action code to verify the email
    await applyActionCode(auth, actionCode);

    return { success: true, email: info.data.email };
  } catch (error) {
    console.error('Error handling email verification action:', error);
    return { success: false, error: error.message };
  }
};

// Helper function: Check if URL contains email verification action code
export const checkForEmailVerificationAction = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const actionCode = urlParams.get('oobCode');

  if (actionCode && urlParams.get('mode') === 'verifyEmail') {
    return actionCode;
  }

  return null;
};

// Helper function: Sign out
export const signOutUser = async () => {
  try {
    await signOut(auth);
    // Clear user data from localStorage
    localStorage.removeItem('user');
    return { success: true };
  } catch (error) {
    console.error('Error signing out:', error);
    return { success: false, error: error.message };
  }
};

// Helper function: Get current user from localStorage
export const getCurrentUser = () => {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
};

// Export mapper for consumers that need consistent user shape
export const mapUser = mapFirebaseUserToAppUser;

