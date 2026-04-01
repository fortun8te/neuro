import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile, type User } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

// Debug: log if Firebase config is missing
if (!firebaseConfig.apiKey && typeof window !== 'undefined') {
  console.warn('[Firebase] Configuration missing. Set VITE_FIREBASE_* env vars for cloud features. Falling back to local-only mode.');
}

// Only initialize if config is present
let app = null;
let auth = null;
let googleProvider = null;

try {
  if (firebaseConfig.apiKey) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
  }
} catch (error) {
  console.error('[Firebase] Initialization failed:', error);
  // Fall back to local-only mode
  app = null;
  auth = null;
  googleProvider = null;
}

export async function firebaseLoginWithGoogle() {
  if (!auth) throw new Error('Firebase not configured. Set VITE_FIREBASE_* env vars.');
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function firebaseLoginWithEmail(email: string, password: string) {
  if (!auth) throw new Error('Firebase not configured.');
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (err: any) {
    if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
      throw new Error('Account not found. Please sign up first.');
    }
    if (err.code === 'auth/wrong-password') {
      throw new Error('Wrong password. Please try again.');
    }
    if (err.code === 'auth/too-many-requests') {
      throw new Error('Too many attempts. Please try again later.');
    }
    throw err;
  }
}

export async function firebaseSignupWithEmail(email: string, password: string, displayName?: string) {
  if (!auth) throw new Error('Firebase not configured.');
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      await updateProfile(result.user, { displayName });
    }
    return result.user;
  } catch (err: any) {
    if (err.code === 'auth/email-already-in-use') {
      throw new Error('An account with this email already exists. Please log in instead.');
    }
    if (err.code === 'auth/weak-password') {
      throw new Error('Password is too weak. Please use a stronger password.');
    }
    throw err;
  }
}

export async function firebaseSignOut() {
  if (auth) await signOut(auth);
}

export function onFirebaseAuthChange(callback: (user: User | null) => void) {
  if (!auth) { callback(null); return () => {}; }
  return onAuthStateChanged(auth, callback);
}

export { auth };
export type { User as FirebaseUser };
