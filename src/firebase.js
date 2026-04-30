import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyD6b7hqX-D8BdogdOpxWokeSV3zQzEZqXY",
  authDomain: "escalas-iasd-d5f5f.firebaseapp.com",
  projectId: "escalas-iasd-d5f5f",
  storageBucket: "escalas-iasd-d5f5f.firebasestorage.app",
  messagingSenderId: "746944618600",
  appId: "1:746944618600:web:3d7d28e04d1f89d0db5bdd"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;