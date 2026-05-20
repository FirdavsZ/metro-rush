# Metro Rush 🚇

A full-stack browser endless runner game. Dash through a neon-lit city, dodge obstacles, collect coins, and use power-ups to smash records on the leaderboard.

---

## Project Structure

```
metro-rush/
├── client/                     # Vite + React frontend
│   ├── src/
│   │   ├── api/api.js          # API client (fetch wrapper)
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   └── Navbar.css
│   │   ├── game/
│   │   │   └── GameEngine.js   # Canvas 2D game engine (pseudo-3D)
│   │   ├── pages/
│   │   │   ├── LandingPage.jsx/css
│   │   │   ├── LoginPage.jsx
│   │   │   ├── RegisterPage.jsx
│   │   │   ├── AuthPage.css
│   │   │   ├── GamePage.jsx/css
│   │   │   ├── LeaderboardPage.jsx/css
│   │   │   └── ProfilePage.jsx/css
│   │   ├── styles/global.css
│   │   ├── App.jsx             # Router + AuthContext
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
└── server/                     # Node.js + Express backend
    ├── src/
    │   ├── db/database.js      # SQLite setup + schema
    │   ├── middleware/auth.js  # JWT middleware
    │   ├── controllers/
    │   │   ├── authController.js
    │   │   ├── userController.js
    │   │   └── scoreController.js
    │   ├── routes/
    │   │   ├── auth.js
    │   │   ├── users.js
    │   │   └── scores.js
    │   ├── app.js
    │   └── server.js
    ├── data/                   # SQLite DB file lives here (auto-created)
    ├── seed.js                 # Seed test users & scores
    ├── .env                    # Your local env (git-ignored)
    ├── .env.example
    └── package.json
```

---

## Quick Start

### 1 — Install dependencies

```bash
# Backend
cd server
npm install

# Frontend
cd ../client
npm install
```

### 2 — Configure backend environment

The `.env` file is already created with development defaults. To customise:

```bash
cd server
cp .env.example .env
```

Edit `.env`:

```
PORT=5000
JWT_SECRET=replace_with_a_long_random_string
CLIENT_ORIGIN=http://localhost:5173
NODE_ENV=development
```

### 3 — Seed the database (optional)

Adds 8 test users + leaderboard scores so the leaderboard isn't empty.

```bash
cd server
npm run seed
```

All seeded users have password: `password123`

### 4 — Start the backend

```bash
cd server
npm run dev       # hot-reload with nodemon
# or
npm start         # production
```

Server runs at **http://localhost:5000**

### 5 — Start the frontend

```bash
cd client
npm run dev
```

App runs at **http://localhost:5173**

---

## API Reference

### Auth

| Method | Endpoint             | Body                              | Auth | Description              |
|--------|----------------------|-----------------------------------|------|--------------------------|
| POST   | /api/auth/register   | username, email, password         | —    | Register, returns JWT    |
| POST   | /api/auth/login      | email, password                   | —    | Login, returns JWT       |

### Users

| Method | Endpoint      | Auth    | Description              |
|--------|---------------|---------|--------------------------|
| GET    | /api/users/me | Bearer  | Profile + stats          |

### Scores

| Method | Endpoint              | Body                    | Auth   | Description           |
|--------|-----------------------|-------------------------|--------|-----------------------|
| POST   | /api/scores           | score, coins, distance  | Bearer | Save a game result    |
| GET    | /api/scores/leaderboard | —                     | —      | Top 20 scores (public)|
| GET    | /api/scores/me        | —                       | Bearer | Current user's history|

---

## Game Controls

| Key              | Action     |
|------------------|------------|
| A / ← Arrow      | Move left  |
| D / → Arrow      | Move right |
| W / ↑ / Space    | Jump       |
| S / ↓ Arrow      | Slide      |
| P                | Pause      |
| Swipe left/right | Move lane  |
| Swipe up         | Jump       |
| Swipe down       | Slide      |

---

## Game Mechanics

- **3 lanes** — switch left/right to dodge obstacles
- **Speed increases** automatically over time
- **Obstacles** — some are tall (slide under), some are short (jump over)
- **Coins** — collect for bonus score (+50 pts each)
- **Power-ups:**
  - 🛡 **Shield** — absorbs one collision (5 seconds)
  - 🧲 **Magnet** — pulls nearby coins (8 seconds)
  - ⚡ **Speed Boost** — 1.6× speed + 2× score multiplier (5 seconds)
- **Score** increases continuously with speed + multiplier

---

## Tech Stack

| Layer    | Tech                                      |
|----------|-------------------------------------------|
| Frontend | React 18, Vite, React Router v6, Canvas 2D |
| Backend  | Node.js, Express 4, pg (node-postgres)    |
| Auth     | JWT (jsonwebtoken), bcryptjs              |
| DB       | PostgreSQL                                |
| Styling  | CSS Modules (per-page), CSS variables    |

---

## Database Schema

```sql
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      TEXT    UNIQUE NOT NULL,
  email         TEXT    UNIQUE NOT NULL,
  password_hash TEXT    NOT NULL,
  is_seed       BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scores (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score      INTEGER NOT NULL DEFAULT 0,
  coins      INTEGER NOT NULL DEFAULT 0,
  distance   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Tables are created automatically on server start via `initializeDb()` — no manual migration needed.

---

## Security

- Passwords hashed with **bcrypt** (cost 12)
- JWT tokens expire in **7 days**
- JWT secret loaded from `.env` — never hardcoded
- CORS restricted to `CLIENT_ORIGIN`
- Input validated on both client and server
- Negative scores rejected server-side

---

## Production Build (local test)

```bash
cd client
npm run build          # outputs to client/dist/
npm run preview        # serve the built app locally

cd ../server
NODE_ENV=production npm start
```

---

## Deployment

The recommended stack is **free / cheap tier**:

| Service  | Role     | Free plan |
|----------|----------|-----------|
| Vercel   | Frontend | Yes       |
| Render   | Backend  | Yes (spins down after inactivity) |
| Neon     | Postgres | Yes (0.5 GB) |

---

### Step 1 — PostgreSQL database (Neon — free)

1. Go to **https://neon.tech** → create a free account.
2. Create a new **Project** → copy the **Connection string** that looks like:
   ```
   postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
3. Keep this string — you'll paste it as `DATABASE_URL` in the backend env.

> **Alternatives:** Render Postgres (free 90-day trial), Railway Postgres, Supabase.  
> Any PostgreSQL connection string works — just set `DATABASE_URL`.

---

### Step 2 — Backend on Render (free)

1. Push the repository to **GitHub** (only `metro-rush/` folder needed, or the full repo).
2. Go to **https://render.com** → New → **Web Service**.
3. Connect your GitHub repo.
4. Fill in:

   | Setting         | Value                          |
   |-----------------|-------------------------------|
   | Root Directory  | `server`                       |
   | Runtime         | Node                           |
   | Build Command   | `npm install`                  |
   | Start Command   | `npm start`                    |

5. Add **Environment Variables** (Render dashboard → Environment tab):

   | Key           | Value                                              |
   |---------------|----------------------------------------------------|
   | `NODE_ENV`    | `production`                                       |
   | `PORT`        | `5000` (Render also sets its own PORT automatically)|
   | `JWT_SECRET`  | a long random string (32+ chars)                   |
   | `DATABASE_URL`| your Neon / Render Postgres connection string       |
   | `CLIENT_URL`  | your Vercel frontend URL (fill in after Step 3)    |

6. Deploy → wait for it to go green.
7. **Test health check:**
   ```
   curl https://your-backend.onrender.com/api/health
   # → {"status":"ok","message":"Metro Rush API is running"}
   ```

> **Tip:** Render free tier spins down after 15 min of inactivity. First request after sleep takes ~30 s. Upgrade to a paid plan or use Railway to avoid this.

---

### Step 3 — Frontend on Vercel (free)

1. Go to **https://vercel.com** → New Project → import your GitHub repo.
2. Fill in:

   | Setting          | Value          |
   |------------------|---------------|
   | Root Directory   | `client`       |
   | Build Command    | `npm run build`|
   | Output Directory | `dist`         |

3. Add **Environment Variable**:

   | Key            | Value                                      |
   |----------------|--------------------------------------------|
   | `VITE_API_URL` | `https://your-backend.onrender.com`        |

4. Deploy → Vercel gives you a URL like `https://metro-rush-xyz.vercel.app`.

5. Go back to **Render** and update `CLIENT_URL` to that Vercel URL, then **Manual Deploy** to restart the backend.

> **React Router:** `client/vercel.json` already contains the rewrite rule so all routes (e.g. `/game`, `/leaderboard`) work after page refresh — nothing extra to configure.

---

### Step 4 — Seed demo leaderboard (optional)

Run once after deployment to populate the leaderboard with demo data:

```bash
# locally, pointing at your production DB
DATABASE_URL="postgresql://..." node server/seed.js
```

All seeded users have `is_seed = TRUE` and are **hidden** from the real leaderboard — they only appear until real users play.

---

### Environment variable quick reference

**server/.env** (copy from `server/.env.example`):

```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
JWT_SECRET=change_this_to_a_strong_random_secret
DATABASE_URL=postgresql://postgres:password@localhost:5432/metro_rush
```

**client/.env.local** (copy from `client/.env.example`):

```env
# Leave empty for local dev — Vite proxy handles /api → localhost:5000
VITE_API_URL=
```

In production on Vercel set `VITE_API_URL=https://your-backend.onrender.com`.
