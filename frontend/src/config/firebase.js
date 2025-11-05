// Firebase Configuration for Firestore and Storage
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

// Firebase configuration object
const firebaseConfig = {
  apiKey: "AIzaSyAUgpqB3LoCDjpKNBN-Xec-TUHAKszlQVY",
  authDomain: "traffic-management-9c2f4.firebaseapp.com",
  projectId: "traffic-management-9c2f4",
  storageBucket: "traffic-management-9c2f4.firebasestorage.app",
  messagingSenderId: "870304007603",
  appId: "1:870304007603:web:9d347421d1ea2abcc977c6",
  measurementId: "G-MWNPN4MPQH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);

export default app;
