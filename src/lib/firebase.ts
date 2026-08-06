import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyB0cbySCowWYfXNmS1hZhjdRT2R1RSHrgA",
  authDomain: "playbox-os.firebaseapp.com",
  projectId: "playbox-os",
  storageBucket: "playbox-os.firebasestorage.app",
  messagingSenderId: "559918143844",
  appId: "1:559918143844:web:a9e00896c7b1e5fe628271",
  measurementId: "G-L36Q0K9C03"
};

// Initialize Firebase safely for SSR/Client
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export default app;
