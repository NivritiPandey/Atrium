import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check, CheckCircle2, Copy, Download, Eye, EyeOff, ExternalLink, FileUp,
  LockKeyhole, Pause, Play, RefreshCw, RotateCcw, Settings2, WalletCards,
} from 'lucide-react';
import { pureCircuits } from '../managed/contract/index.js';
import { useWallet } from '../contexts/WalletContext';
import { useContractState } from '../hooks/useContractState';
import { useNetwork } from '../hooks/useNetwork';
import {
  DEFAULT_ENTRY_LIMIT, DEFAULT_GATE_THRESHOLD, getContractAddress, getExplorerContractUrl,
  getExplorerTxUrl, setContractAddress, subscribeConfig,
} from '../config';
import {
  createAtriumCallTx, createAtriumDeployTx, makeDeployArgs, observeAtriumTransaction,
  secretToBytes, submitAtriumTransaction, waitForAtriumContractState,
} from '../lib/contract';
import {
  randomHex32, userFacingError,
} from '../lib/validation';
import { normalizeHex32, parseUint } from '../lib/validation';

type OperationStatus = 'idle' | 'attached' | 'preparing' | 'submitted' | 'confirmed' | 'unknown' | 'failed';
const RECOVERY_FORMAT = 'atrium-steward-recovery-v1';
const DEFAULT_DEADLINE = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

function errorMessage(error: unknown) { return userFacingError(error, 'Check the fields and wallet, then try again.'); }
function statusClass(status: OperationStatus) {
  return status === 'failed' ? 'notice error' : status === 'confirmed' ? 'notice success' : 'notice';
}
function statusText(status: OperationStatus) {
  return ({ idle: '', attached: 'Address attached. Public state is read from the selected network; this is not a transaction confirmation.', preparing: 'Preparing a private transaction…', submitted: 'Submitted. Waiting for the selected network to make the outcome observable…', confirmed: 'Confirmed by the indexer.', unknown: 'Submitted, but confirmation is still unknown. Do not assume success or failure; check the transaction and wallet history.', failed: 'The network reported that this transaction did not succeed.' })[status];
}

export default function AdminPage() {
  const { network, chooseNetwork, isLocked } = useNetwork();
  const {
    session, isConnected, connect, isConnecting, walletStatus, availableWallets,
  } = useWallet();
  const wasConnected = useRef(false);
  const [activeAddress, setActiveAddress] = useState(() => getContractAddress(network));
  const [secret, setSecret] = useState(randomHex32);
  const [secretVisible, setSecretVisible] = useState(false);
  const [recoveryAcknowledged, setRecoveryAcknowledged] = useState(false);
  const [walletId, setWalletId] = useState('');
  const [attachValue, setAttachValue] = useState(activeAddress);
  const [threshold, setThreshold] = useState(DEFAULT_GATE_THRESHOLD.toString());
  const [limit, setLimit] = useState(DEFAULT_ENTRY_LIMIT.toString());
  const [deadline, setDeadline] = useState(DEFAULT_DEADLINE.toString());
  const [status, setStatus] = useState<OperationStatus>('idle');
  const [message, setMessage] = useState('');
  const [txId, setTxId] = useState('');
  const [copied, setCopied] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const { ledgerState, isLoading, error: stateError, refetch } = useContractState(5000, activeAddress);

  useEffect(() => subscribeConfig(() => {
    const next = getContractAddress(network);
    setActiveAddress(next); setAttachValue(next);
  }), [network]);
  useEffect(() => {
    if (wasConnected.current && !isConnected) {
      // Replace the in-memory secret after a wallet disconnect; it was never persisted.
      setSecret(randomHex32());
      setSecretVisible(false);
      setRecoveryAcknowledged(false);
    }
    wasConnected.current = isConnected;
  }, [isConnected]);
  useEffect(() => {
    if (status !== 'idle' && statusRef.current) statusRef.current.focus();
  }, [status]);

  const fieldErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    try { parseUint(threshold, 64, 'Threshold', 1n); } catch (cause) { errors.threshold = errorMessage(cause); }
    try { parseUint(limit, 32, 'Entry limit', 1n); } catch (cause) { errors.limit = errorMessage(cause); }
    try { parseUint(deadline, 64, 'Deadline', BigInt(Math.floor(Date.now() / 1000) + 60)); } catch (cause) { errors.deadline = errorMessage(cause); }
    try { normalizeHex32(secret, 'Steward secret'); } catch (cause) { errors.secret = errorMessage(cause); }
    if (!recoveryAcknowledged) errors.recovery = 'Acknowledge that private inputs may be visible to wallet extensions and proving infrastructure.';
    return errors;
  }, [deadline, limit, recoveryAcknowledged, secret, threshold]);
  const hasFormErrors = Object.keys(fieldErrors).length > 0;
  const busy = status === 'preparing' || status === 'submitted';

  const connectWallet = useCallback(async () => {
    setMessage('');
    await connect(network, walletId || undefined);
  }, [connect, network, walletId]);

  const setOperationError = useCallback((cause: unknown) => {
    setStatus('failed'); setMessage(errorMessage(cause)); setTxId('');
  }, []);

  const observeAndRefresh = useCallback(async (submittedId: string, address?: string) => {
    setTxId(submittedId); setStatus('submitted');
    const observed = await observeAtriumTransaction(session?.providers, submittedId);
    if (observed.stage === 'failed') {
      setStatus('failed'); setMessage('The indexer observed this transaction, but its execution did not succeed.'); return observed;
    }
    if (observed.stage !== 'confirmed') {
      setStatus('unknown'); setMessage('The transaction ID is real and was submitted, but confirmation has not arrived yet. Keep it for recovery and do not treat this as success.'); return observed;
    }
    if (address) {
      const indexed = await waitForAtriumContractState(session?.providers, address);
      if (!indexed) {
        setStatus('unknown'); setMessage('The transaction is confirmed, but the contract state is not observable in the indexer yet. The address was not saved automatically.'); return { ...observed, stage: 'submitted' as const, reason: 'timeout' as const };
      }
    }
    setStatus('confirmed'); setMessage('The transaction is confirmed and observable on the selected network.');
    await refetch();
    return observed;
  }, [refetch, session?.providers]);

  const deploy = useCallback(async () => {
    setShowErrors(true); setMessage('');
    if (hasFormErrors || !session) return;
    let stewardBytes: Uint8Array | undefined;
    try {
      setStatus('preparing');
      const thresholdValue = parseUint(threshold, 64, 'Threshold', 1n);
      const limitValue = parseUint(limit, 32, 'Entry limit', 1n);
      const deadlineValue = parseUint(deadline, 64, 'Deadline', BigInt(Math.floor(Date.now() / 1000) + 60));
      stewardBytes = secretToBytes(normalizeHex32(secret, 'Steward secret'));
      const pass = crypto.getRandomValues(new Uint8Array(32));
      const curator = crypto.getRandomValues(new Uint8Array(32));
      const stewardHash = (pureCircuits as any).steward_public_key(stewardBytes) as Uint8Array;
      const args = makeDeployArgs(thresholdValue, pass, deadlineValue, curator, stewardHash, limitValue);
      const unsubmitted = await createAtriumDeployTx(session.providers as any, args, { stewardSecret: stewardBytes });
      const address = unsubmitted.public.contractAddress as string;
      const submittedId = await submitAtriumTransaction(session.providers as any, unsubmitted.private.unprovenTx);
      const observed = await observeAndRefresh(submittedId, address);
      if (observed.stage === 'confirmed') {
        setContractAddress(address, network);
        setActiveAddress(address); setAttachValue(address);
        setMessage(`Atrium room deployed at ${address}.`);
      }
    } catch (cause) { setOperationError(cause); }
    finally { stewardBytes?.fill(0); }
  }, [deadline, hasFormErrors, network, observeAndRefresh, limit, secret, session, setOperationError, threshold]);

  const callOperator = useCallback(async (circuitId: 'close_gate' | 'open_gate' | 'rotate_gate') => {
    setShowErrors(true); setMessage('');
    if (!activeAddress || !session) { setMessage('Attach an Atrium room and connect the matching network wallet first.'); setStatus('failed'); return; }
    if (circuitId === 'rotate_gate' && hasFormErrors) return;
    let stewardBytes: Uint8Array | undefined;
    try {
      setStatus('preparing');
      stewardBytes = secretToBytes(normalizeHex32(secret, 'Steward secret'));
      const args = circuitId === 'rotate_gate'
        ? [
          parseUint(threshold, 64, 'Threshold', 1n), crypto.getRandomValues(new Uint8Array(32)),
          parseUint(deadline, 64, 'Deadline', BigInt(Math.floor(Date.now() / 1000) + 60)),
          crypto.getRandomValues(new Uint8Array(32)), parseUint(limit, 32, 'Entry limit', 1n),
        ]
        : [];
      const unsubmitted = await createAtriumCallTx(session.providers as any, activeAddress, circuitId, args, { stewardSecret: stewardBytes });
      const submittedId = await submitAtriumTransaction(session.providers as any, unsubmitted.private.unprovenTx, circuitId);
      await observeAndRefresh(submittedId);
    } catch (cause) { setOperationError(cause); }
    finally { stewardBytes?.fill(0); }
  }, [activeAddress, deadline, hasFormErrors, limit, observeAndRefresh, secret, session, setOperationError, threshold]);

  const attach = useCallback(() => {
    try {
      const normalized = attachValue.trim();
      setContractAddress(normalized, network);
      setActiveAddress(normalized); setMessage(`Attached to ${normalized}.`); setStatus('attached');
    } catch (cause) { setStatus('failed'); setMessage(errorMessage(cause)); }
  }, [attachValue, network]);

  const downloadRecovery = useCallback(() => {
    if (!recoveryAcknowledged) { setShowErrors(true); return; }
    try {
      const payload = JSON.stringify({ format: RECOVERY_FORMAT, network, secret: normalizeHex32(secret, 'Steward secret') }, null, 2);
      const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = `atrium-steward-${network}.json`; link.click(); URL.revokeObjectURL(url);
    } catch (cause) { setStatus('failed'); setMessage(errorMessage(cause)); }
  }, [network, recoveryAcknowledged, secret]);

  const importRecovery = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (parsed.format !== RECOVERY_FORMAT || parsed.network !== network) throw new Error(`This recovery file is not for ${network}.`);
      setSecret(normalizeHex32(parsed.secret, 'Steward secret')); setSecretVisible(false); setMessage('Recovery secret loaded into memory only. It has not been written to browser storage.'); setStatus('idle');
    } catch (cause) { setStatus('failed'); setMessage(errorMessage(cause)); }
  }, [network]);

  const copyAddress = useCallback(async () => {
    if (!activeAddress) return;
    await navigator.clipboard.writeText(activeAddress); setCopied(true); window.setTimeout(() => setCopied(false), 1600);
  }, [activeAddress]);

  const connectDisabled = isConnecting || walletStatus === 'not-found';
  return (
    <div className="page">
      <div className="page-header">
        <div className="eyebrow">Operator console / browser administration</div>
        <h1>Configure the room.<br /><em>Keep the witness private.</em></h1>
        <p>Deploy and operate an Atrium room from a Midnight-compatible wallet. A submitted transaction is not a confirmation; this console labels both stages explicitly.</p>
      </div>

      <div className="panel">
        <div className="eyebrow">Network and wallet</div>
        <div className="two-col">
          <div className="field">
            <label htmlFor="network">Midnight network</label>
            <select id="network" className="input" value={network} disabled={isLocked || isConnecting} onChange={(event) => { try { chooseNetwork(event.target.value as 'preview' | 'preprod'); setActiveAddress(getContractAddress(event.target.value as 'preview' | 'preprod')); } catch (cause) { setStatus('failed'); setMessage(errorMessage(cause)); } }}>
              <option value="preview">Preview</option><option value="preprod">Preprod</option>
            </select>
            <span className="label">Network switching is available only while disconnected.</span>
          </div>
          <div className="field">
            <label htmlFor="wallet-choice">Wallet connector</label>
            <select id="wallet-choice" className="input" value={walletId} onChange={(event) => setWalletId(event.target.value)} disabled={isConnected || !availableWallets.length}>
              <option value="">Choose a detected wallet</option>
              {availableWallets.map((wallet) => <option value={wallet.id} key={wallet.id}>{wallet.name}</option>)}
            </select>
            {!isConnected ? <button className="button primary" type="button" onClick={() => void connectWallet()} disabled={connectDisabled}><WalletCards size={16} aria-hidden="true" />{isConnecting ? 'Opening wallet…' : 'Connect wallet'}</button> : <div className="notice success"><CheckCircle2 size={15} aria-hidden="true" />Connected on {network}.</div>}
          </div>
        </div>
      </div>

      <div className="two-col">
        <section className="panel" aria-labelledby="deploy-heading">
          <div className="eyebrow">New room</div><h2 id="deploy-heading">Deploy Atrium</h2>
          <p>The six constructor values are generated and validated here: threshold, pass, deadline, curator, steward commitment, and lifetime limit.</p>
          <div className="field"><label htmlFor="threshold">Threshold · Uint&lt;64&gt;</label><input id="threshold" className="input mono" inputMode="numeric" value={threshold} onChange={(event) => setThreshold(event.target.value)} aria-invalid={Boolean(showErrors && fieldErrors.threshold)} aria-describedby={showErrors && fieldErrors.threshold ? 'threshold-error' : undefined} />{showErrors && fieldErrors.threshold && <span id="threshold-error" className="notice error" role="alert">{fieldErrors.threshold}</span>}</div>
          <div className="field"><label htmlFor="limit">Lifetime entry limit · Uint&lt;32&gt;</label><input id="limit" className="input mono" inputMode="numeric" value={limit} onChange={(event) => setLimit(event.target.value)} aria-invalid={Boolean(showErrors && fieldErrors.limit)} aria-describedby={showErrors && fieldErrors.limit ? 'limit-error' : undefined} />{showErrors && fieldErrors.limit && <span id="limit-error" className="notice error" role="alert">{fieldErrors.limit}</span>}</div>
          <div className="field"><label htmlFor="deadline">Pass deadline · Unix seconds, Uint&lt;64&gt;</label><input id="deadline" className="input mono" inputMode="numeric" value={deadline} onChange={(event) => setDeadline(event.target.value)} aria-invalid={Boolean(showErrors && fieldErrors.deadline)} aria-describedby={showErrors && fieldErrors.deadline ? 'deadline-error' : undefined} />{showErrors && fieldErrors.deadline && <span id="deadline-error" className="notice error" role="alert">{fieldErrors.deadline}</span>}</div>
          <div className="field"><label htmlFor="steward-secret">Steward secret · 32 bytes, memory only</label><div className="field"><input id="steward-secret" className="input mono" type={secretVisible ? 'text' : 'password'} value={secret} onChange={(event) => setSecret(event.target.value)} autoComplete="off" spellCheck={false} aria-invalid={Boolean(showErrors && fieldErrors.secret)} aria-describedby="secret-help" /> <button className="button subtle" type="button" onClick={() => setSecretVisible((visible) => !visible)} aria-label={secretVisible ? 'Mask steward secret' : 'Reveal steward secret'}>{secretVisible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}</button></div><span id="secret-help" className="label">Never silently saved. Wallet extensions, the prover, and this browser session can handle private inputs; use only a device you trust.</span>{showErrors && fieldErrors.secret && <span className="notice error" role="alert">{fieldErrors.secret}</span>}</div>
          <div className="field"><label><input type="checkbox" checked={recoveryAcknowledged} onChange={(event) => setRecoveryAcknowledged(event.target.checked)} /> I understand that private inputs may be exposed to wallet extensions and proving infrastructure.</label>{showErrors && fieldErrors.recovery && <span className="notice error" role="alert">{fieldErrors.recovery}</span>}</div>
          <div className="two-col"><button className="button subtle" type="button" onClick={downloadRecovery} disabled={!recoveryAcknowledged}><Download size={15} aria-hidden="true" />Download recovery</button><button className="button subtle" type="button" onClick={() => fileInput.current?.click()}><FileUp size={15} aria-hidden="true" />Import recovery</button></div><input ref={fileInput} type="file" accept="application/json" hidden onChange={(event) => void importRecovery(event)} />
          <button className="button primary" type="button" onClick={() => void deploy()} disabled={!isConnected || busy}><Settings2 size={16} aria-hidden="true" />{busy ? 'Working…' : 'Deploy room'}</button>
        </section>

        <section className="panel" aria-labelledby="active-heading">
          <div className="eyebrow">Existing room</div><h2 id="active-heading">Attach and operate</h2>
          <div className="field"><label htmlFor="contract-address">Contract address on {network}</label><input id="contract-address" className="input mono" value={attachValue} onChange={(event) => setAttachValue(event.target.value)} placeholder="mn_addr_preview1… or mn_addr_preprod1…" /><button className="button subtle" type="button" onClick={attach}><Check size={15} aria-hidden="true" />Attach address</button></div>
          {activeAddress && <div className="data-row"><span className="label">Active address</span><strong className="mono">{activeAddress}</strong><button className="button subtle" type="button" onClick={() => void copyAddress()} aria-label="Copy active contract address">{copied ? <Check size={15} /> : <Copy size={15} />}</button><a className="button subtle" href={getExplorerContractUrl(activeAddress, network)} target="_blank" rel="noreferrer" aria-label="Open active contract in explorer"><ExternalLink size={15} /></a></div>}
          {isLoading ? <div className="empty-state">Reading the public room state…</div> : stateError ? <div className="notice error" role="alert">{stateError}</div> : !ledgerState ? <div className="empty-state">Attach a deployed Atrium address to inspect its public state.</div> : <>
            <div className="data-row"><span className="label">Gate status</span><strong className="status">{ledgerState.gate_open ? 'OPEN' : 'CLOSED'}</strong></div><div className="data-row"><span className="label">Threshold / limit</span><strong>{ledgerState.entry_threshold?.toString()} / {ledgerState.entry_limit?.toString()}</strong></div><div className="data-row"><span className="label">Entries</span><strong>{ledgerState.total_entries?.toString()} / {ledgerState.entry_limit?.toString()}</strong></div>
            <div className="two-col"><button className="button" type="button" onClick={() => void callOperator(ledgerState.gate_open ? 'close_gate' : 'open_gate')} disabled={!isConnected || busy}>{ledgerState.gate_open ? <><Pause size={15} aria-hidden="true" />Pause room</> : <><Play size={15} aria-hidden="true" />Resume room</>}</button><button className="button" type="button" onClick={() => void callOperator('rotate_gate')} disabled={!isConnected || busy}><RotateCcw size={15} aria-hidden="true" />Rotate rule</button></div>
          </>}
          <button className="button subtle" type="button" onClick={() => void refetch()} disabled={isLoading}><RefreshCw size={15} aria-hidden="true" />Refresh public state</button>
        </section>
      </div>

      {status !== 'idle' && <div ref={statusRef} className={statusClass(status)} role={status === 'failed' ? 'alert' : 'status'} tabIndex={-1}>{statusText(status)} {message && <span>{message}</span>}{txId && <><div className="data-row"><span className="label">Transaction ID</span><span className="mono">{txId}</span><a className="button subtle" href={getExplorerTxUrl(txId, network)} target="_blank" rel="noreferrer">View explorer <ExternalLink size={14} /></a></div>{status !== 'failed' && <p className="label">A transaction ID proves submission, not execution. Keep this ID if the indexer is still catching up.</p>}</>}</div>}
      {!isConnected && <div className="notice"><LockKeyhole size={15} aria-hidden="true" />Connect a wallet on the selected network before deploying or changing a room.</div>}
    </div>
  );
}
