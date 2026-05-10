import { initializeApp } from 'firebase/app';
import { getFirestore, updateDoc, doc } from 'firebase/firestore';

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

async function fixSpecificEmail() {
    const id = '8xbNcdwl7ubKxj17Uzt8';
    const newEmail = 'rraiyan942@gmail.com';
    console.log(`Fixing typo for ID ${id} -> ${newEmail}`);
    await updateDoc(doc(db, 'demoClients', id), { email: newEmail });
    console.log("Done.");
    process.exit(0);
}

fixSpecificEmail().catch(console.error);
