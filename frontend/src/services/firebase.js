import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as fbSignOut } from "firebase/auth";

const STORAGE_FIREBASE_CONFIG_KEY = "aiders_firebase_runtime_config";

/**
 * Returns active Firebase configuration from Vite environment variables or LocalStorage runtime override.
 */
export function getFirebaseConfig() {
  try {
    const custom = localStorage.getItem(STORAGE_FIREBASE_CONFIG_KEY);
    if (custom) {
      const parsed = JSON.parse(custom);
      if (parsed.apiKey && parsed.projectId) {
        return parsed;
      }
    }
  } catch {}

  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
  };
}

/**
 * Save Firebase config directly from browser UI so user doesn't need to rebuild or restart dev server.
 */
export function saveFirebaseRuntimeConfig(config) {
  if (!config || !config.apiKey || !config.projectId) {
    throw new Error("Invalid Firebase configuration. 'apiKey' and 'projectId' are required.");
  }
  localStorage.setItem(STORAGE_FIREBASE_CONFIG_KEY, JSON.stringify(config));
}

export function clearFirebaseRuntimeConfig() {
  localStorage.removeItem(STORAGE_FIREBASE_CONFIG_KEY);
}

/**
 * Checks if Firebase has valid keys set
 */
export function isFirebaseConfigured() {
  const config = getFirebaseConfig();
  return Boolean(
    config.apiKey &&
      config.apiKey.length > 10 &&
      !config.apiKey.includes("your-") &&
      config.projectId &&
      !config.projectId.includes("your-")
  );
}

let firebaseApp = null;
let firebaseAuth = null;
let googleProvider = null;

export function getFirebaseAuth() {
  const config = getFirebaseConfig();
  if (!config.apiKey || !config.projectId) {
    return null;
  }

  try {
    if (!getApps().length) {
      firebaseApp = initializeApp(config);
    } else {
      firebaseApp = getApp();
    }
    if (!firebaseAuth) {
      firebaseAuth = getAuth(firebaseApp);
    }
    if (!googleProvider) {
      googleProvider = new GoogleAuthProvider();
      googleProvider.setCustomParameters({
        prompt: "select_account",
      });
    }
    return { app: firebaseApp, auth: firebaseAuth, provider: googleProvider };
  } catch (err) {
    console.error("Firebase init failed:", err);
    return null;
  }
}

/**
 * Trigger Real Google Sign-In with Firebase Popup
 */
export async function signInWithGoogleFirebase() {
  const fb = getFirebaseAuth();
  if (!fb) {
    throw new Error(
      "Firebase is not configured. Please paste your Firebase keys in the settings or add them to frontend/.env."
    );
  }

  const result = await signInWithPopup(fb.auth, fb.provider);
  const user = result.user;

  return {
    uid: user.uid,
    displayName: user.displayName || "Verified User",
    email: user.email,
    photoURL: user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.displayName || "User")}`,
    emailVerified: user.emailVerified,
    idToken: await user.getIdToken(),
  };
}

export async function firebaseSignOut() {
  const fb = getFirebaseAuth();
  if (fb?.auth) {
    await fbSignOut(fb.auth);
  }
}

