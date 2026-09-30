import { Activity, ArrowUpRight, Hash, RefreshCw, Sparkles } from 'lucide-react';
import { getContractAddress, getExplorerContractUrl } from '../config';
import { toHex } from '../lib/midnight';
import { useContractState } from '../hooks/useContractState';

export default function ObservatoryPage() {
  const address = getContractAddress();
  const { ledgerState, isLoading, error, lastUpdate, refetch } = useContractState(5000);
  const nullifiers: string[] = [];
  try {
    if (ledgerState?.used_nullifiers?.[Symbol.iterator]) {
      for (const item of ledgerState.used_nullifiers) nullifiers.push(toHex(item));
    }
  } catch { /* The generated state shape can change between SDK releases. */ }
  const count = Number(ledgerState?.total_entries || 0);
  const limit = Math.max(1, Number(ledgerState?.entry_limit || 1));
  const fill = Math.min(100, (count / limit) * 100);

  return (
    <div className="page observatory-page">
      <div className="page-header observatory-header">
        <p className="kicker"><span className="kicker-line" /> Public record / live indexer</p>
        <h1>Look at the record.<br /><em>Not the person.</em></h1>
        <p>This is Atrium's public surface: the rule, lifecycle, aggregate count, and replay guards. The private witness stays on the other side of the proof.</p>
      </div>
      {!address && <div className="notice notice-warm" role="status">No access room is configured yet. An operator can deploy one from the console.</div>}
      {error && <div className="notice error" role="alert">{error}<button className="text-link inline-action" type="button" onClick={() => void refetch()}>Try again <RefreshCw size={13} aria-hidden="true" /></button></div>}
      <div className="metric-band" aria-label="Public gate metrics">
        <div className="metric"><strong>{ledgerState ? count : '—'}</strong><small>entries recorded</small></div>
        <div className="metric"><strong>{ledgerState ? limit : '—'}</strong><small>public capacity</small></div>
        <div className="metric"><strong>{ledgerState ? nullifiers.length : '—'}</strong><small>replay guards</small></div>
        <div className="metric"><strong>{ledgerState ? (ledgerState.gate_open ? 'OPEN' : 'CLOSED') : '—'}</strong><small>room status</small></div>
      </div>
      <div className="observatory-grid">
        <section className="panel record-panel">
          <div className="panel-topline"><p className="kicker"><span className="kicker-line" /> Configuration</p><button className="icon-button small" type="button" onClick={() => void refetch()} aria-label="Refresh public record" title="Refresh"><RefreshCw size={15} aria-hidden="true" /></button></div>
          {isLoading && !ledgerState ? <div className="empty-state">Reading the public record…</div> : !ledgerState ? <div className="empty-state"><Activity size={20} aria-hidden="true" /><strong>No indexed room yet.</strong><span>Deploy an Atrium room, then come back here to watch its public state.</span></div> : <>
            <div className="data-list"><div className="data-row"><span className="label">Contract</span><a className="data-link mono" href={getExplorerContractUrl(address)} target="_blank" rel="noreferrer">{address.slice(0, 10)}… <ArrowUpRight size={12} aria-hidden="true" /></a></div><div className="data-row"><span className="label">Threshold</span><strong>{ledgerState.entry_threshold?.toString()} points</strong></div><div className="data-row"><span className="label">Pass domain</span><strong className="mono">{toHex(ledgerState.access_pass_id).slice(0, 16)}…</strong></div><div className="data-row"><span className="label">Entry window</span><strong>{new Date(Number(ledgerState.entry_deadline) * 1000).toLocaleDateString()}</strong></div><div className="data-row"><span className="label">Curator commitment</span><strong className="mono">{toHex(ledgerState.curator_id).slice(0, 16)}…</strong></div></div>
            <div className="capacity-block"><div className="capacity-label"><span>Capacity used</span><span className="mono">{fill.toFixed(1)}%</span></div><div className="progress" role="progressbar" aria-valuenow={fill} aria-valuemin={0} aria-valuemax={100} aria-label="Public entry capacity used"><span style={{ width: `${fill}%` }} /></div></div>
          </>}
        </section>
        <section className="panel feed-panel">
          <p className="kicker"><span className="kicker-line" /> Arrival log</p><h2>Anonymous arrivals</h2><p className="panel-lede">A nullifier is a one-time replay guard, not an identity record.</p>
          {nullifiers.length === 0 ? <div className="empty-state"><Sparkles size={20} aria-hidden="true" /><strong>No arrivals yet.</strong><span>The first accepted proof will appear here as a public event.</span></div> : <div className="feed" aria-live="polite">{nullifiers.slice().reverse().map((item, index) => <div className="feed-item" key={item}><span className="feed-dot" aria-hidden="true" /><div><strong>Entry {nullifiers.length - index} verified</strong><p><Hash size={11} aria-hidden="true" /> {item}</p></div></div>)}</div>}
          {lastUpdate && <p className="last-update">LAST READ · {lastUpdate.toLocaleTimeString()}</p>}
        </section>
      </div>
    </div>
  );
}
