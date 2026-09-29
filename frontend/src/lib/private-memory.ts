/** Best-effort clearing of app-held references; JavaScript cannot guarantee RAM erasure. */
const cleanups = new Set<() => void>();
export function onPrivateMemoryReset(cleanup: () => void): () => void {
  cleanups.add(cleanup);
  return () => { cleanups.delete(cleanup); };
}
export function clearPrivateMemory(): void {
  for (const cleanup of cleanups) cleanup();
}
