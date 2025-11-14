// Firebase Configuration for Firestore and Storage
// Reuse the app initialized in src/firebase.js to avoid duplicate-app errors
import '../firebase';
import { getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
// Importing auth is unnecessary here; consumers should import from src/firebase.js
// to ensure a single source of truth for auth instance.

// Initialize Firebase services
const app = getApp();
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
