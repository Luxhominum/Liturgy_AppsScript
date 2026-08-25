import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyBwPG4Qp42uiGTHQeuYBK5QoS5J5ZLcGvE',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'jadwal-liturgi.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'jadwal-liturgi',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'jadwal-liturgi.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '195979083997',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:195979083997:web:3b0850bd81645b023e1b34',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-Y1651BNL1S'
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const functions = getFunctions(app, 'asia-southeast2');

if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099');
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}

export default app;