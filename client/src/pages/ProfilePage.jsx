import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import Navbar from '../components/Navbar.jsx';
import { api } from '../api/api.js';
import './ProfilePage.css';

function formatDate(str) {
  return new Date(str).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    Promise.all([api.users.me(), api.scores.me()])
      .then(([p, h]) => { setProfile(p); setHistory(h); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <div className="profile-page page">
      <Navbar />
      <div className="profile-container">

        {loading && (
          <div className="profile-loading"><div className="loading-spinner" /></div>
        )}
        {error && <div className="alert alert-error">{error}</div>}

        {profile && (
          <>
            {/* Profile Card */}
            <div className="profile-hero card">
              <div className="profile-avatar">
                {profile.username.charAt(0).toUpperCase()}
              </div>
              <div className="profile-info">
                <h1 className="profile-name">{profile.username}</h1>
                <p className="profile-email">{profile.email}</p>
                <p className="profile-joined">
                  Joined {formatDate(profile.created_at)}
                </p>
              </div>
              <div className="profile-actions">
                <Link to="/game" className="btn btn-gold">Play Now</Link>
                <button className="btn btn-outline" onClick={handleLogout}>Logout</button>
              </div>
            </div>

            {/* Stats */}
            <div className="stats-grid">
              {[
                { label: 'Best Score',    value: profile.best_score?.toLocaleString() || '—', accent: 'cyan' },
                { label: 'Total Coins',   value: profile.total_coins?.toLocaleString() || '0', accent: 'gold' },
                { label: 'Games Played',  value: profile.games_played || '0', accent: 'purple' },
                { label: 'Best Distance', value: profile.best_distance ? `${profile.best_distance}m` : '—', accent: 'green' },
              ].map((s) => (
                <div key={s.label} className={`stat-card card accent-${s.accent}`}>
                  <span className="stat-value">{s.value}</span>
                  <span className="stat-label">{s.label}</span>
                </div>
              ))}
            </div>

            {/* Game History */}
            <div className="history-section">
              <h2 className="history-title">Recent Games</h2>
              {history.length === 0 ? (
                <div className="history-empty">
                  <p>No games played yet.</p>
                  <Link to="/game" className="btn btn-gold btn-sm">Play your first game!</Link>
                </div>
              ) : (
                <div className="history-list">
                  {history.map((g, i) => (
                    <div key={g.id} className="history-item card" style={{ animationDelay: `${i * 0.06}s` }}>
                      <div className="hi-rank">#{i + 1}</div>
                      <div className="hi-stats">
                        <span className="hi-score">{g.score.toLocaleString()}</span>
                        <span className="hi-label">pts</span>
                      </div>
                      <div className="hi-coins">
                        <span>🪙</span>
                        <span>{g.coins}</span>
                      </div>
                      <div className="hi-dist">
                        <span>{g.distance}m</span>
                      </div>
                      <div className="hi-date">{formatDate(g.created_at)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
