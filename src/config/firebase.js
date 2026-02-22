// Firebase configuration for ZWash
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyBgH56hd5TlJzJiLIFK_evt5z1y1m7l6I8",
  authDomain: "washcomplete-7fa4d.firebaseapp.com",
  projectId: "washcomplete-7fa4d",
  storageBucket: "washcomplete-7fa4d.firebasestorage.app",
  messagingSenderId: "27656144834",
  appId: "1:27656144834:web:b98bc60cc7cf2198e7785b",
  measurementId: "G-J0L75X4ND7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Analytics (only in browser)
let analytics = null;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}
export { analytics };

export default app;
