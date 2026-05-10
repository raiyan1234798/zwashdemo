import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCCmkNhkx9FbUtV4m2IQM-LzvM0AdV4IVo",
  authDomain: "zwashdemo.firebaseapp.com",
  projectId: "zwashdemo",
  storageBucket: "zwashdemo.firebasestorage.app",
  messagingSenderId: "233891684120",
  appId: "1:233891684120:web:266e0ffcc84a164da0886d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function listEmails() {
    const snap = await getDocs(collection(db, 'demoClients'));
    console.log("Current Demo Clients:");
    snap.forEach(d => console.log(`- ${d.data().email} (ID: ${d.id})`));
    process.exit(0);
}

listEmails().catch(console.error);
