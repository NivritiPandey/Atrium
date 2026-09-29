import { pureCircuits } from '../managed/contract/index.js';
import { fromHex, toHex } from './midnight';
import { onPrivateMemoryReset } from './private-memory';

export type PrivateIdentity = { secret: string; label: string; createdAt: number };
let sessionIdentity: PrivateIdentity | null = null;

function randomHex() { return toHex(crypto.getRandomValues(new Uint8Array(32))); }
export function getIdentity(): PrivateIdentity {
  if (!sessionIdentity) sessionIdentity = { secret: randomHex(), label: 'Private visitor credential', createdAt: Date.now() };
  return sessionIdentity;
}
export function saveIdentity(identity: PrivateIdentity) { sessionIdentity = identity; }
export function clearIdentity() {
  if (sessionIdentity) sessionIdentity.secret = '0'.repeat(64);
  sessionIdentity = null;
}
onPrivateMemoryReset(clearIdentity);
export function publicFingerprint(secret: string) {
  try { return toHex((pureCircuits as any).make_entry_nullifier(fromHex(secret), new Uint8Array(32))); } catch { return ''; }
}
export function sessionNullifier(secret: string, pass: Uint8Array) {
  return (pureCircuits as any).make_entry_nullifier(fromHex(secret), pass) as Uint8Array;
}
export function hasUsedPass(secret: string, state: any): boolean {
  if (!state?.access_pass_id) return false;
  const target = toHex(sessionNullifier(secret, state.access_pass_id));
  try {
    if (state.used_nullifiers?.member?.(fromHex(target))) return true;
    if (state.used_nullifiers?.[Symbol.iterator]) for (const value of state.used_nullifiers) if (toHex(value) === target) return true;
  } catch { return false; }
  return false;
}
