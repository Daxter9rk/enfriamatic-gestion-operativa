import { onRequest } from 'firebase-functions/v2/https';
import { buildHealthStatus } from './health-status.js';

export { buildHealthStatus } from './health-status.js';

export const healthCheck = onRequest(
  {
    region: 'us-central1',
    cors: false,
    invoker: 'public',
    maxInstances: 2,
    timeoutSeconds: 10,
    memory: '256MiB',
  },
  (_request, response) => {
    response.status(200).json(buildHealthStatus());
  },
);

export { createServiceRequest } from './create-request.js';
export { getPrivateDownloadUrl, uploadPrivateFile } from './files.js';
export { assignServiceRequest } from './requests.js';
export { createQuoteRevision, issueQuote } from './quotes.js';
export { createManagedUser, updateManagedUser } from './users.js';
