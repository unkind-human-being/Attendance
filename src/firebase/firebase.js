import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your actual Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCl7QIk-ag61ffM1yJKYLU4qaARZvNCEgY",
  authDomain: "smartpta-attendance.firebaseapp.com",
  projectId: "smartpta-attendance",
  storageBucket: "smartpta-attendance.firebasestorage.app",
  messagingSenderId: "1035641084614",
  appId: "1:1035641084614:web:8360fc07294128c40595c7",
  measurementId: "G-C3BZ4X7413"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firebase Services
export const auth = getAuth(app);
export const db = getFirestore(app);

// Safely initialize Analytics (only in supported browser environments)
export let analytics;
isSupported().then((supported) => {
  if (supported) {
    analytics = getAnalytics(app);
  }
});

export default app;