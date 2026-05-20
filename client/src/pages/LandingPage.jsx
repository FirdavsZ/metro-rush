import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import Navbar from '../components/Navbar.jsx';
import './LandingPage.css';

export default function LandingPage() {
  const { user } = useAuth();
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let t = 0;

    function resize() {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.0003,
      vy: -Math.random() * 0.0005 - 0.0001,
      r: Math.random() * 2 + 1,
      hue: 260 + Math.random() * 60,
    }));

    function draw() {
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -0.01) { p.y = 1.01; p.x = Math.random(); }
        if (p.x < 0) p.x = 1;
        if (p.x > 1) p.x = 0;

        ctx.beginPath();
        ctx.arc(p.x * W, p.y * H, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 100%, 70%, 0.6)`;
        ctx.fill();
      }

      // Animated road lines
      ctx.save();
      for (let i = 0; i < 5; i++) {
        const progress = ((t * 0.0008 + i / 5) % 1);
        const alpha = Math.sin(progress * Math.PI);
        const x = W * 0.5;
        const yStart = H * 0.45 + progress * H * 0.55;
        const spread = progress * W * 0.4;
        ctx.strokeStyle = `rgba(128, 48, 255, ${alpha * 0.3})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, H * 0.45);
        ctx.lineTo(x - spread, yStart);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, H * 0.45);
        ctx.lineTo(x + spread, yStart);
        ctx.stroke();
      }
      ctx.restore();

      t++;
      animId = requestAnimationFrame(draw);
    }

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="landing-page">
      <Navbar />
      <canvas ref={canvasRef} className="landing-canvas" />

      <main className="landing-main">
        <div className="landing-hero">
          <div className="landing-badge">Arcade Endless Runner</div>
          <h1 className="landing-title">
            <span className="title-metro">METRO</span>
            <span className="title-rush">RUSH</span>
          </h1>
          <p className="landing-subtitle">
            Dash through the neon city. Dodge obstacles. Collect coins.<br />
            How far can you go?
          </p>

          <div className="landing-cta">
            <Link to={user ? '/game' : '/register'} className="btn btn-gold btn-lg">
              {user ? 'Play Now' : 'Start Running'}
            </Link>
            <Link to="/leaderboard" className="btn btn-outline btn-lg">
              Leaderboard
            </Link>
            {!user && (
              <Link to="/login" className="btn btn-outline btn-lg">
                Login
              </Link>
            )}
          </div>
        </div>

        <div className="landing-features">
          <div className="feature-card">
            <div className="feature-icon">🏃</div>
            <h3>Endless Runner</h3>
            <p>3-lane track, speed increases over time. How long can you survive?</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">⚡</div>
            <h3>Power-Ups</h3>
            <p>Shield, Magnet, Speed Boost — use them wisely to shatter records.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🏆</div>
            <h3>Leaderboard</h3>
            <p>Compete globally. Top 20 runners are immortalised in the hall of fame.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📱</div>
            <h3>Mobile Ready</h3>
            <p>Swipe to dodge, tap to jump. Full touch support on any device.</p>
          </div>
        </div>

        <div className="landing-controls">
          <h2 className="section-title">Controls</h2>
          <div className="controls-grid">
            {[
              ['A / ←', 'Move Left'],
              ['D / →', 'Move Right'],
              ['W / ↑ / Space', 'Jump'],
              ['S / ↓', 'Slide'],
              ['P', 'Pause'],
              ['Swipe', 'Mobile Control'],
            ].map(([key, action]) => (
              <div key={key} className="control-item">
                <kbd>{key}</kbd>
                <span>{action}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="landing-footer">
        <p>Metro Rush &copy; 2025 — Original arcade game, not affiliated with any existing franchise.</p>
      </footer>
    </div>
  );
}
