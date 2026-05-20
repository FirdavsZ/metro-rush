import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import { api } from '../api/api.js';
import './LeaderboardPage.css';

const MEDAL = { 0: '🥇', 1: '🥈', 2: '🥉' };

function formatDate(str) {
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function LeaderboardPage() {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    api.scores.leaderboard()
      .then(setRows)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="lb-page page">
      <Navbar />
      <div className="lb-container">
        <div className="lb-header">
          <h1 className="lb-title">
            <span className="lb-icon">🏆</span> Leaderboard
          </h1>
          <p className="lb-sub">Top 20 Metro Rush runners worldwide</p>
        </div>

        {loading && (
          <div className="lb-loading">
            <div className="loading-spinner" />
          </div>
        )}

        {error && (
          <div className="alert alert-error lb-error">{error}</div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div className="lb-empty">
            <div className="lb-empty-icon">🏃</div>
            <h3>No real scores yet</h3>
            <p>Play the game and save your result to appear here!</p>
            <Link to="/game" className="btn btn-gold">Play Now</Link>
          </div>
        )}

        {!loading && rows.length > 0 && (
          <div className="lb-table-wrap">
            <table className="lb-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Runner</th>
                  <th>Score</th>
                  <th>Coins</th>
                  <th>Distance</th>
                  <th className="lb-date-col">Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={row.id}
                    className={`lb-row ${i < 3 ? `rank-${i}` : ''}`}
                    style={{ animationDelay: `${i * 0.05}s` }}
                  >
                    <td className="lb-rank">
                      {MEDAL[i] || <span className="rank-num">{i + 1}</span>}
                    </td>
                    <td className="lb-username">{row.username}</td>
                    <td className="lb-score">{row.score.toLocaleString()}</td>
                    <td className="lb-coins">
                      <span className="coin-icon">🪙</span>
                      {row.coins}
                    </td>
                    <td className="lb-dist">{row.distance}m</td>
                    <td className="lb-date lb-date-col">{formatDate(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="lb-actions">
          <Link to="/game" className="btn btn-gold">Play & Set a Record</Link>
        </div>
      </div>
    </div>
  );
}
