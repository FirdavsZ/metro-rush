import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { MetroRushGame } from '../game/GameEngine.js';
import { api } from '../api/api.js';
import './GamePage.css';

const POWER_CONFIG = {
  shield:     { icon: '🛡', label: 'Shield',  hint: '1 hit protection' },
  magnet:     { icon: '🧲', label: 'Magnet',  hint: 'Attracts coins'   },
  speedBoost: { icon: '⚡', label: 'Speed',   hint: 'Score ×2'         },
};

export default function GamePage() {
  const canvasRef  = useRef(null);
  const engineRef  = useRef(null);
  const { user }   = useAuth();
  const navigate   = useNavigate();

  const [gameState, setGameState] = useState('idle'); // idle|playing|paused|gameover
  const [stats, setStats] = useState({
    score: 0, coins: 0, distance: 0,
    shield: false, magnet: false, speedBoost: false,
    puTimers: { shield: 0, magnet: 0, speedBoost: 0 },
  });
  const [result, setResult]   = useState(null);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(null); // null | 'best' | 'kept'
  const [saveError, setSaveError] = useState('');

  // Auto-save when game ends and user is logged in
  useEffect(() => {
    if (!result || !user) return;
    setSaving(true);
    setSaveError('');
    api.scores.save(result)
      .then((data) => setSaved(data.newBest ? 'best' : 'kept'))
      .catch((err) => setSaveError(err.message))
      .finally(() => setSaving(false));
  }, [result]);

  // Build engine once
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new MetroRushGame(canvas, {
      onStats: (s) => setStats(s),
      onGameOver: (r) => {
        setResult(r);
        setGameState('gameover');
      },
      onPause: (isPaused) => setGameState(isPaused ? 'paused' : 'playing'),
    });

    engineRef.current = engine;

    // Render idle screen once
    engine._resize();
    engine._render();

    return () => engine.destroy();
  }, []);

  function startGame() {
    setSaved(null);
    setSaveError('');
    setResult(null);
    setStats({ score: 0, coins: 0, distance: 0, shield: false, magnet: false, speedBoost: false, puTimers: { shield: 0, magnet: 0, speedBoost: 0 } });
    setGameState('playing');
    engineRef.current?.start();
  }

  function handlePause() {
    engineRef.current?.togglePause();
  }

  async function saveScore() {
    if (!result || saving || saved) return;
    setSaving(true);
    setSaveError('');
    try {
      await api.scores.save(result);
      setSaved(true);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const handleCanvasClick = useCallback(() => {
    if (gameState === 'paused') engineRef.current?.togglePause();
  }, [gameState]);

  return (
    <div className="game-page">
      {/* HUD */}
      {(gameState === 'playing' || gameState === 'paused') && (
        <div className="game-hud">
          <div className="hud-left">
            <div className="hud-stat">
              <span className="hud-label">SCORE</span>
              <span className="hud-value score-val">{stats.score.toLocaleString()}</span>
            </div>
            <div className="hud-stat">
              <span className="hud-label">COINS</span>
              <span className="hud-value coin-val">{stats.coins}</span>
            </div>
            <div className="hud-stat">
              <span className="hud-label">DIST</span>
              <span className="hud-value">{stats.distance}m</span>
            </div>
          </div>

          <div className="hud-center">
            {Object.entries(POWER_CONFIG).map(([key, cfg]) =>
              stats[key] ? (
                <div key={key} className={`powerup-indicator ${key}`} title={cfg.hint}>
                  <span className="pu-icon">{cfg.icon}</span>
                  <span className="pu-timer">
                    {key === 'shield'
                      ? '1 hit'
                      : `${stats.puTimers?.[key] ?? 0}s`}
                  </span>
                </div>
              ) : null
            )}
          </div>

          <div className="hud-right">
            <button className="pause-btn" onClick={handlePause} title="Pause (P)">
              {gameState === 'paused' ? '▶' : '⏸'}
            </button>
          </div>
        </div>
      )}

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="game-canvas"
        onClick={handleCanvasClick}
      />

      {/* Idle overlay */}
      {gameState === 'idle' && (
        <div className="game-overlay">
          <div className="overlay-content">
            <h1 className="overlay-title">
              <span>METRO</span>
              <span className="title-accent">RUSH</span>
            </h1>
            <p className="overlay-sub">Hi, <strong>{user?.username}</strong>! Ready to run?</p>
            <div className="overlay-controls-hint">
              <span>← → Move</span>
              <span>↑ / Space Jump</span>
              <span>↓ Slide</span>
              <span>P Pause</span>
            </div>
            <button className="btn btn-gold btn-lg" onClick={startGame}>
              START GAME
            </button>

            <div className="pu-legend">
              <div className="pu-legend-title">POWER-UPS</div>
              {Object.entries(POWER_CONFIG).map(([key, cfg]) => (
                <div key={key} className={`pu-legend-row ${key}`}>
                  <span className="pu-legend-icon">{cfg.icon}</span>
                  <span><strong>{cfg.label}</strong> — {cfg.hint}</span>
                </div>
              ))}
            </div>

            <button className="btn btn-outline" onClick={() => navigate('/')}>
              Back to Menu
            </button>
          </div>
        </div>
      )}

      {/* Game Over overlay */}
      {gameState === 'gameover' && result && (
        <div className="game-overlay gameover-overlay">
          <div className="overlay-content gameover-content">
            <div className="gameover-title-wrap">
              <h2 className="gameover-title">GAME OVER</h2>
            </div>

            <div className="gameover-stats">
              <div className="go-stat">
                <span className="go-label">SCORE</span>
                <span className="go-value score-val">{result.score.toLocaleString()}</span>
              </div>
              <div className="go-stat">
                <span className="go-label">COINS</span>
                <span className="go-value coin-val">{result.coins}</span>
              </div>
              <div className="go-stat">
                <span className="go-label">DISTANCE</span>
                <span className="go-value">{result.distance}m</span>
              </div>
            </div>

            <div className="save-section">
              {saving && <div className="alert alert-info">Saving score...</div>}
              {saved === 'best' && <div className="alert alert-success">New personal best! Leaderboard updated.</div>}
              {saved === 'kept' && <div className="alert alert-info">Not a new personal best. Leaderboard unchanged.</div>}
              {saveError && (
                <div className="alert alert-error">
                  {saveError}
                  <button className="btn btn-cyan" style={{ marginTop: 8 }} onClick={saveScore}>
                    Retry
                  </button>
                </div>
              )}
              {!user && (
                <div className="login-to-save">Login to save your score to the leaderboard</div>
              )}
            </div>

            <div className="gameover-actions">
              <button className="btn btn-gold btn-lg" onClick={startGame}>
                Play Again
              </button>
              <button className="btn btn-outline" onClick={() => navigate('/leaderboard')}>
                Leaderboard
              </button>
              <button className="btn btn-outline" onClick={() => navigate('/')}>
                Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile swipe hint */}
      {gameState === 'idle' && (
        <div className="mobile-hint">Swipe to move · Swipe up to jump · Swipe down to slide</div>
      )}
    </div>
  );
}
