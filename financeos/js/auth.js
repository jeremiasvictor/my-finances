// ─────────────────────────────────────────────────────────────────────────────
// js/auth.js  –  Authentication logic
// ─────────────────────────────────────────────────────────────────────────────

import { auth } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/** Subscribe to auth changes. Callback receives user | null. */
export function onAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

/** Create account and return user. */
export async function register(email, password) {
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  return user;
}

/** Sign in and return user. */
export async function login(email, password) {
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  return user;
}

/** Sign out current user. */
export async function logout() {
  await signOut(auth);
}
