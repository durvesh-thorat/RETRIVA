
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// ------------------------------------------------------------------
// INSTRUCTIONS:
// 1. Go to Firebase Console > Project Settings > General
// 2. Scroll down to "Your apps" and copy the "firebaseConfig" object
// 3. Paste the values below
// ------------------------------------------------------------------

const firebaseConfig = {
  apiKey: "AIzaSyAIgzM-eqJFxuPN3mBOh1XLnWxlUKxCcA4",
  authDomain: "retriva-700f9.firebaseapp.com",
  projectId: "retriva-700f9",
  storageBucket: "retriva-700f9.firebasestorage.app",
  messagingSenderId: "654844686844",
  appId: "1:654844686844:web:0a07f0a02a84cfa4c04279",
  measurementId: "G-1VS8EVKFVK"
};
const app = initializeApp(firebaseConfig);

// Export authentication and database services
export const auth = getAuth(app);
export const db = getFirestore(app);
