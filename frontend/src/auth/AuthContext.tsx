import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
  type User as FirebaseUser,
} from "firebase/auth";
import { auth } from "../firebase";
import { createUserProfile, getUserProfile } from "../db";
import type { Role, UserProfile } from "../types";

interface RegisterArgs {
  email: string;
  password: string;
  displayName: string;
  role: Role;
  organization?: string;
}

interface AuthValue {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  /** True until the initial auth state + profile have resolved. */
  loading: boolean;
  signIn(email: string, password: string): Promise<void>;
  register(args: RegisterArgs): Promise<void>;
  /** For the rare authed-but-no-profile case (e.g. interrupted register). */
  completeProfile(args: Omit<RegisterArgs, "email" | "password">): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

/** Translate Firebase Auth error codes into something a human can read. */
export function authErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/invalid-email":
      return "That email address looks invalid.";
    case "auth/email-already-in-use":
      return "An account already exists for that email. Try signing in.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Email or password is incorrect.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      return e instanceof Error ? e.message : "Something went wrong. Try again.";
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser);
      if (fbUser) {
        try {
          setProfile(await getUserProfile(fbUser.uid));
        } catch {
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      profile,
      loading,
      async signIn(email, password) {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      },
      async register({ email, password, displayName, role, organization }) {
        const cred = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );
        await updateProfile(cred.user, { displayName: displayName.trim() });
        await createUserProfile({
          uid: cred.user.uid,
          email: email.trim(),
          displayName: displayName.trim(),
          role,
          organization: organization?.trim() || undefined,
        });
        // Force a fresh ID token so the new auth session is fully propagated
        // before the board's listeners (whose rules do a get() on this very
        // user doc) attach — avoids a transient permission-denied on first load.
        await cred.user.getIdToken(true);
        setProfile(await getUserProfile(cred.user.uid));
      },
      async completeProfile({ displayName, role, organization }) {
        if (!auth.currentUser) throw new Error("Not signed in.");
        const u = auth.currentUser;
        await updateProfile(u, { displayName: displayName.trim() });
        await createUserProfile({
          uid: u.uid,
          email: u.email ?? "",
          displayName: displayName.trim(),
          role,
          organization: organization?.trim() || undefined,
        });
        setProfile(await getUserProfile(u.uid));
      },
      async signOut() {
        await fbSignOut(auth);
      },
    }),
    [user, profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
