import type { FirebaseOptions } from 'firebase/app';

type EnvironmentSource = Record<string, string | boolean | undefined>;

const requiredFirebaseKeys = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

export function readPublicEnvironment(source: EnvironmentSource): FirebaseOptions {
  if (source.VITE_APP_ENV !== 'dev') {
    throw new Error('VITE_APP_ENV debe ser dev durante este bootstrap.');
  }

  for (const key of requiredFirebaseKeys) {
    if (typeof source[key] !== 'string' || source[key].trim() === '') {
      throw new Error(`Falta la variable pública requerida: ${key}`);
    }
  }

  return {
    apiKey: source.VITE_FIREBASE_API_KEY as string,
    authDomain: source.VITE_FIREBASE_AUTH_DOMAIN as string,
    projectId: source.VITE_FIREBASE_PROJECT_ID as string,
    storageBucket: source.VITE_FIREBASE_STORAGE_BUCKET as string,
    messagingSenderId: source.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
    appId: source.VITE_FIREBASE_APP_ID as string,
  };
}
