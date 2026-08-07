import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';
import { readPublicEnvironment } from '../../app/config/env';

export function getFirebaseServices() {
  const app =
    getApps().length > 0 ? getApp() : initializeApp(readPublicEnvironment(import.meta.env));

  return {
    app,
    auth: getAuth(app),
    firestore: getFirestore(app),
    functions: getFunctions(app, 'us-central1'),
    storage: getStorage(app),
  };
}
