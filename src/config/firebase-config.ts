// Import the functions you need from the SDKs you need
import { initializeApp, FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyDHwoTM2IwJ25gEEiZeu5Jadf-uK-N6EuA",
  authDomain: "is-my-red-your-red.firebaseapp.com",
  projectId: "is-my-red-your-red",
  storageBucket: "is-my-red-your-red.firebasestorage.app",
  messagingSenderId: "1017193475605",
  appId: "1:1017193475605:web:90748c59ccb35efe0d681c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);