import {
  initializeApp,
  getApps,
  getApp,
  FirebaseOptions,
} from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

export type AuthResult = {
  ok: boolean;
  error?: "invalid_credentials" | "session_creation_failed" | "unknown_error" | "popup_closed" | "rate_limited";
};

async function createSession(idToken: string): Promise<AuthResult> {
  try {
    const response = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });

    if (!response.ok) {
      return { ok: false, error: "session_creation_failed" };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: "session_creation_failed" };
  }
}

export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const idToken = await userCredential.user.getIdToken();
    return createSession(idToken);
  } catch (error: any) {
    if (error.code === "auth/invalid-credential" || error.code === "auth/wrong-password" || error.code === "auth/user-not-found") {
      return { ok: false, error: "invalid_credentials" };
    }
    return { ok: false, error: "unknown_error" };
  }
}

export async function signInWithGoogle(): Promise<AuthResult> {
  try {
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    const idToken = await userCredential.user.getIdToken();
    return createSession(idToken);
  } catch (error: any) {
    if (error.code === "auth/popup-closed-by-user") {
      return { ok: false, error: "popup_closed" };
    }
    return { ok: false, error: "unknown_error" };
  }
}
