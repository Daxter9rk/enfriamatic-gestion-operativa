import { callBackend } from './callables';

export async function openPrivateDocument(documentId: string): Promise<void> {
  const response = await callBackend<
    { documentId: string },
    { base64: string; mimeType: string; fileName: string }
  >('downloadPrivateFile', { documentId });
  const bytes = Uint8Array.from(atob(response.base64), (character) => character.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: response.mimeType }));
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
