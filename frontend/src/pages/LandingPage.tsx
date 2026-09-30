import { ArrowDownRight, ArrowUpRight, Eye, Fingerprint, LockKeyhole, MoveUpRight, ScanLine, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <div className="landing page">
      <section className="hero-layout" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="kicker"><span className="kicker-line" /> Private access infrastructure</p>
          <h1 id="hero-title">Enter on<br /><em>your terms.</em></h1>
          <p className="hero-intro">Atrium is a quiet protocol for proving eligibility without turning a person's reason for entry into a public record.</p>
          <div className="actions">
            <Link className="button primary" to="/gate">Enter the access room <ArrowUpRight size={16} aria-hidden="true" /></Link>
            <Link className="text-link" to="/philosophy">Understand the boundary <ArrowDownRight size={15} aria-hidden="true" /></Link>
          </div>
          <div className="hero-note"><span className="note-index">01</span><span>Public rule</span><span className="note-separator" /><span>Private evidence</span></div>
        </div>
        <div className="hero-visual">
          <div className="image-frame">
            <img src="/images/architecture.webp" width="1500" height="1000" alt="Looking up through a geometric atrium of glass buildings" fetchPriority="high" />
            <div className="image-wash" />
            <div className="architectural-grid" aria-hidden="true" />
            <div className="image-caption"><span>ATRIUM / 001</span><span>THE SURFACE IS NOT THE SECRET</span></div>
            <div className="seal" aria-hidden="true"><span>PRIVATE</span><span>BY DESIGN</span><span className="seal-dot" /></div>
          </div>
          <p className="visual-caption">A proof is a door with no keyhole. The network sees the result, not the room behind it.</p>
        </div>
      </section>

      <section className="principles-section" aria-labelledby="principles-title">
        <div className="section-intro">
          <p className="kicker"><span className="kicker-line" /> The Atrium principle</p>
          <h2 id="principles-title">A smaller public surface<br />makes room for <em>more trust.</em></h2>
        </div>
        <div className="principles-grid">
          <article className="principle-card principle-card-featured">
            <div className="principle-number">01</div><Fingerprint size={22} aria-hidden="true" />
            <h3>Private evidence</h3>
            <p>Your eligibility score and passphrase are supplied as witnesses. They are used inside the proof and never become circuit arguments.</p>
            <Link to="/gate" className="card-link">Try a private proof <MoveUpRight size={14} aria-hidden="true" /></Link>
          </article>
          <article className="principle-card">
            <div className="principle-number">02</div><ScanLine size={22} aria-hidden="true" />
            <h3>Visible outcome</h3>
            <p>Anyone can verify that the public rule was satisfied. The outcome is clear without becoming a dossier.</p>
          </article>
          <article className="principle-card">
            <div className="principle-number">03</div><ShieldCheck size={22} aria-hidden="true" />
            <h3>One-time arrival</h3>
            <p>A domain-separated nullifier prevents the same private pass from being used twice in one room.</p>
          </article>
        </div>
      </section>

      <section className="split-editorial" aria-labelledby="editorial-title">
        <div className="editorial-image">
          <img src="/images/interior.webp" width="900" height="600" alt="Sunlit interior with a quiet room and framed photographs" loading="lazy" />
          <span className="editorial-stamp">THE<br />QUIET<br />ROOM</span>
        </div>
        <div className="editorial-copy">
          <p className="kicker"><span className="kicker-line" /> Built for selective disclosure</p>
          <h2 id="editorial-title">The room is private.<br /><em>The door is verifiable.</em></h2>
          <p>Private communities, research circles, and invitation-only spaces should not need to publish a list of everyone who belongs. Atrium gives the operator a public rule and the visitor a private way to satisfy it.</p>
          <div className="editorial-facts"><div><strong>01</strong><span>score disclosed</span></div><div><strong>32B</strong><span>nullifier space</span></div><div><strong>24/7</strong><span>state readable</span></div></div>
          <Link className="text-link" to="/observatory">See the public record <ArrowUpRight size={15} aria-hidden="true" /></Link>
        </div>
      </section>

      <section className="closing-panel">
        <div><p className="kicker"><span className="kicker-line" /> For operators and members</p><h2>Make the rule public.<br /><em>Keep the reason yours.</em></h2></div>
        <div className="closing-actions"><Link className="button primary" to="/gate"><LockKeyhole size={15} aria-hidden="true" /> Open access room</Link><Link className="button" to="/admin">Operator console <ArrowUpRight size={15} aria-hidden="true" /></Link></div>
      </section>
    </div>
  );
}
