import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '../config/firebase';
import type { User, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>({
    email: 'tamu@paroki.org',
    role: 'VIEWER',
    displayName: 'Umat / Tamu'
  });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser && fbUser.email) {
        try {
          const cleanEmail = fbUser.email.trim().toLowerCase();
          const emailDocId = cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');

          // 1. Check primary email-keyed document
          const emailDocRef = doc(db, 'users', emailDocId);
          const emailSnap = await getDoc(emailDocRef);

          // 2. Also check legacy UID document if any
          const uidDocRef = doc(db, 'users', fbUser.uid);
          const uidSnap = await getDoc(uidDocRef);

          let role: UserRole = 'VIEWER';
          let displayName = fbUser.displayName || fbUser.email;

          if (emailSnap.exists()) {
            const data = emailSnap.data();
            role = (data.role as UserRole) || 'VIEWER';
            if (data.display_name && data.display_name !== cleanEmail) {
              displayName = data.display_name;
            }
          } else if (uidSnap.exists()) {
            const data = uidSnap.data();
            role = (data.role as UserRole) || 'VIEWER';
            if (data.display_name) displayName = data.display_name;
          } else {
            // First time login with no prior config:
            // Check if superadmin by email
            const isSuperAdmin = ['aloysiuz@gmail.com', 'timmusik.parokiboyolali@gmail.com'].includes(cleanEmail);
            role = isSuperAdmin ? 'ADMIN' : 'VIEWER';
          }

          // Save/Sync to primary email document in Firestore
          await setDoc(
            emailDocRef,
            {
              uid: fbUser.uid,
              email: cleanEmail,
              display_name: displayName,
              role: role,
              photo_url: fbUser.photoURL || null,
              last_login: new Date().toISOString(),
              updated_at: new Date().toISOString()
            },
            { merge: true }
          );

          setUser({
            email: cleanEmail,
            role,
            displayName
          });
        } catch (error) {
          console.warn('[AUTH] Firestore user sync notice:', error);
          setUser({
            email: fbUser.email,
            role: 'VIEWER',
            displayName: fbUser.displayName || fbUser.email
          });
        }
      } else {
        // Not logged in: Default to VIEWER (Public Guest)
        setUser({
          email: 'tamu@paroki.org',
          role: 'VIEWER',
          displayName: 'Umat / Tamu'
        });
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('[AUTH ERROR] Google Sign-In failed:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('[AUTH ERROR] Sign-out failed:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}