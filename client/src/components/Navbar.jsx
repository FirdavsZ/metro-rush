import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import './Navbar.css';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/');
    setMenuOpen(false);
  }

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-logo" onClick={() => setMenuOpen(false)}>
        <span className="navbar-logo-icon">M</span>
        <span className="navbar-logo-text">METRO<span>RUSH</span></span>
      </Link>

      <button
        className={`navbar-burger ${menuOpen ? 'open' : ''}`}
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Toggle menu"
      >
        <span /><span /><span />
      </button>

      <div className={`navbar-links ${menuOpen ? 'open' : ''}`}>
        <Link
          to="/leaderboard"
          className={`navbar-link ${isActive('/leaderboard') ? 'active' : ''}`}
          onClick={() => setMenuOpen(false)}
        >
          Leaderboard
        </Link>

        {user ? (
          <>
            <Link
              to="/game"
              className={`navbar-link ${isActive('/game') ? 'active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              Play
            </Link>
            <Link
              to="/profile"
              className={`navbar-link ${isActive('/profile') ? 'active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              Profile
            </Link>
            <div className="navbar-user">
              <span className="navbar-username">{user.username}</span>
              <button className="btn btn-outline btn-sm" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </>
        ) : (
          <>
            <Link
              to="/login"
              className={`navbar-link ${isActive('/login') ? 'active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              Login
            </Link>
            <Link
              to="/register"
              className="btn btn-primary btn-sm"
              onClick={() => setMenuOpen(false)}
            >
              Register
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
