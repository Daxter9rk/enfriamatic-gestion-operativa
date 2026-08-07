import { getApp, getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import { connectStorageEmulator, getStorage } from 'firebase/storage';
import { readPublicEnvironment } from '../../app/config/env';

let emulatorsConnected = false;

export function getFirebaseServices() {
  const app =
    getApps().length > 0 ? getApp() : initializeApp(readPublicEnvironment(import.meta.env));

  const auth = getAuth(app);
  const firestore = getFirestore(app);
  const functions = getFunctions(app, 'us-central1');
  const storage = getStorage(app);

  if (import.meta.env.VITE_USE_EMULATORS === 'true' && !emulatorsConnected) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
    connectStorageEmulator(storage, '127.0.0.1', 9199);
    emulatorsConnected = true;
  }

  return { app, auth, firestore, functions, storage };
}
