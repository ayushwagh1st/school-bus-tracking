import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const createSecondaryUser = async (email: string, password: string) => {
  // Initialize a secondary app to avoid logging out the current user
  const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
  const secondaryAuth = getAuth(secondaryApp);
  
  try {
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const uid = userCredential.user.uid;
    await signOut(secondaryAuth);
    return uid;
  } catch (error) {
    console.error("Error creating secondary user:", error);
    throw error;
  }
};
