import { readPublicEnvironment } from './env';

const validEnvironment = {
  VITE_APP_ENV: 'dev',
  VITE_FIREBASE_API_KEY: 'public-api-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'example.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'example-dev',
  VITE_FIREBASE_STORAGE_BUCKET: 'example-dev.firebasestorage.app',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '123456789',
  VITE_FIREBASE_APP_ID: '1:123456789:web:abc',
};

describe('readPublicEnvironment', () => {
  it('acepta una configuración pública DEV completa', () => {
    expect(readPublicEnvironment(validEnvironment)).toMatchObject({
      projectId: 'example-dev',
      appId: '1:123456789:web:abc',
    });
  });

  it('rechaza variables requeridas ausentes', () => {
    expect(() =>
      readPublicEnvironment({ ...validEnvironment, VITE_FIREBASE_PROJECT_ID: '' }),
    ).toThrow('VITE_FIREBASE_PROJECT_ID');
  });

  it('rechaza entornos distintos de DEV', () => {
    expect(() => readPublicEnvironment({ ...validEnvironment, VITE_APP_ENV: 'prod' })).toThrow(
      'debe ser dev',
    );
  });
});
