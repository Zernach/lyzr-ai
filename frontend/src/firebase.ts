// Firebase client initialization.
//
// These config values are PUBLIC, browser-safe identifiers (not secrets) —
// Firebase ships them to every web client. Access is enforced by Firebase
// Auth + Firestore security rules (see ../../firestore.rules), not by hiding
// these keys. Pulled from the `Lyzr Underwriting Web` app registered in the
// `lyzr-ai-demo` project (`firebase apps:sdkconfig WEB`).
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCM_giorv3p0xJsuzA7VNRbyF5d9vekpDM",
  authDomain: "lyzr-ai-demo.firebaseapp.com",
  projectId: "lyzr-ai-demo",
  storageBucket: "lyzr-ai-demo.firebasestorage.app",
  messagingSenderId: "935840122491",
  appId: "1:935840122491:web:0f22758e701ed7c65b44de",
} as const;

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
