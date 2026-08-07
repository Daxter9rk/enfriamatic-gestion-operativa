import { readFile } from 'node:fs/promises';
import { assertFails, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getBytes, ref, uploadBytes } from 'firebase/storage';
import { afterAll, beforeAll, describe, it } from 'vitest';

const projectId = 'enfriamatic-operativa-rules-test';
let testEnvironment: Awaited<ReturnType<typeof initializeTestEnvironment>>;

beforeAll(async () => {
  const [firestoreRules, storageRules] = await Promise.all([
    readFile('firestore.rules', 'utf8'),
    readFile('storage.rules', 'utf8'),
  ]);

  testEnvironment = await initializeTestEnvironment({
    projectId,
    firestore: { rules: firestoreRules, host: '127.0.0.1', port: 8080 },
    storage: { rules: storageRules, host: '127.0.0.1', port: 9199 },
  });
});

afterAll(async () => {
  await testEnvironment.cleanup();
});

describe('reglas deny-by-default', () => {
  it('deniega lectura y escritura anónimas en Firestore', async () => {
    const firestore = testEnvironment.unauthenticatedContext().firestore();
    const target = doc(firestore, 'bootstrap/probe');

    await assertFails(getDoc(target));
    await assertFails(setDoc(target, { fictitious: true }));
  });

  it('deniega lectura y escritura anónimas en Storage', async () => {
    const storage = testEnvironment.unauthenticatedContext().storage();
    const target = ref(storage, 'bootstrap/probe.txt');

    await assertFails(getBytes(target));
    await assertFails(uploadBytes(target, new Uint8Array([0])));
  });
});
