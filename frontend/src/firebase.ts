// Firebase client initialization.
//
// These config values are PUBLIC, browser-safe identifiers (not secrets) —
// Firebase ships them to every web client. Access is enforced by Firebase
// Auth + Firestore security rules (see ../../firestore.rules), not by hiding
// these keys. Pulled from the `Lyzr Underwriting Web` app registered in the
// `lyzr-ai-demo` project (`firebase apps:sdkconfig WEB`).
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore } from "firebase/firestore";

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

// Initialize Firestore with auto-detected long-polling instead of the default
// streaming WebChannel transport.
//
// On some networks — corporate proxies, VPNs, ad-blockers, certain dev setups —
// the WebChannel stream never establishes cleanly: the browser logs a flood of
// `Fetch failed loading: …/Listen/channel` / `…/Write/channel`, live listeners
// (the board, the underwriting progress view) silently stall, and writes hang.
// Auto-detect transparently falls back to long-polling on exactly those
// networks while keeping the faster stream where it works, so onSnapshot stays
// connected and the crew console updates reliably.
//
// `initializeFirestore` may only be called once per app; the try/catch keeps
// Vite HMR (which can re-evaluate this module) from throwing — on a re-run we
// just reuse the already-initialized instance.
function createDb() {
  try {
    return initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  } catch {
    return getFirestore(app);
  }
}

export const db = createDb();
