export const UINT64_MAX = (1n << 64n) - 1n;
export const UINT32_MAX = (1n << 32n) - 1n;

export function parseUint(value: string | bigint, bits: 32 | 64, label = 'Value', minimum = 0n): bigint {
  const text = String(value).trim();
  if (!/^\d+$/.test(text)) throw new Error(`${label} must be a whole, non-negative decimal number.`);
  const parsed = BigInt(text);
  const maximum = bits === 64 ? UINT64_MAX : UINT32_MAX;
  if (parsed < minimum || parsed > maximum) throw new Error(`${label} must be between ${minimum} and ${maximum}.`);
  return parsed;
}

export function normalizeHex32(value: string, label = 'Key', allowZero = false): string {
  const normalized = value.trim().replace(/^0x/i, '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) throw new Error(`${label} must contain exactly 32 bytes (64 hexadecimal characters).`);
  if (!allowZero && /^0+$/.test(normalized)) throw new Error(`${label} must not be all zeroes.`);
  return normalized;
}

export function assertTransactionId(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/i.test(value)) {
    throw new Error('No valid transaction identifier was returned. Submission is not confirmed; check wallet history before retrying.');
  }
  return value.toLowerCase();
}

export function toHex(bytes: Uint8Array | readonly number[] | string): string {
  if (typeof bytes === 'string') return bytes.replace(/^0x/i, '').toLowerCase();
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function fromHex(hex: string): Uint8Array {
  const normalized = hex.trim().replace(/^0x/i, '');
  if (normalized.length % 2 || !/^[0-9a-f]*$/i.test(normalized)) throw new Error('Invalid hexadecimal value.');
  return Uint8Array.from(normalized.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16));
}

export function randomHex32(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

/** Never stringify SDK errors: they can contain witnesses or unproven transactions. */
export function userFacingError(error: unknown, fallback = 'The request could not be completed. Check your wallet and try again.'): string {
  const candidate = error instanceof Error ? error.message : '';
  if (!candidate || candidate.length > 400 || /privateTranscript|unprovenTx|privateState|\{"|Uint8Array/i.test(candidate)) return fallback;
  return candidate.replace(/\b[0-9a-f]{64,}\b/gi, '[redacted]');
}
