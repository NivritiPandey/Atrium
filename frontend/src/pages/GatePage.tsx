import { useCallback, useMemo, useState } from 'react';
import { ArrowRight, Check, EyeOff, Fingerprint, LockKeyhole, RefreshCw, ShieldCheck, WalletCards } from 'lucide-react';
import { getContractAddress, getExplorerTxUrl } from '../config';
import { createAtriumCallTx, submitAtriumTransaction, observeAtriumTransaction } from '../lib/contract';
import { fromHex, toHex } from '../lib/midnight';
import { getIdentity, hasUsedPass, publicFingerprint } from '../lib/identity';
import { userFacingError } from '../lib/validation';
import { useContractState } from '../hooks/useContractState';
import { useWallet } from '../contexts/WalletContext';

export default function GatePage() {
  const { session, isConnected, connect, isConnecting, walletStatus, network } = useWallet();
  const { ledgerState, isLoading, error, refetch } = useContractState(5000);
  const [identity] = useState(getIdentity);
  const [score, setScore] = useState('88');
  const [status, setStatus] = useState<'ready' | 'proving' | 'submitted' | 'success' | 'error'>('ready');
  const [message, setMessage] = useState('');
  const [txId, setTxId] = useState('');
  const threshold = BigInt(ledgerState?.entry_threshold || 0);
  const parsedScore = Number(score);
  const scoreValue = BigInt(Number.isFinite(parsedScore) ? Math.max(0, Math.min(18446744073709551615, Math.floor(parsedScore))) : 0);
  const hasUsed = useMemo(() => hasUsedPass(identity.secret, ledgerState), [identity.secret, ledgerState]);
  const roomReady = Boolean(ledgerState?.gate_open && Number(ledgerState.total_entries) < Number(ledgerState.entry_limit));
  const isReady = Boolean(roomReady && isConnected && scoreValue >= threshold && !hasUsed);

  const prove = useCallback(async () => {
    if (!ledgerState || !getContractAddress()) { setMessage('No access room is indexed yet. Ask an operator to deploy one first.'); return; }
    if (!session || !isConnected) { setMessage('Connect a Midnight wallet before generating a proof.'); return; }
    if (hasUsed) { setMessage('This private passphrase has already been used for the active room.'); return; }
    if (scoreValue < threshold) { setMessage(`The private score must clear the public threshold of ${threshold}.`); return; }
    setStatus('proving'); setMessage('Constructing the proof locally. Your score and passphrase stay in this browser.'); setTxId('');
    try {
      const call = await createAtriumCallTx(session.providers as any, getContractAddress(), 'prove_entry', [], { eligibilityScore: scoreValue, passphrase: fromHex(identity.secret), stewardSecret: new Uint8Array(32) });
      const submittedId = await submitAtriumTransaction(session.providers as any, call.private.unprovenTx, 'prove_entry');
      setTxId(submittedId); setStatus('submitted'); setMessage('Transaction submitted. Waiting for the public record to confirm the result.');
      const observation = await observeAtriumTransaction(session.providers as any, submittedId, 45000);
      if (observation.stage === 'confirmed') {
        setStatus('success'); setMessage('Entry verified. The public record contains the outcome and a replay guard, not your private score.');
        window.setTimeout(() => void refetch(), 2200);
      } else if (observation.stage === 'failed') {
        setStatus('error'); setMessage('The network reported a failed transaction. Check the explorer before retrying.');
      } else {
        setMessage('Submitted, but confirmation is still pending. Check the transaction before retrying.');
      }
    } catch (cause) { setStatus('error'); setMessage(userFacingError(cause, 'The proof could not be submitted. Check wallet approval, DUST, and network selection.')); }
  }, [hasUsed, identity.secret, isConnected, ledgerState, refetch, scoreValue, session, threshold]);

  return (
    <div className="page access-page">
      <div className="page-header"><p className="kicker"><span className="kicker-line" /> Access room / private witness</p><h1>Bring the proof.<br /><em>Leave the story behind.</em></h1><p>Use a local eligibility signal to enter the active Atrium room. The interface shows the public rule; the private value only exists inside your proving session.</p></div>
      <div className="two-col">
        <section className="panel public-room-panel">
          <div className="panel-topline"><p className="kicker"><span className="kicker-line" /> Public room state</p>{ledgerState && <span className={`status ${ledgerState.gate_open ? '' : 'closed'}`}>{ledgerState.gate_open ? 'OPEN' : 'CLOSED'}</span>}</div>
          {isLoading ? <div className="empty-state">Reading the public record…</div> : error ? <div className="notice error" role="alert">{error}</div> : !ledgerState ? <div className="empty-state"><ShieldCheck size={20} aria-hidden="true" /><strong>No room is configured.</strong><span>The operator console can deploy the first Atrium room.</span></div> : <div className="data-list"><div className="data-row"><span className="label">Threshold</span><strong>{threshold.toString()} points</strong></div><div className="data-row"><span className="label">Entries</span><strong>{ledgerState.total_entries?.toString()} / {ledgerState.entry_limit?.toString()}</strong></div><div className="data-row"><span className="label">Pass expires</span><strong>{new Date(Number(ledgerState.entry_deadline) * 1000).toLocaleDateString()}</strong></div><div className="data-row"><span className="label">Pass domain</span><strong className="mono">{toHex(ledgerState.access_pass_id).slice(0, 14)}…</strong></div></div>}
          <div className="notice" style={{ marginTop: 24 }}><ShieldCheck size={15} aria-hidden="true" /> The threshold, count, expiry, and nullifier are public. The score is not.</div>
        </section>
        <section className="panel private-room-panel">
          <p className="kicker"><span className="kicker-line" /> Your private side</p><h2>One local signal.</h2><p>This demonstration score is self-entered. It is used to exercise the privacy boundary, not to claim an issuer-backed credential.</p>
          {!isConnected && <div className="notice notice-warm"><WalletCards size={15} aria-hidden="true" /> Connect 1AM, Lace, or another compatible wallet on the selected network to submit.</div>}
          <div className="field"><label htmlFor="private-score">Private score · never disclosed</label><input id="private-score" className="input mono" type="number" min="0" max="18446744073709551615" inputMode="numeric" value={score} onChange={(event) => setScore(event.target.value)} aria-describedby="score-help" /><span id="score-help" className="field-help">The room publishes only the threshold it compares against.</span></div>
          <div className="data-row"><span className="label">Local witness fingerprint</span><strong className="mono">{publicFingerprint(identity.secret).slice(0, 14)}…</strong></div>
          <div className="data-row"><span className="label">Replay protection</span><strong>{hasUsed ? 'Already used' : 'Unused in this room'}</strong></div>
          {message && <div className={`notice ${status === 'error' ? 'error' : status === 'success' ? 'success' : ''}`} role={status === 'error' ? 'alert' : 'status'} style={{ marginTop: 20 }}>{message}</div>}
          {status === 'success' ? <div className="notice success" style={{ marginTop: 20 }}><Check size={15} aria-hidden="true" /> Entry verified.<div className="mono tx-id">{txId}</div><a className="text-link" href={getExplorerTxUrl(txId)} target="_blank" rel="noreferrer">View transaction <ArrowRight size={14} aria-hidden="true" /></a></div> : <button className="button primary" type="button" style={{ width: '100%', marginTop: 22 }} disabled={!isReady || status === 'proving' || status === 'submitted'} onClick={() => void prove()}>{status === 'proving' ? <><RefreshCw size={15} className="spin" aria-hidden="true" /> Proving locally…</> : status === 'submitted' ? <><RefreshCw size={15} className="spin" aria-hidden="true" /> Waiting for confirmation…</> : <>Generate entry proof <ArrowRight size={15} aria-hidden="true" /></>}</button>}
          {!isConnected && <button className="button" type="button" style={{ width: '100%', marginTop: 10 }} onClick={() => void connect(network)} disabled={isConnecting || walletStatus === 'not-found'}><LockKeyhole size={15} aria-hidden="true" /> {isConnecting ? 'Opening wallet…' : 'Connect wallet'}</button>}
          <div className="private-callout"><EyeOff size={15} aria-hidden="true" /><span>Private witness values are held in memory for this session and are passed to the proof provider. Do not use this reference flow for secrets you cannot safely enter into a wallet/prover environment.</span></div>
        </section>
      </div>
    </div>
  );
}
