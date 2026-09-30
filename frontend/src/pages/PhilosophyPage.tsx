import { Eye, EyeOff, Fingerprint, Globe2, LockKeyhole, ShieldCheck } from 'lucide-react';

export default function PhilosophyPage() {
  return (
    <div className="page reading-page">
      <div className="page-header reading-header">
        <p className="kicker"><span className="kicker-line" /> The privacy boundary</p>
        <h1>Reveal the result.<br /><em>Keep the reason in shadow.</em></h1>
        <p>Atrium uses Midnight's public ledger and private witness model deliberately. A proof can be inspected without exposing the evidence that made it valid.</p>
      </div>
      <div className="boundary-grid" aria-label="What is public and what stays private">
        <section className="boundary-panel public-boundary">
          <div className="boundary-icon"><Globe2 size={20} aria-hidden="true" /></div><span className="boundary-label">Public ledger</span>
          <h2>What the room records</h2>
          <ul><li>The published threshold and access pass domain</li><li>Expiry, capacity, and open or closed status</li><li>An aggregate count of accepted entries</li><li>A gate-scoped nullifier for replay protection</li><li>The fact that a specific circuit was called</li></ul>
          <p className="boundary-footnote">The chain is transparent about the outcome and the shape of the transaction.</p>
        </section>
        <section className="boundary-panel private-boundary">
          <div className="boundary-icon"><LockKeyhole size={20} aria-hidden="true" /></div><span className="boundary-label">Private witness</span>
          <h2>What stays in your room</h2>
          <ul><li>The eligibility score supplied by the browser</li><li>The passphrase used to derive the nullifier</li><li>The source credential behind that score</li><li>The private steward secret used for operator actions</li><li>Any value that never crosses into a circuit argument</li></ul>
          <p className="boundary-footnote">The proof establishes that the private input satisfied the rule. It does not make the input true by itself.</p>
        </section>
      </div>
      <section className="reading-section">
        <div className="reading-section-heading"><p className="kicker"><span className="kicker-line" /> The guarantee</p><h2>What an observer can and cannot learn.</h2></div>
        <div className="guarantee-list">
          <article><ShieldCheck size={21} aria-hidden="true" /><div><h3>They can verify</h3><p>That the gate was open, the hidden score met the public threshold, and the gate-scoped nullifier had not been used before.</p></div></article>
          <article><EyeOff size={21} aria-hidden="true" /><div><h3>They cannot recover</h3><p>The score, passphrase, source credential, or identity from the witness values included in the proof.</p></div></article>
          <article><Fingerprint size={21} aria-hidden="true" /><div><h3>They can observe a call</h3><p>Midnight does not hide that a transaction happened, when it happened, which contract was called, or which circuit ran.</p></div></article>
          <article><Eye size={21} aria-hidden="true" /><div><h3>They cannot infer honesty</h3><p>In this reference app, the score is self-entered. Production deployments should replace it with an attested credential or a stronger membership witness.</p></div></article>
        </div>
      </section>
      <section className="code-card" aria-labelledby="compact-title"><div className="code-card-heading"><span className="boundary-label">Compact circuit</span><h2 id="compact-title">Only the predicate crosses the threshold.</h2></div><pre><code><span className="code-keyword">const</span> score = get_eligibility_score();{`\n`}<span className="code-keyword">assert</span>(score &gt;= entry_threshold);{`\n`}<span className="code-keyword">const</span> nullifier = make_entry_nullifier(passphrase, access_pass_id);{`\n`}<span className="code-keyword">assert</span>(!used_nullifiers.member(nullifier));{`\n`}total_entries.increment(1);</code></pre></section>
    </div>
  );
}
