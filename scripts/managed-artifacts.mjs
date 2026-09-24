import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const managed = resolve(root, 'contracts/managed/atrium');
export const source = resolve(root, 'contracts/atrium.compact');
const manifestName = 'atrium-artifacts.json';
const circuitNames = ['prove_entry', 'rotate_gate', 'close_gate', 'open_gate'];
export const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');

export function filesBelow(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory() ? filesBelow(join(directory, entry.name), name) : [name];
  }).sort();
}

function requireArtifacts(directory) {
  const required = ['contract/index.js', 'contract/index.d.ts', 'contract/index.js.map', 'compiler/contract-info.json'];
  for (const name of circuitNames) {
    required.push(`keys/${name}.prover`, `keys/${name}.verifier`, `zkir/${name}.bzkir`, `zkir/${name}.zkir`);
  }
  for (const relative of required) {
    const file = resolve(directory, relative);
    if (!existsSync(file) || !statSync(file).isFile() || !statSync(file).size) {
      throw new Error(`Missing or empty generated artifact: ${file}. Run npm run compile (without --skip-zk).`);
    }
  }
  const info = JSON.parse(readFileSync(resolve(directory, 'compiler/contract-info.json'), 'utf8'));
  if (info['compiler-version'] !== '0.31.1' || info['runtime-version'] !== '0.16.0') {
    throw new Error('ATRIUM requires Compact 0.31.1 / compact-runtime 0.16.0.');
  }
  const proofCircuits = info.circuits.filter((circuit) => circuit.proof).map((circuit) => circuit.name).sort();
  if (JSON.stringify(proofCircuits) !== JSON.stringify([...circuitNames].sort())) {
    throw new Error('Unexpected ATRIUM proof-circuit interface.');
  }
  return info;
}

// This manifest is authored by the build script, NOT a modification to compiler
// output. It detects stale source, changed keys and inconsistent browser copies.
export function writeArtifactManifest(directory, sourcePath) {
  const info = requireArtifacts(directory);
  const files = Object.fromEntries(filesBelow(directory).filter((name) => name !== manifestName).map((name) => [name, sha256(resolve(directory, name))]));
  writeFileSync(resolve(directory, manifestName), `${JSON.stringify({
    project: 'ATRIUM',
    source: 'contracts/atrium.compact',
    sourceSha256: sha256(sourcePath),
    compilerVersion: info['compiler-version'],
    runtimeVersion: info['runtime-version'],
    files,
  }, null, 2)}\n`);
}

export function verifyManagedArtifacts() {
  requireArtifacts(managed);
  const manifest = JSON.parse(readFileSync(resolve(managed, manifestName), 'utf8'));
  if (manifest.project !== 'ATRIUM' || manifest.sourceSha256 !== sha256(source)) {
    throw new Error('Compact source is newer than/different from the ATRIUM artifact manifest. Run npm run compile.');
  }
  const actualFiles = filesBelow(managed).filter((name) => name !== manifestName);
  if (JSON.stringify(actualFiles) !== JSON.stringify(Object.keys(manifest.files).sort())) {
    throw new Error('Generated file inventory does not match the ATRIUM artifact manifest.');
  }
  for (const [name, hash] of Object.entries(manifest.files)) {
    if (sha256(resolve(managed, name)) !== hash) throw new Error(`Generated artifact hash mismatch: ${name}`);
  }
  return actualFiles.length;
}

export function verifyCopy(from, to) {
  if (!existsSync(to)) throw new Error(`Missing generated asset copy: ${to}`);
  const expected = filesBelow(from);
  const actual = filesBelow(to);
  if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error(`Managed asset inventory mismatch: ${to}`);
  for (const name of expected) {
    if (sha256(resolve(from, name)) !== sha256(resolve(to, name))) throw new Error(`Stale generated asset copy: ${to}/${name}`);
  }
}
