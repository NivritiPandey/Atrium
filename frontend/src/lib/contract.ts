import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { createUnprovenCallTx, createUnprovenDeployTx, submitTxAsync } from '@midnight-ntwrk/midnight-js-contracts';
import { sampleSigningKey } from '@midnight-ntwrk/compact-runtime';
import type { MidnightProviders } from '@midnight-ntwrk/midnight-js-types';
import { Contract } from '../managed/contract/index.js';
import { fromHex, toHex } from './midnight';
import { assertTransactionId } from './validation';

export const ATRIUM_PRIVATE_STATE_ID = 'atrium-browser-state';
export type AtriumWitnessInput = {
  eligibilityScore?: bigint;
  passphrase?: Uint8Array;
  stewardSecret: Uint8Array;
};
export type DeployArgs = readonly [bigint, Uint8Array, bigint, Uint8Array, Uint8Array, bigint];
export type TransactionObservation =
  | { stage: 'submitted'; txId: string; reason: 'pending' | 'timeout' }
  | { stage: 'confirmed'; txId: string; data: any }
  | { stage: 'failed'; txId: string; data: any };

function bytes32(value: Uint8Array | undefined, label: string): Uint8Array {
  if (!(value instanceof Uint8Array) || value.length !== 32) throw new Error(`${label} must be exactly 32 bytes.`);
  return value;
}

/** Builds all witnesses explicitly. No vacant-witness configuration is used. */
export function createAtriumCompiledContract(input: AtriumWitnessInput) {
  const stewardSecret = bytes32(input.stewardSecret, 'Steward secret');
  const passphrase = bytes32(input.passphrase ?? new Uint8Array(32), 'Passphrase');
  const score = input.eligibilityScore ?? 0n;
  const witnesses = {
    get_eligibility_score: (context: any) => [context.privateState, score],
    get_passphrase: (context: any) => [context.privateState, passphrase],
    steward_secret: (context: any) => [context.privateState, stewardSecret],
  };
  return CompiledContract.make('AtriumContract', Contract).pipe(
    CompiledContract.withWitnesses(witnesses),
    CompiledContract.withCompiledFileAssets(new URL('/managed', window.location.origin).toString()),
  ) as any;
}

export function makeDeployArgs(threshold: bigint, pass: Uint8Array, deadline: bigint, curator: Uint8Array, stewardHash: Uint8Array, limit: bigint): DeployArgs {
  return [threshold, bytes32(pass, 'Pass identifier'), deadline, bytes32(curator, 'Curator identifier'), bytes32(stewardHash, 'Steward commitment'), limit];
}

export async function createAtriumDeployTx(providers: MidnightProviders<any, any, any>, args: DeployArgs, witnesses: AtriumWitnessInput) {
  return createUnprovenDeployTx(providers as any, {
    compiledContract: createAtriumCompiledContract(witnesses),
    args,
    signingKey: sampleSigningKey(),
  } as any);
}

export async function createAtriumCallTx(
  providers: MidnightProviders<any, any, any>,
  contractAddress: string,
  circuitId: 'prove_entry' | 'rotate_gate' | 'close_gate' | 'open_gate',
  args: readonly unknown[],
  witnesses: AtriumWitnessInput,
) {
  return createUnprovenCallTx(providers as any, {
    compiledContract: createAtriumCompiledContract(witnesses),
    contractAddress,
    circuitId,
    ...(args.length ? { args } : {}),
  } as any);
}

export async function submitAtriumTransaction(providers: any, unprovenTx: any, circuitId?: string): Promise<string> {
  const submitted = await submitTxAsync(providers as any, { unprovenTx, ...(circuitId ? { circuitId } : {}) } as any);
  return assertTransactionId(submitted);
}

function transactionResult(data: any): TransactionObservation {
  const txId = assertTransactionId(data?.txId);
  if (data?.status === 'SucceedEntirely') return { stage: 'confirmed', txId, data };
  return { stage: 'failed', txId, data };
}

/**
 * A timeout deliberately means "submitted, outcome unknown". It never reports
 * success or failure based only on elapsed time; callers can retry observation.
 */
export async function observeAtriumTransaction(providers: any, txId: string, timeoutMs = 90_000): Promise<TransactionObservation> {
  const validId = assertTransactionId(txId);
  let timer: number | undefined;
  const watch = providers.publicDataProvider.watchForTxData(validId).then(transactionResult);
  const timeout = new Promise<TransactionObservation>((resolve) => {
    timer = window.setTimeout(() => resolve({ stage: 'submitted', txId: validId, reason: 'timeout' }), timeoutMs);
  });
  try {
    return await Promise.race([watch, timeout]);
  } catch {
    // An observation error is not proof of failure; retain the real ID for recovery.
    return { stage: 'submitted', txId: validId, reason: 'pending' };
  } finally { if (timer !== undefined) window.clearTimeout(timer); }
}

export async function waitForAtriumContractState(providers: any, address: string, timeoutMs = 90_000): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      if (await providers.publicDataProvider.queryContractState(address)) return true;
    } catch {
      // Indexer outages are indeterminate, not deployment failures.
    }
    await new Promise((resolve) => window.setTimeout(resolve, 3_000));
  }
  return false;
}

export function secretToBytes(secret: string): Uint8Array { return fromHex(secret); }
export { toHex };
