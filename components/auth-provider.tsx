'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from '@/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  role: 'admin' | 'driver' | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, role: null, loading: true });

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'admin' | 'driver' | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setRole(userData.role);
          } else {
            // Check if it's the default admin
            if (currentUser.email === 'ayushwagh1st@gmail.com' && currentUser.emailVerified) {
              const newAdmin = {
                uid: currentUser.uid,
                email: currentUser.email,
                role: 'admin',
                name: currentUser.displayName || 'Admin',
              };
              await setDoc(userDocRef, newAdmin);
              setRole('admin');
            } else {
              // Default to driver if not admin, but they need to be approved/created by admin ideally.
              // For now, if they don't exist, we just set role to null and they can't access much.
              setRole(null);
            }
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
        }
      } else {
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!loading) {
      // Allow unauthenticated access to parent portal
      if (pathname.startsWith('/parent')) return;

      if (!user && pathname !== '/') {
        router.push('/');
      } else if (user && pathname === '/') {
        if (role === 'admin') {
          router.push('/admin');
        } else if (role === 'driver') {
          router.push('/driver');
        }
      } else if (user && role) {
        if (pathname.startsWith('/admin') && role !== 'admin') {
          router.push('/driver');
        } else if (pathname.startsWith('/driver') && role !== 'driver') {
          router.push('/admin');
        }
      }
    }
  }, [user, role, loading, pathname, router]);

  return (
    <AuthContext.Provider value={{ user, role, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
