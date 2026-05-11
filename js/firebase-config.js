// ─────────────────────────────────────────────────────────────────────────────
// firebase-config.js
// Replace the placeholder values below with your Firebase project credentials.
// Find them at: Firebase Console → Project Settings → General → Your Apps → SDK setup
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBeCAVW2Jr8mtSS5mBId6Scq5hVhSDD5Eg",
  authDomain: "meu-financeiro-b02d6.firebaseapp.com",
  projectId: "meu-financeiro-b02d6",
  storageBucket: "meu-financeiro-b02d6.firebasestorage.app",
  messagingSenderId: "632686853797",
  appId: "1:632686853797:web:8599886936a830fdd4974c",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
