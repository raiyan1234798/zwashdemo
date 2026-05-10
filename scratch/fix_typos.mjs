import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc, query, where } from 'firebase/firestore';

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

async function fixEmails() {
    console.log("Checking for @gmql.com typos...");
    const q = query(collection(db, 'demoClients'), where('email', '>=', ''));
    const snap = await getDocs(q);
    
    for (const d of snap.docs) {
        const data = d.data();
        if (data.email && data.email.includes('@gmql.com')) {
            const fixedEmail = data.email.replace('@gmql.com', '@gmail.com');
            console.log(`Fixing typo: ${data.email} -> ${fixedEmail}`);
            await updateDoc(doc(db, 'demoClients', d.id), { email: fixedEmail });
        }
    }
    console.log("Done.");
    process.exit(0);
}

fixEmails().catch(console.error);
