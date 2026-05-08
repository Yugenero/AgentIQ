import { useState } from 'react';
import { useAppStore } from '../store/useAppStore.js';
import './SearchBar.css';

export default function SearchBar() {
  const [value, setValue] = useState('');
  const [shake, setShake] = useState(false);
  const [errorPlaceholder, setErrorPlaceholder] = useState('');
  const loadPlayer = useAppStore((s) => s.loadPlayer);
  const loading = useAppStore((s) => s.loading);

  function triggerError(msg) {
    setValue('');
    setErrorPlaceholder(msg);
    setShake(true);
    setTimeout(() => setShake(false), 400);
  }

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = value.trim();
    const parts = trimmed.split('#');
    if (!trimmed.includes('#') || !parts[0] || !parts[1]) {
      triggerError('name#tag — e.g. TenZ#00005');
      return;
    }
    setErrorPlaceholder('');
    loadPlayer(parts[0], parts[1]);
  }

  return (
    <form className="search-bar" onSubmit={handleSubmit} noValidate>
      <div className="search-bar__input-row">
        <input
          className={`search-bar__input${errorPlaceholder ? ' search-bar__input--error' : ''}${shake ? ' search-bar__input--shake' : ''}`}
          type="text"
          placeholder={errorPlaceholder || 'Enter Riot ID  e.g. name#NA1'}
          value={value}
          onChange={e => { setValue(e.target.value); setErrorPlaceholder(''); }}
          disabled={loading}
          autoComplete="off"
          spellCheck={false}
        />
        <button className="search-bar__btn" type="submit" disabled={loading}>
          {loading ? '...' : 'Search'}
        </button>
      </div>
    </form>
  );
}
