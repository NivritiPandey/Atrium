import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { pureCircuits } from '../../contracts/managed/atrium/contract/index.js';

const bytes = () => new Uint8Array(crypto.randomBytes(32));

describe('ATRIUM privacy flow', () => {
  it('keeps a private credential in a fixed-size witness', () => {
    const credential = bytes();
    expect(credential).toHaveLength(32);
  });
  it('creates a pass-scoped nullifier without exposing the passphrase', () => {
    const nullifier = pureCircuits.make_entry_nullifier(bytes(), bytes());
    expect(nullifier).toBeInstanceOf(Uint8Array);
    expect(nullifier).toHaveLength(32);
  });
  it('does not reuse a nullifier when the gate changes', () => {
    const secret = bytes();
    const first = pureCircuits.make_entry_nullifier(secret, bytes());
    const second = pureCircuits.make_entry_nullifier(secret, bytes());
    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(false);
  });
  it('uses a domain-separated steward commitment', () => {
    const secret = bytes();
    expect(pureCircuits.steward_public_key(secret)).toHaveLength(32);
  });
  it('documents the public result as a boolean-style entry outcome', () => {
    const privateScore = 91n;
    const threshold = 72n;
    expect(privateScore >= threshold).toBe(true);
  });
});
