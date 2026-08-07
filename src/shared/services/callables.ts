import { httpsCallable } from 'firebase/functions';
import { getFirebaseServices } from './firebase';

export async function callBackend<TInput, TOutput>(name: string, input: TInput): Promise<TOutput> {
  const { functions } = getFirebaseServices();
  const callable = httpsCallable<TInput, TOutput>(functions, name);
  const response = await callable(input);
  return response.data;
}
