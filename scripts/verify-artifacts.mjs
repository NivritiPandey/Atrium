import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { managed, verifyCopy, verifyManagedArtifacts } from './managed-artifacts.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const count = verifyManagedArtifacts();
verifyCopy(resolve(managed, 'contract'), resolve(root, 'frontend/src/managed/contract'));
verifyCopy(managed, resolve(root, 'frontend/public/managed'));
console.log(`ATRIUM generated artifacts verified (${count} files, four prover/verifier key pairs, and both frontend copies).`);
