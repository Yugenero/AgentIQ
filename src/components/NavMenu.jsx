import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import './NavMenu.css';

export default function NavMenu({ onSelectPage }) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  function handleSelect(id, disabled) {
    if (disabled) return;
    setOpen(false);
    onSelectPage?.(id);
  }

  const NAV_ITEMS = [
    {
      id: 'profile',
      label: 'Profile',
      desc: user ? (user.displayName || user.email) : 'Account & settings',
      disabled: false,
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
          <path d="M2 14c0-3.3 2.7-5 6-5s6 1.7 6 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
      ),
    },
    {
      id: 'friends',
      label: 'Friends',
      desc: 'Side-by-side comparison',
      disabled: true,
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="5.5" cy="4.5" r="2" stroke="currentColor" strokeWidth="1.3"/>
          <path d="M1 13c0-2.5 2-4 4.5-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          <circle cx="10.5" cy="4.5" r="2" stroke="currentColor" strokeWidth="1.3"/>
          <path d="M7 13c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
      ),
    },
    {
      id: 'recent',
      label: 'Recent Searches',
      desc: 'Your search history',
      disabled: true,
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3"/>
          <path d="M8 5v3.5l2 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
  ];

  return (
    <div className="nav-menu" ref={ref}>
      <button
        className={`nav-menu__trigger${open ? ' nav-menu__trigger--open' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label="Menu"
      >
        <span className="nav-menu__bar" />
        <span className="nav-menu__bar" />
        <span className="nav-menu__bar" />
      </button>

      {open && (
        <div className="nav-menu__dropdown">
          <p className="nav-menu__section-label">Navigation</p>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`nav-menu__item${item.disabled ? ' nav-menu__item--disabled' : ''}`}
              onClick={() => handleSelect(item.id, item.disabled)}
            >
              <span className="nav-menu__item-icon">{item.icon}</span>
              <span className="nav-menu__item-text">
                <span className="nav-menu__item-label">{item.label}</span>
                <span className="nav-menu__item-desc">{item.desc}</span>
              </span>
              {item.disabled && <span className="nav-menu__soon">soon</span>}
              {!item.disabled && user && item.id === 'profile' && (
                <span className="nav-menu__dot" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
