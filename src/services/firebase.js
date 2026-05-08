import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCTVcCal0nOAmvrHLE0-EWLiudJzMewo3k',
  authDomain: 'agentiq-16486.firebaseapp.com',
  projectId: 'agentiq-16486',
  storageBucket: 'agentiq-16486.firebasestorage.app',
  messagingSenderId: '137348035257',
  appId: '1:137348035257:web:71e6d45b6e50a324e4e168',
  measurementId: 'G-752Z542BWN',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
