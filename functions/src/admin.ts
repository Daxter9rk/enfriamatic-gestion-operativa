import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const app = getApps()[0] ?? initializeApp();

export const adminAuth = getAuth(app);
export const db = getFirestore(app);
type AdminStorage = ReturnType<typeof getStorage>;
const configuredBucket =
  process.env.FIREBASE_STORAGE_BUCKET ??
  `${process.env.GCLOUD_PROJECT ?? 'enfriamatic-operativa-dev'}.firebasestorage.app`;
export const bucket: ReturnType<AdminStorage['bucket']> = getStorage(app).bucket(configuredBucket);
