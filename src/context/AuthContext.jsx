import { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../services/firebase.js';
import { account as fetchAccount } from '../services/henrik.js';
import {
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(() => {});

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const profileRef = doc(db, 'users', firebaseUser.email);
        const snap = await getDoc(profileRef);
        if (snap.exists()) {
          setUserProfile(snap.data());
        } else {
          const initial = {
            email: firebaseUser.email,
            displayName: firebaseUser.displayName ?? null,
            photoURL: firebaseUser.photoURL ?? null,
            riotId: null,
            createdAt: new Date().toISOString(),
          };
          await setDoc(profileRef, initial);
          setUserProfile(initial);
        }
      } else {
        setUserProfile(null);
      }
      setAuthLoading(false);
    });

    return unsub;
  }, []);

  async function signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
  }

  async function signUpWithEmail(email, password) {
    return createUserWithEmailAndPassword(auth, email, password);
  }

  async function signInWithEmail(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  async function signOut() {
    await firebaseSignOut(auth);
    setUser(null);
    setUserProfile(null);
  }

  async function linkRiotId(name, tag) {
    if (!user) return;
    const apiData = await fetchAccount(name, tag);
    const verified = { name: apiData.name, tag: apiData.tag };
    const profileRef = doc(db, 'users', user.email);
    const update = {
      riotId: verified,
      riotIdKey: `${verified.name}#${verified.tag}`.toLowerCase(),
      riotLinkedAt: new Date().toISOString(),
    };
    await updateDoc(profileRef, update);
    setUserProfile(prev => ({ ...prev, ...update }));
  }

  async function unlinkRiotId() {
    if (!user) return;
    const profileRef = doc(db, 'users', user.email);
    await updateDoc(profileRef, { riotId: null, riotIdKey: null });
    setUserProfile(prev => ({ ...prev, riotId: null, riotIdKey: null }));
  }

  async function addFriend(name, tag) {
    if (!user) return;
    const apiData = await fetchAccount(name, tag);
    const verified = { name: apiData.name, tag: apiData.tag };

    // Look up if this Riot ID belongs to an app user via the riotIdKey index
    const riotKey = `${verified.name}#${verified.tag}`.toLowerCase();
    const q = query(collection(db, 'users'), where('riotIdKey', '==', riotKey));
    const snap = await getDocs(q);
    const friendEmail = snap.empty ? null : snap.docs[0].id;

    const newFriend = { ...verified, email: friendEmail };
    const profileRef = doc(db, 'users', user.email);
    const currentFriends = userProfile?.friends ?? [];
    const updatedFriends = [...currentFriends, newFriend];
    await updateDoc(profileRef, { friends: updatedFriends });
    setUserProfile(prev => ({ ...prev, friends: updatedFriends }));
    return verified;
  }

  async function removeFriend(name, tag) {
    if (!user) return;
    const profileRef = doc(db, 'users', user.email);
    const updatedFriends = (userProfile?.friends ?? []).filter(
      f => !(f.name === name && f.tag === tag)
    );
    await updateDoc(profileRef, { friends: updatedFriends });
    setUserProfile(prev => ({ ...prev, friends: updatedFriends }));
  }

  return (
    <AuthContext.Provider value={{
      user,
      userProfile,
      authLoading,
      signInWithGoogle,
      signUpWithEmail,
      signInWithEmail,
      signOut,
      linkRiotId,
      unlinkRiotId,
      addFriend,
      removeFriend,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
