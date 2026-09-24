import { cpSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { managed, verifyCopy, verifyManagedArtifacts } from './managed-artifacts.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
verifyManagedArtifacts();
const copy = (source, target) => {
  rmSync(target, { recursive: true, force: true });
  cpSync(source, target, { recursive: true });
  verifyCopy(source, target);
};

// The source-tree copy only needs the generated contract binding. Public assets
// include the entire compiler output (keys, ZKIR, metadata) for browser proving.
rmSync(resolve(root, 'frontend/src/managed'), { recursive: true, force: true });
copy(resolve(managed, 'contract'), resolve(root, 'frontend/src/managed/contract'));
copy(managed, resolve(root, 'frontend/public/managed'));
console.log(`Copied verified ATRIUM managed assets from ${managed}`);
