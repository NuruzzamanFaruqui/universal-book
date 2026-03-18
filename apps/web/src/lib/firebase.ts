import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyDaCyC4Q8FIjsqXaZCdMp2-SEBhDh57tPM",
  authDomain: "universal-book-levin.firebaseapp.com",
  projectId: "universal-book-levin",
  storageBucket: "universal-book-levin.firebasestorage.app",
  messagingSenderId: "634689916243",
  appId: "1:634689916243:web:725f605604d3f9eb4465a6",
  databaseURL: "https://universal-book-24-365-default-rtdb.firebaseio.com",
};

const app = typeof window !== 'undefined' && !getApps().length
  ? initializeApp(firebaseConfig)
  : getApps()[0] || initializeApp(firebaseConfig);

export const auth = typeof window !== 'undefined' ? getAuth(app) : null;
export const database = typeof window !== 'undefined' ? getDatabase(app) : null;
export default app;
