// ============================================================================
// Firebase Auth Hook — PerfortAlmox
// ============================================================================
// Provides Firebase Authentication integration while maintaining
// compatibility with the existing LoginOverlay component interface.
//
// When Firebase is not configured, falls back to localStorage auth.
//
// Usage in App.tsx or LoginOverlay:
//   const { signIn, signOutUser, currentUser, isFirebaseAuth } = useFirebaseAuth();
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth, hasRealConfig } from '../lib/firebase';
import { getUsers, getCurrentSession, setCurrentSession, saveUsers } from '../lib/storage';
import type { User as AppUser } from '../types';

export interface FirebaseAuthState {
  /** Current app-level session (works with both Firebase & localStorage) */
  session: { username: string; role: string; permissoes: string[] } | null;
  /** Current Firebase user (null if using localStorage auth) */
  firebaseUser: FirebaseUser | null;
  /** Whether Firebase Auth is active */
  isFirebaseAuth: boolean;
  /** Sign in with email/password (Firebase) or username/password (localStorage) */
  signIn: (emailOrUsername: string, password: string) => Promise<boolean>;
  /** Sign out */
  signOutUser: () => Promise<void>;
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
}

export function useFirebaseAuth(): FirebaseAuthState {
  const [session, setSession] = useState<{
    username: string;
    role: string;
    permissoes: string[];
  } | null>(getCurrentSession());
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Listen to Firebase Auth state changes
  useEffect(() => {
    if (!auth || !hasRealConfig) return;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (user) {
        // Map Firebase user to app session
        const email = user.email || '';
        const appUsers = getUsers();
        const matchedUser = appUsers.find(
          (u) => u.email === email || u.username === email
        );

        if (matchedUser) {
          const appSession = {
            username: matchedUser.username,
            role: matchedUser.role,
            permissoes: matchedUser.permissoes || [],
          };
          setCurrentSession(appSession);
          setSession(appSession);
        } else {
          // Firebase user exists but no matching app user — create a default one
          const newAppUser: AppUser = {
            username: email.split('@')[0],
            role: 'Operador',
            email,
            permissoes: [],
          };
          const updated = [...getUsers(), newAppUser];
          saveUsers(updated);
          const appSession = {
            username: newAppUser.username,
            role: newAppUser.role,
            permissoes: [],
          };
          setCurrentSession(appSession);
          setSession(appSession);
        }
      } else {
        // Firebase user signed out
        setCurrentSession(null);
        setSession(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const signInFn = useCallback(
    async (emailOrUsername: string, password: string): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        if (auth && hasRealConfig) {
          // Firebase Auth path
          const email = emailOrUsername.includes('@')
            ? emailOrUsername
            : `${emailOrUsername}@perfort.com.br`; // default domain

          await signInWithEmailAndPassword(auth, email, password);
          // onAuthStateChanged will update the session
          return true;
        } else {
          // localStorage fallback (original behavior)
          const users = getUsers();
          const user = users.find(
            (u) =>
              u.username === emailOrUsername &&
              u.password === password
          );

          if (user) {
            const appSession = {
              username: user.username,
              role: user.role,
              permissoes: user.permissoes || [],
            };
            setCurrentSession(appSession);
            setSession(appSession);
            return true;
          }

          setError('Usuário ou senha inválidos');
          return false;
        }
      } catch (err: any) {
        console.error('[FirebaseAuth] Sign-in error:', err);
        // Fall back to localStorage auth if Firebase fails
        const users = getUsers();
        const user = users.find(
          (u) =>
            u.username === emailOrUsername &&
            u.password === password
        );

        if (user) {
          const appSession = {
            username: user.username,
            role: user.role,
            permissoes: user.permissoes || [],
          };
          setCurrentSession(appSession);
          setSession(appSession);
          return true;
        }

        setError(
          err?.code === 'auth/invalid-credential' ||
          err?.code === 'auth/wrong-password' ||
          err?.code === 'auth/user-not-found'
            ? 'Usuário ou senha inválidos'
            : 'Erro ao fazer login. Tente novamente.'
        );
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const signOutFn = useCallback(async (): Promise<void> => {
    try {
      if (auth && hasRealConfig) {
        await signOut(auth);
      }
      setCurrentSession(null);
      setSession(null);
      setFirebaseUser(null);
    } catch (err) {
      console.error('[FirebaseAuth] Sign-out error:', err);
      setCurrentSession(null);
      setSession(null);
    }
  }, []);

  return {
    session,
    firebaseUser,
    isFirebaseAuth: hasRealConfig && !!auth,
    signIn: signInFn,
    signOutUser: signOutFn,
    loading,
    error,
  };
}
