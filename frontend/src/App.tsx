import { useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { ArrowUpRight, ChevronDown, CircleUserRound, LogOut, Menu, Moon, Sun, X } from 'lucide-react';
import { useWallet } from './contexts/WalletContext';
import LandingPage from './pages/LandingPage';
import GatePage from './pages/GatePage';
import AdminPage from './pages/AdminPage';
import ObservatoryPage from './pages/ObservatoryPage';
import PhilosophyPage from './pages/PhilosophyPage';

export type ThemeMode = 'night' | 'day';

export default function App() {
  const { address, isConnected, connect, disconnect, isConnecting, walletStatus, walletName, network, error, clearError } = useWallet();
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('ATRIUM_THEME') : null;
    return saved === 'day' || saved === 'night' ? saved : 'day';
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('ATRIUM_THEME', theme);
  }, [theme]);
  useEffect(() => setMenuOpen(false), [location.pathname]);

  const shortAddress = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '';
  const toggleTheme = () => setTheme((current) => current === 'day' ? 'night' : 'day');

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      {error && (
        <div className="alert-strip" role="alert">
          <span>{error}</span>
          <button type="button" onClick={clearError} aria-label="Dismiss wallet error"><X size={16} aria-hidden="true" /></button>
        </div>
      )}
      <header className="topbar">
        <Link className="brand" to="/" aria-label="Atrium home">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span className="brand-name">ATRIUM</span>
        </Link>
        <button className="mobile-menu" type="button" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-controls="primary-navigation" aria-label="Toggle navigation">
          {menuOpen ? <X size={21} aria-hidden="true" /> : <Menu size={21} aria-hidden="true" />}
        </button>
        <nav id="primary-navigation" className={`main-nav ${menuOpen ? 'open' : ''}`} aria-label="Primary navigation">
          <NavLink to="/gate">Access room</NavLink>
          <NavLink to="/observatory">Public record</NavLink>
          <NavLink to="/philosophy">How it works</NavLink>
          <NavLink to="/admin">Operator console</NavLink>
        </nav>
        <div className="topbar-actions">
          <button className="icon-button" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === 'day' ? 'night' : 'day'} theme`} title={`Switch to ${theme === 'day' ? 'night' : 'day'} theme`}>
            {theme === 'day' ? <Moon size={17} aria-hidden="true" /> : <Sun size={17} aria-hidden="true" />}
          </button>
          {isConnected ? (
            <button className="wallet-chip" type="button" onClick={disconnect} title="Disconnect wallet">
              <span className="online-dot" aria-hidden="true" />
              <span>{walletName || 'Wallet'} · {shortAddress}</span>
              <LogOut size={14} aria-hidden="true" />
            </button>
          ) : (
            <button className="connect-button" type="button" onClick={() => void connect(network)} disabled={isConnecting || walletStatus === 'not-found'}>
              <CircleUserRound size={15} aria-hidden="true" />
              {isConnecting ? 'Opening…' : walletStatus === 'not-found' ? 'Wallet needed' : 'Connect wallet'}
            </button>
          )}
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/gate" element={<GatePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/operator" element={<AdminPage />} />
          <Route path="/observatory" element={<ObservatoryPage />} />
          <Route path="/philosophy" element={<PhilosophyPage />} />
          <Route path="*" element={<LandingPage />} />
        </Routes>
      </main>
      <footer className="footer">
        <span><span className="footer-mark" aria-hidden="true" /> Access without exposure.</span>
        <span className="mono">MIDNIGHT / SELECTIVE DISCLOSURE</span>
        <Link to="/philosophy">Read the boundary <ArrowUpRight size={13} aria-hidden="true" /></Link>
      </footer>
    </div>
  );
}
