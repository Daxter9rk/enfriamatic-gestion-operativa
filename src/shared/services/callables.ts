import { getFirebaseServices, usesFirebaseEmulators } from './firebase';

let functionsConnected = false;

export async function callBackend<TInput, TOutput>(name: string, input: TInput): Promise<TOutput> {
  const { connectFunctionsEmulator, getFunctions, httpsCallable } =
    await import('firebase/functions');
  const { app } = getFirebaseServices();
  const functions = getFunctions(app, 'us-central1');
  if (usesFirebaseEmulators() && !functionsConnected) {
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
    functionsConnected = true;
  }
  const callable = httpsCallable<TInput, TOutput>(functions, name);
  const response = await callable(input);
  return response.data;
}
