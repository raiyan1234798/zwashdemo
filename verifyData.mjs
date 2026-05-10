import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCCmkNhkx9FbUtV4m2IQM-LzvM0AdV4IVo",
  authDomain: "zwashdemo.firebaseapp.com",
  projectId: "zwashdemo",
  storageBucket: "zwashdemo.firebasestorage.app",
  messagingSenderId: "233891684120",
  appId: "1:233891684120:web:266e0ffcc84a164da0886d",
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
  const collections = ['bookings', 'customers', 'employees', 'expenses'];
  for (const col of collections) {
    const snap = await getDocs(collection(db, col));
    console.log(`${col}: ${snap.size} documents`);
  }
  process.exit(0);
}
check();
