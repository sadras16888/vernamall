import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// این چند خط رو با کلیدهایی که از کنسول Firebase گرفتی جایگزین کن.
// (توضیح کامل مرحله‌به‌مرحله توی فایل README.md هست)
const firebaseConfig = {
  apiKey: 'AIzaSyDcx1AEGSLR7OL2rDBASVUobOBompS9NUM',
  authDomain: 'vernamall-1baf4.firebaseapp.com',
  projectId: 'vernamall-1baf4',
  storageBucket: 'vernamall-1baf4.firebasestorage.app',
  messagingSenderId: '1092175083848',
  appId: '1:1092175083848:web:079a08a6ea1096d37e5b7d',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
