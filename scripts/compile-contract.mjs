import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { writeArtifactManifest } from './managed-artifacts.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const source = resolve(root, 'contracts/atrium.compact');
const target = resolve(root, 'contracts/managed/atrium');
const compilerVersion = '0.31.1';
const wslPath = (value) => value.replace(/^([A-Za-z]):/, (_, drive) => `/mnt/${drive.toLowerCase()}`).replaceAll('\\', '/');
const candidates = [];
if (process.env.COMPACTC) candidates.push({ command: process.env.COMPACTC, args: [], path: (value) => value });
candidates.push({ command: 'compactc', args: [], path: (value) => value });
if (process.platform === 'win32') {
  // Never run Windows compact.exe: it compresses files and is NOT a compiler.
  // A login shell loads the Linux user's PATH. No developer-specific home path.
  const distro = process.env.COMPACT_WSL_DISTRO ? ['-d', process.env.COMPACT_WSL_DISTRO] : [];
  const discovery = spawnSync('wsl.exe', [...distro, '--', 'bash', '-lc', 'export PATH="$HOME/.local/bin:$PATH"; command -v compact'], { encoding: 'utf8', timeout: 30_000 });
  const executable = discovery.stdout?.trim();
  if (discovery.status === 0 && executable?.startsWith('/')) {
    candidates.push({ command: 'wsl.exe', args: [...distro, '--', executable, 'compile', `+${compilerVersion}`], path: wslPath });
  }
} else {
  candidates.push({ command: 'compact', args: ['compile', `+${compilerVersion}`], path: (value) => value });
}

if (!existsSync(source)) throw new Error(`Missing Compact source: ${source}`);
const compiler = candidates.find(({ command, args }) => {
  const probe = spawnSync(command, [...args, '--version'], { cwd: root, encoding: 'utf8', timeout: 30_000 });
  return probe.status === 0 && probe.stdout.trim() === compilerVersion;
});
if (!compiler) {
  throw new Error(`Compact compiler ${compilerVersion} not found. Install with 'compact update ${compilerVersion}'. On Windows use WSL (optionally COMPACT_WSL_DISTRO), or set COMPACTC to the actual compiler. Windows compact.exe is not supported.`);
}

mkdirSync(resolve(root, 'contracts/managed'), { recursive: true });
const staging = mkdtempSync(resolve(root, 'contracts/managed/.atrium-'));
try {
  console.log(`Compiling ATRIUM with Compact ${compilerVersion} (including all proving/verifier keys).`);
  // No --skip-zk: absent keys cause the manifest validation below to fail.
  const result = spawnSync(compiler.command, [...compiler.args, compiler.path(source), compiler.path(staging)], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`Compact compilation failed (${result.status ?? result.error?.message}). Existing artifacts were preserved.`);
  writeArtifactManifest(staging, source);
  rmSync(target, { recursive: true, force: true });
  renameSync(staging, target);
} finally {
  rmSync(staging, { recursive: true, force: true });
}
