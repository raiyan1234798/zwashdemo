import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

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

async function checkUser() {
    const email = 'abubackerraiyan@gmail.com';
    console.log(`Checking user: ${email}`);
    
    const q = query(collection(db, 'adminUsers'), where('email', '==', email));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
        console.log('User not found in adminUsers collection.');
        return;
    }
    
    snapshot.forEach(doc => {
        console.log('User Profile:', JSON.stringify(doc.data(), null, 2));
    });
}

checkUser().catch(console.error);
