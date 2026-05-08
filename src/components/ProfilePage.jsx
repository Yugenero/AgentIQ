import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useAppStore } from '../store/useAppStore.js';
import { db } from '../services/firebase.js';
import { doc, getDoc } from 'firebase/firestore';
import './ProfilePage.css';

export default function ProfilePage({ onBack }) {
  const { user, userProfile, signOut, linkRiotId, unlinkRiotId, addFriend, removeFriend } = useAuth();
  const loadPlayer = useAppStore(s => s.loadPlayer);

  const [riotInput, setRiotInput] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [showLinkForm, setShowLinkForm] = useState(false);

  const [friendInput, setFriendInput] = useState('');
  const [addingFriend, setAddingFriend] = useState(false);
  const [friendError, setFriendError] = useState('');

  const [mutualEmails, setMutualEmails] = useState(new Set());
  const [confirmRemove, setConfirmRemove] = useState(null); // { name, tag }

  const riotId = userProfile?.riotId;
  const friends = userProfile?.friends ?? [];

  // Batch-read friends who are app users and check if they have us back
  useEffect(() => {
    const appFriends = friends.filter(f => f.email);
    if (!appFriends.length || !user) { setMutualEmails(new Set()); return; }

    Promise.all(appFriends.map(f => getDoc(doc(db, 'users', f.email))))
      .then(snaps => {
        const mutual = new Set();
        snaps.forEach((snap, i) => {
          if (!snap.exists()) return;
          const theirFriends = snap.data().friends ?? [];
          const myEmail = user.email;
          const myRiotId = userProfile?.riotId;
          const hasUs = theirFriends.some(tf =>
            tf.email === myEmail ||
            (myRiotId &&
              tf.name?.toLowerCase() === myRiotId.name?.toLowerCase() &&
              tf.tag?.toLowerCase() === myRiotId.tag?.toLowerCase())
          );
          if (hasUs) mutual.add(appFriends[i].email);
        });
        setMutualEmails(mutual);
      })
      .catch(() => {});
  }, [friends, user?.email, userProfile?.riotId]);
  const initials = (user?.displayName || user?.email || '?')[0].toUpperCase();
  const joinDate = userProfile?.createdAt
    ? new Date(userProfile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '';

  async function handleLink(e) {
    e.preventDefault();
    setLinkError('');
    const parts = riotInput.trim().split('#');
    if (parts.length !== 2 || !parts[0] || !parts[1]) { setLinkError('Format: name#tag'); return; }
    setLinking(true);
    try {
      await linkRiotId(parts[0].trim(), parts[1].trim());
      setShowLinkForm(false);
      setRiotInput('');
    } catch (e) { setLinkError(e.message); }
    finally { setLinking(false); }
  }

  async function handleAddFriend(e) {
    e.preventDefault();
    setFriendError('');
    const parts = friendInput.trim().split('#');
    if (parts.length !== 2 || !parts[0] || !parts[1]) { setFriendError('Format: name#tag'); return; }
    const [name, tag] = [parts[0].trim(), parts[1].trim()];
    if (friends.some(f => f.name.toLowerCase() === name.toLowerCase() && f.tag.toLowerCase() === tag.toLowerCase())) {
      setFriendError('Already in your list');
      return;
    }
    setAddingFriend(true);
    try {
      await addFriend(name, tag);
      setFriendInput('');
    } catch (e) { setFriendError(e.message); }
    finally { setAddingFriend(false); }
  }

  function handleViewStats(name, tag) {
    loadPlayer(name, tag);
    onBack();
  }

  async function handleSignOut() {
    await signOut();
    onBack();
  }

  return (
    <div className="profile-page">
      <button className="profile-page__back" onClick={onBack}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Back
      </button>

      <div className="profile-page__header">
        <div className="profile-page__avatar">{initials}</div>
        <div className="profile-page__identity">
          <h2 className="profile-page__name">{user?.displayName || user?.email}</h2>
          {joinDate && <span className="profile-page__joined">Member since {joinDate}</span>}
        </div>
      </div>

      {/* Valorant Account */}
      <div className="profile-page__section">
        <p className="profile-page__section-label">Valorant Account</p>
        {riotId ? (
          <div className="profile-page__riot-linked">
            <div className="profile-page__riot-id">
              <span className="profile-page__riot-name">{riotId.name}</span>
              <span className="profile-page__riot-tag">#{riotId.tag}</span>
            </div>
            <div className="profile-page__riot-actions">
              <button className="profile-page__btn profile-page__btn--primary" onClick={() => handleViewStats(riotId.name, riotId.tag)}>
                View Stats
              </button>
              <button className="profile-page__btn profile-page__btn--ghost" onClick={unlinkRiotId}>
                Unlink
              </button>
            </div>
          </div>
        ) : showLinkForm ? (
          <form className="profile-page__link-form" onSubmit={handleLink}>
            <input className="profile-page__input" placeholder="name#tag" value={riotInput} onChange={e => setRiotInput(e.target.value)} autoFocus />
            {linkError && <p className="profile-page__error">{linkError}</p>}
            <div className="profile-page__link-actions">
              <button className="profile-page__btn profile-page__btn--primary" type="submit" disabled={linking}>{linking ? 'Linking…' : 'Link'}</button>
              <button className="profile-page__btn profile-page__btn--ghost" type="button" onClick={() => { setShowLinkForm(false); setLinkError(''); }}>Cancel</button>
            </div>
          </form>
        ) : (
          <div className="profile-page__riot-empty">
            <p className="profile-page__riot-empty-text">No Valorant account linked</p>
            <button className="profile-page__btn profile-page__btn--primary" onClick={() => setShowLinkForm(true)}>Link Riot ID</button>
          </div>
        )}
      </div>

      {/* Friends */}
      <div className="profile-page__section">
        <p className="profile-page__section-label">Friends</p>

        {friends.length > 0 && (
          <ul className="profile-page__friends">
            {friends.map(f => (
              <li key={`${f.name}#${f.tag}`} className="profile-page__friend">
                <span className="profile-page__friend-id">
                  {f.email && mutualEmails.has(f.email) && (
                    <span className="profile-page__mutual-star" title="Mutual friend">★</span>
                  )}
                  <span className="profile-page__friend-name">{f.name}</span>
                  <span className="profile-page__friend-tag">#{f.tag}</span>
                </span>
                <div className="profile-page__friend-actions">
                  {confirmRemove?.name === f.name && confirmRemove?.tag === f.tag ? (
                    <>
                      <span className="profile-page__confirm-label">Remove?</span>
                      <button className="profile-page__friend-btn profile-page__friend-btn--confirm-yes" onClick={() => { removeFriend(f.name, f.tag); setConfirmRemove(null); }}>Yes</button>
                      <button className="profile-page__friend-btn profile-page__friend-btn--confirm-no" onClick={() => setConfirmRemove(null)}>No</button>
                    </>
                  ) : (
                    <>
                      <button className="profile-page__friend-btn" onClick={() => handleViewStats(f.name, f.tag)}>Stats</button>
                      <button className="profile-page__friend-btn profile-page__friend-btn--remove" onClick={() => setConfirmRemove({ name: f.name, tag: f.tag })}>×</button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <form className="profile-page__friend-form" onSubmit={handleAddFriend}>
          <input
            className="profile-page__input profile-page__input--friend"
            placeholder="friend_name#NA1"
            value={friendInput}
            onChange={e => { setFriendInput(e.target.value); setFriendError(''); }}
          />
          {friendError && <p className="profile-page__error">{friendError}</p>}
          <button className="profile-page__btn profile-page__btn--friend" type="submit" disabled={addingFriend}>
            {addingFriend ? '…' : 'Add'}
          </button>
        </form>
      </div>

      <div className="profile-page__section profile-page__section--bottom">
        <button className="profile-page__signout" onClick={handleSignOut}>Sign out</button>
      </div>
    </div>
  );
}
