// Firebase configuration for ZWash
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyCCmkNhkx9FbUtV4m2IQM-LzvM0AdV4IVo",
  authDomain: "zwashdemo.firebaseapp.com",
  projectId: "zwashdemo",
  storageBucket: "zwashdemo.firebasestorage.app",
  messagingSenderId: "233891684120",
  appId: "1:233891684120:web:266e0ffcc84a164da0886d",
  measurementId: "G-MLP7E4JGEJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// Analytics (only in browser)
let analytics = null;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}
export { analytics };

export default app;
