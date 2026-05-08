import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import './AuthModal.css';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
    </svg>
  );
}

export default function AuthModal({ onClose }) {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, linkRiotId, userProfile } = useAuth();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup' | 'link' | 'resolving'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [riotInput, setRiotInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // After sign-in, wait for userProfile to load then decide: link step or close
  useEffect(() => {
    if (mode !== 'resolving') return;
    if (userProfile === null) return; // still loading
    if (userProfile.riotId) {
      onClose(); // already linked — go straight to profile
    } else {
      setMode('link');
    }
  }, [mode, userProfile]);

  async function handleGoogle() {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
      setMode('resolving');
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }

  async function handleEmailSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
      setMode('resolving');
    } catch (e) {
      setError(e.message.replace('Firebase: ', '').replace(/ \(auth\/.*\)\.?/, ''));
      setLoading(false);
    }
  }

  async function handleLinkRiot(e) {
    e.preventDefault();
    setError('');
    const parts = riotInput.trim().split('#');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      setError('Enter your Riot ID as name#tag');
      return;
    }
    setLoading(true);
    try {
      await linkRiotId(parts[0].trim(), parts[1].trim());
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (mode === 'resolving') {
    return (
      <div className="auth-overlay">
        <div className="auth-modal auth-modal--loading">
          <span className="auth-modal__spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="auth-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="auth-modal">

        {mode === 'link' ? (
          <>
            <h2 className="auth-modal__title">Link Riot ID</h2>
            <p className="auth-modal__sub">Connect your Valorant account to unlock your profile page.</p>
            <form className="auth-modal__form" onSubmit={handleLinkRiot}>
              <div className="auth-modal__field">
                <label className="auth-modal__label">Riot ID</label>
                <input
                  className="auth-modal__input"
                  placeholder="name#tag"
                  value={riotInput}
                  onChange={e => setRiotInput(e.target.value)}
                  autoFocus
                />
              </div>
              {error && <p className="auth-modal__error">{error}</p>}
              <button className="auth-modal__btn auth-modal__btn--primary" type="submit" disabled={loading}>
                {loading ? 'Linking…' : 'Link Account'}
              </button>
            </form>
            <button className="auth-modal__skip" onClick={onClose}>Skip for now</button>
          </>
        ) : (
          <>
            <h2 className="auth-modal__title">{mode === 'signup' ? 'Create account' : 'Sign in'}</h2>
            <p className="auth-modal__sub">to AgentIQ</p>

            <button className="auth-modal__google" onClick={handleGoogle} disabled={loading}>
              <GoogleIcon />
              Continue with Google
            </button>

            <div className="auth-modal__divider"><span>or</span></div>

            <form className="auth-modal__form" onSubmit={handleEmailSubmit}>
              <div className="auth-modal__field">
                <label className="auth-modal__label">Email</label>
                <input
                  className="auth-modal__input"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="auth-modal__field">
                <label className="auth-modal__label">Password</label>
                <input
                  className="auth-modal__input"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && <p className="auth-modal__error">{error}</p>}
              <button className="auth-modal__btn auth-modal__btn--primary" type="submit" disabled={loading}>
                {loading ? '…' : mode === 'signup' ? 'Create account' : 'Sign in'}
              </button>
            </form>

            <p className="auth-modal__switch">
              {mode === 'signin' ? (
                <>No account? <button onClick={() => { setMode('signup'); setError(''); }}>Sign up</button></>
              ) : (
                <>Have an account? <button onClick={() => { setMode('signin'); setError(''); }}>Sign in</button></>
              )}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
