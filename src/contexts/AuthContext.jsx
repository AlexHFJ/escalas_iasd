import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [userRole, setUserRole] = useState(null); // { role: 'admin'|'director', ministry: string|null, name: string }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const roleSnap = await getDoc(doc(db, 'users', u.uid));
        if (roleSnap.exists()) {
          setUserRole(roleSnap.data());
        } else {
          // Primeiro login: verifica se já existe algum admin
          const adminSnap = await getDoc(doc(db, 'config', 'adminSetup'));
          if (!adminSnap.exists()) {
            // Primeiro usuário do sistema vira admin automaticamente
            const adminData = { role: 'admin', ministry: null, email: u.email, name: u.email };
            await setDoc(doc(db, 'users', u.uid), adminData);
            await setDoc(doc(db, 'config', 'adminSetup'), { adminUid: u.uid });
            setUserRole(adminData);
          } else {
            // Usuário sem perfil definido ainda — aguarda o admin liberar
            setUserRole({ role: 'pending', ministry: null, email: u.email });
          }
        }
      } else {
        setUserRole(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const login  = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const logout = () => signOut(auth);

  const isAdmin    = userRole?.role === 'admin';
  const isDirector = userRole?.role === 'director';
  const isPending  = userRole?.role === 'pending';
  const allowedMinistry = isAdmin ? null : userRole?.ministry; // null = acesso total

  return (
    <AuthContext.Provider value={{ user, userRole, loading, login, logout, isAdmin, isDirector, isPending, allowedMinistry }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
