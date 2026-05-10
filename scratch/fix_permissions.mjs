import { initializeApp } from 'firebase/app';
import { getFirestore, updateDoc, doc, getDoc } from 'firebase/firestore';

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

const PLANS = { BASIC: 'basic' };
const PLAN_FEATURES = {
    [PLANS.BASIC]: ['dashboard', 'bookings', 'calendar', 'services', 'customers', 'settings']
};

async function fixPermissions() {
    const id = 'CCqmfo34UMjHMBBSTSyb'; // arabtimes2015@gmail.com
    console.log(`Fixing permissions for ID ${id}...`);
    const permissions = PLAN_FEATURES[PLANS.BASIC].reduce((acc, feat) => ({ ...acc, [feat]: true }), {});
    await updateDoc(doc(db, 'demoClients', id), { permissions });
    console.log("Done.");
    process.exit(0);
}

fixPermissions().catch(console.error);
