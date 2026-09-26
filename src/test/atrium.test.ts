import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import {
  createCircuitContext,
  createConstructorContext,
  dummyContractAddress,
  sampleUserAddress,
} from '@midnight-ntwrk/compact-runtime';
import { Contract, ledger, pureCircuits } from '../../contracts/managed/atrium/contract/index.js';

const bytes = () => new Uint8Array(crypto.randomBytes(32));
const zeroBytes = () => new Uint8Array(32);
const NOW = 2_000_000_000;

type Harness = {
  contract: Contract;
  state: any;
  stewardSecret: Uint8Array;
  pass: Uint8Array;
  context: (time?: number) => any;
};

const harness = (options: { threshold?: bigint; limit?: bigint; deadline?: bigint } = {}): Harness => {
  const contractAddress = dummyContractAddress();
  const userAddress = sampleUserAddress();
  const stewardSecret = bytes();
  const pass = bytes();
  const contract = new Contract({
    get_eligibility_score: () => [{}, 90n],
    get_passphrase: () => [{}, bytes()],
    steward_secret: () => [{}, stewardSecret],
  } as any);
  const threshold = options.threshold ?? 72n;
  const deadline = options.deadline ?? BigInt(NOW + 86_400);
  const limit = options.limit ?? 10n;
  const state = contract.initialState(
    createConstructorContext({}, userAddress),
    threshold,
    pass,
    deadline,
    bytes(),
    pureCircuits.steward_public_key(stewardSecret),
    limit,
  ).currentContractState.data;
  const result = { contract, state, stewardSecret, pass, context: (time = NOW) => createCircuitContext(contractAddress, userAddress, undefined as any, {}, undefined, undefined, time) } as Harness;
  result.context = (time = NOW) => createCircuitContext(contractAddress, userAddress, result.state, {}, undefined, undefined, time);
  return result;
};

const setWitnesses = (h: Harness, score: bigint, passphrase: Uint8Array, stewardSecret = h.stewardSecret) => {
  h.contract.witnesses = {
    get_eligibility_score: () => [{}, score],
    get_passphrase: () => [{}, passphrase],
    steward_secret: () => [{}, stewardSecret],
  } as any;
};

const apply = (h: Harness, result: any) => {
  h.state = result.context.currentQueryContext.state;
};

describe('ATRIUM Compact contract', () => {
  it('initializes the public gate and lifetime counters', () => {
    const h = harness({ threshold: 72n, limit: 10n });
    const value = ledger(h.state);
    expect(value.entry_threshold).toBe(72n);
    expect(value.gate_open).toBe(true);
    expect(value.total_entries).toBe(0n);
    expect(value.entry_limit).toBe(10n);
    expect(value.edition).toEqual(new TextEncoder().encode('ATRIUM:v1'.padEnd(32, '\0')));
  });

  it('rejects an empty pass identifier at construction', () => {
    expect(() => harness({})).not.toThrow();
    const contract = new Contract({ get_eligibility_score: () => [{}, 90n], get_passphrase: () => [{}, bytes()], steward_secret: () => [{}, bytes()] } as any);
    expect(() => contract.initialState(createConstructorContext({}, sampleUserAddress()), 1n, zeroBytes(), BigInt(NOW + 1), bytes(), bytes(), 1n)).toThrow(/Pass identifier/);
  });

  it('rejects zero thresholds, capacities, and curator identifiers at construction', () => {
    const create = (threshold: bigint, curator = bytes(), limit = 1n) => {
      const secret = bytes();
      const contract = new Contract({ get_eligibility_score: () => [{}, 90n], get_passphrase: () => [{}, bytes()], steward_secret: () => [{}, secret] } as any);
      return () => contract.initialState(createConstructorContext({}, sampleUserAddress()), threshold, bytes(), BigInt(NOW + 1), curator, pureCircuits.steward_public_key(secret), limit);
    };
    expect(create(0n)).toThrow(/Threshold/);
    expect(create(1n, bytes(), 0n)).toThrow(/capacity/);
    expect(create(1n, zeroBytes())).toThrow(/Curator/);
  });

  it('accepts a self-asserted eligible score and increments lifetime entries', () => {
    const h = harness();
    const secret = bytes();
    setWitnesses(h, 72n, secret);
    apply(h, h.contract.circuits.prove_entry(h.context()));
    expect(ledger(h.state).total_entries).toBe(1n);
    expect(ledger(h.state).used_nullifiers.member(pureCircuits.make_entry_nullifier(secret, h.pass))).toBe(true);
  });

  it('rejects a self-asserted score below the threshold', () => {
    const h = harness();
    setWitnesses(h, 71n, bytes());
    expect(() => h.contract.circuits.prove_entry(h.context())).toThrow(/Eligibility threshold/);
    expect(ledger(h.state).total_entries).toBe(0n);
  });

  it('does not treat score zero as eligible when a positive threshold is configured', () => {
    const h = harness({ threshold: 1n });
    setWitnesses(h, 0n, bytes());
    expect(() => h.contract.circuits.prove_entry(h.context())).toThrow(/Eligibility threshold/);
  });

  it('rejects the same private passphrase twice for the same pass', () => {
    const h = harness();
    const secret = bytes();
    setWitnesses(h, 90n, secret);
    apply(h, h.contract.circuits.prove_entry(h.context()));
    setWitnesses(h, 90n, secret);
    expect(() => h.contract.circuits.prove_entry(h.context())).toThrow(/already been used/);
    expect(ledger(h.state).total_entries).toBe(1n);
  });

  it('rejects entry after the deadline', () => {
    const h = harness({ deadline: BigInt(NOW + 10) });
    setWitnesses(h, 90n, bytes());
    expect(() => h.contract.circuits.prove_entry(h.context(NOW + 11))).toThrow(/expired/);
  });

  it('rejects entry while the gate is closed', () => {
    const h = harness();
    setWitnesses(h, 90n, bytes());
    apply(h, h.contract.circuits.close_gate(h.context()));
    expect(() => h.contract.circuits.prove_entry(h.context())).toThrow(/gate is closed/i);
  });

  it('enforces the lifetime capacity rather than resetting it on rotation', () => {
    const h = harness({ limit: 1n });
    setWitnesses(h, 90n, bytes());
    apply(h, h.contract.circuits.prove_entry(h.context()));
    setWitnesses(h, 90n, h.pass, h.stewardSecret);
    expect(() => h.contract.circuits.prove_entry(h.context())).toThrow(/capacity/i);
  });

  it('requires steward authorization for close, open, and rotation', () => {
    const h = harness();
    setWitnesses(h, 90n, bytes(), bytes());
    expect(() => h.contract.circuits.close_gate(h.context())).toThrow(/authorized/);
    expect(() => h.contract.circuits.open_gate(h.context())).toThrow(/authorized/);
    expect(() => h.contract.circuits.rotate_gate(h.context(), 80n, bytes(), BigInt(NOW + 2_000), bytes(), 10n)).toThrow(/authorized/);
  });

  it('closes and reopens only with the steward secret', () => {
    const h = harness();
    setWitnesses(h, 90n, bytes());
    apply(h, h.contract.circuits.close_gate(h.context()));
    expect(ledger(h.state).gate_open).toBe(false);
    setWitnesses(h, 90n, bytes());
    apply(h, h.contract.circuits.open_gate(h.context()));
    expect(ledger(h.state).gate_open).toBe(true);
  });

  it('rotates configuration with a distinct pass and preserves accumulated entries', () => {
    const h = harness({ limit: 3n });
    const firstEntrySecret = bytes();
    setWitnesses(h, 90n, firstEntrySecret);
    apply(h, h.contract.circuits.prove_entry(h.context()));
    const nextPass = bytes();
    setWitnesses(h, 90n, bytes());
    apply(h, h.contract.circuits.rotate_gate(h.context(), 80n, nextPass, BigInt(NOW + 2_000), bytes(), 3n));
    expect(ledger(h.state).entry_threshold).toBe(80n);
    expect(ledger(h.state).total_entries).toBe(1n);
    expect(ledger(h.state).entry_limit).toBe(3n);
  });

  it('rejects rotation to the current pass identifier', () => {
    const h = harness();
    setWitnesses(h, 90n, bytes());
    expect(() => h.contract.circuits.rotate_gate(h.context(), 80n, h.pass, BigInt(NOW + 2_000), bytes(), 10n)).toThrow(/distinct pass/);
  });

  it('rejects rotation with an expired deadline or capacity below lifetime entries', () => {
    const h = harness({ limit: 2n });
    setWitnesses(h, 90n, bytes());
    apply(h, h.contract.circuits.prove_entry(h.context()));
    const nextPass = bytes();
    expect(() => h.contract.circuits.rotate_gate(h.context(), 80n, nextPass, BigInt(NOW - 1), bytes(), 2n)).toThrow(/expired/);
    expect(() => h.contract.circuits.rotate_gate(h.context(), 80n, bytes(), BigInt(NOW + 2_000), bytes(), 1n)).toThrow(/admitted entries/);
  });

  it('domain-separates steward keys and entry nullifiers', () => {
    const secret = bytes();
    const passphrase = bytes();
    const pass = bytes();
    const stewardKey = pureCircuits.steward_public_key(secret);
    const nullifier = pureCircuits.make_entry_nullifier(passphrase, pass);
    expect(stewardKey).toHaveLength(32);
    expect(nullifier).toHaveLength(32);
    expect(Buffer.from(stewardKey).equals(Buffer.from(nullifier))).toBe(false);
    expect(Buffer.from(nullifier).equals(Buffer.from(pureCircuits.make_entry_nullifier(passphrase, bytes())))).toBe(false);
  });

  it('rejects empty secrets in pure authentication helpers', () => {
    expect(() => pureCircuits.steward_public_key(zeroBytes())).toThrow(/secret/);
    expect(() => pureCircuits.make_entry_nullifier(zeroBytes(), bytes())).toThrow(/Passphrase/);
    expect(() => pureCircuits.make_entry_nullifier(bytes(), zeroBytes())).toThrow(/Pass identifier/);
  });
});
