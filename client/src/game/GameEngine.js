// Metro Rush — Game Engine v3
// World-coordinate system. Camera moves forward; objects are fixed in world space.
// Perspective: screenX/Y = f(worldX, relZ) where relZ = worldZ - cameraZ

const lerp  = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rand  = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));

// ── World constants ────────────────────────────────────────────────────────
const CAM_REL_Z    = 180;  // "focal depth" – player appears here from camera
const LANE_W       = 110;  // world-units between lane centres
const FAR_Z        = 820;  // how far ahead objects are spawned
const RENDER_NEAR  = 75;   // stop drawing objects closer than this
const COIN_SPACING = 85;   // world-units between coins in a row
const OBS_HALF_W   = 52;   // obstacle half-width (world units)
const OBS_H_TALL   = 145;  // obstacle height – tall (must slide)
const OBS_H_SHORT  = 68;   // obstacle height – short (must jump)
const COL_Z        = 52;   // collision Z-tolerance (world units)

export class MetroRushGame {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.cb = {
      onStats:    callbacks.onStats    || (() => {}),
      onGameOver: callbacks.onGameOver || (() => {}),
      onPause:    callbacks.onPause    || (() => {}),
    };
    this._resize();
    this._buildBg();
    this._setupInput();
    window.addEventListener('resize', () => this._resize());

    this.state    = 'idle';
    this._animId  = null;
    this._lastTime = 0;
    this._initState();
    this._loop = this._loop.bind(this);
  }

  // ── public ──────────────────────────────────────────────────────────────

  start() {
    this._initState();
    this.state     = 'playing';
    this._lastTime = performance.now();
    this._animId   = requestAnimationFrame(this._loop);
  }

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.cb.onPause(true);
    } else if (this.state === 'paused') {
      this.state     = 'playing';
      this._lastTime = performance.now();
      this.cb.onPause(false);
      this._animId   = requestAnimationFrame(this._loop);
    }
  }

  destroy() {
    if (this._animId) cancelAnimationFrame(this._animId);
    this._removeInput();
    window.removeEventListener('resize', () => this._resize());
  }

  // ── init ────────────────────────────────────────────────────────────────

  _initState() {
    this.score      = 0;
    this.coins      = 0;
    this.distance   = 0;
    this.frame      = 0;
    this.speed      = 2;        // world-units per frame
    this.cameraZ    = 0;        // camera world-Z; increases as player moves forward
    this.multiplier = 1;

    this.player = {
      lane:    1,               // target lane 0/1/2
      laneF:   1.0,             // smooth float
      jumpY:   0,               // height above road (world units, 0 = on ground)
      jumpV:   0,
      jumping: false,
      sliding: false,
      slideT:  0,
      animT:   0,
      blinkT:  0,
    };

    this.pu = { shield: 0, magnet: 0, speedBoost: 0 };

    // World objects – worldZ is a fixed world position
    this.obstacles  = [];
    this.coinItems  = [];
    this.powerItems = [];

    // Next worldZ at which to place the next batch
    this._nextCoinZ  = FAR_Z * 0.25;
    this._nextPowerZ = FAR_Z * 0.65;
    this._nextObsZ   = FAR_Z + 80;   // first obstacle spawned well ahead

    this.flash     = { alpha: 0, color: '#ff0000' };
    this.particles = [];
  }

  // ── resize ──────────────────────────────────────────────────────────────

  _resize() {
    this.W = this.canvas.offsetWidth  || 800;
    this.H = this.canvas.offsetHeight || 500;
    this.canvas.width  = this.W;
    this.canvas.height = this.H;
  }

  // screen Y where the player's feet touch the road
  get _playerY()  { return this.H * 0.80; }
  // horizon / vanishing point Y
  get _horizonY() { return this.H * 0.26; }

  // ── background assets ───────────────────────────────────────────────────

  _buildBg() {
    this._stars = Array.from({ length: 120 }, () => ({
      x: Math.random(), y: Math.random() * 0.38,
      r: rand(0.4, 2), b: rand(0.25, 1),
    }));
    this._buildings = Array.from({ length: 20 }, (_, i) => {
      const w = rand(30, 85), h = rand(55, 210);
      const cols = Math.floor(w / 12);
      const rows = Math.floor(h / 18);
      // Pre-bake window visibility so they don't flicker every frame
      const windows = Array.from({ length: cols * rows }, () => Math.random() < 0.55);
      return {
        x:  i / 20 + rand(-0.025, 0.025),
        w, h, cols, rows, windows,
        p:   rand(0.25, 0.75),
        hue: randInt(255, 315),
        lit: Math.random() > 0.45,
      };
    });
  }

  // ── input ───────────────────────────────────────────────────────────────

  _setupInput() {
    this._onKey = (e) => {
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',
           'Space','KeyA','KeyD','KeyW','KeyS','KeyP'].includes(e.code))
        e.preventDefault();
      this._handleKey(e.code);
    };
    document.addEventListener('keydown', this._onKey);

    let tx = 0, ty = 0;
    this._onTS = (e) => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; };
    this._onTE = (e) => {
      const dx = e.changedTouches[0].clientX - tx;
      const dy = e.changedTouches[0].clientY - ty;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx < -35) this._moveLeft();
        if (dx >  35) this._moveRight();
      } else {
        if (dy < -35) this._doJump();
        if (dy >  35) this._doSlide();
      }
    };
    this.canvas.addEventListener('touchstart', this._onTS, { passive: true });
    this.canvas.addEventListener('touchend',   this._onTE, { passive: true });
  }

  _removeInput() {
    document.removeEventListener('keydown', this._onKey);
    this.canvas.removeEventListener('touchstart', this._onTS);
    this.canvas.removeEventListener('touchend',   this._onTE);
  }

  _handleKey(code) {
    if (code === 'KeyP') { this.togglePause(); return; }
    if (this.state !== 'playing') return;
    if (code === 'ArrowLeft'  || code === 'KeyA') this._moveLeft();
    if (code === 'ArrowRight' || code === 'KeyD') this._moveRight();
    if (code === 'ArrowUp'    || code === 'KeyW' || code === 'Space') this._doJump();
    if (code === 'ArrowDown'  || code === 'KeyS') this._doSlide();
  }

  _moveLeft()  { if (this.player.lane > 0) this.player.lane--; }
  _moveRight() { if (this.player.lane < 2) this.player.lane++; }
  _doJump()    { const p = this.player; if (!p.jumping && !p.sliding) { p.jumping = true; p.jumpV = -20; } }
  _doSlide()   { if (!this.player.jumping) { this.player.sliding = true; this.player.slideT = 55; } }

  // ── loop ────────────────────────────────────────────────────────────────

  _loop(now) {
    const dt = clamp((now - this._lastTime) / 16.667, 0.1, 3);
    this._lastTime = now;
    if (this.state === 'playing') this._update(dt);
    this._render();
    if (this.state !== 'dead') this._animId = requestAnimationFrame(this._loop);
  }

  // ── update ──────────────────────────────────────────────────────────────

  _update(dt) {
    this.frame++;

    // sqrt ramp: comfortable start, slow build.
    // 0 s → 2 | 30 s → 2.7 | 1 min → 3.2 | 2 min → 3.9 | 4 min → 5 | cap 7
    this.speed      = Math.min(2 + Math.sqrt(this.frame * 0.0009), 7);
    const spd       = this.pu.speedBoost > 0 ? this.speed * 1.4 : this.speed;
    this.multiplier = this.pu.speedBoost > 0 ? 2 : 1;

    // Camera advances → player "runs forward"
    this.cameraZ  += spd * dt;
    this.distance += spd * 0.12 * dt;
    this.score    += spd * this.multiplier * 0.6 * dt;

    this._updatePlayer(dt);

    if (this.pu.shield     > 0) this.pu.shield     -= dt;
    if (this.pu.magnet     > 0) this.pu.magnet     -= dt;
    if (this.pu.speedBoost > 0) this.pu.speedBoost -= dt;

    this._spawn();

    // Remove objects that are behind the camera (ran past player)
    const cz = this.cameraZ;
    this.obstacles  = this.obstacles.filter(o => o.worldZ - cz > -30);
    this.coinItems  = this.coinItems.filter(c => !c.collected && c.worldZ - cz > -30);
    this.powerItems = this.powerItems.filter(p => p.worldZ - cz > -30);

    if (this.pu.magnet > 0) this._magnetPull();

    this.particles = this.particles.filter(p => {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 0.3 * dt; p.life -= dt;
      return p.life > 0;
    });

    this._collide();

    if (this.flash.alpha > 0) this.flash.alpha -= 0.04 * dt;

    this.cb.onStats({
      score:      Math.floor(this.score),
      coins:      this.coins,
      distance:   Math.floor(this.distance),
      shield:     this.pu.shield     > 0,
      magnet:     this.pu.magnet     > 0,
      speedBoost: this.pu.speedBoost > 0,
      // seconds remaining for each active power-up (dt ≈ 1/frame at 60fps → /60 = seconds)
      puTimers: {
        shield:     Math.max(0, Math.ceil(this.pu.shield     / 60)),
        magnet:     Math.max(0, Math.ceil(this.pu.magnet     / 60)),
        speedBoost: Math.max(0, Math.ceil(this.pu.speedBoost / 60)),
      },
    });
  }

  _updatePlayer(dt) {
    const p = this.player;
    p.laneF = lerp(p.laneF, p.lane, clamp(0.18 * dt * 3, 0, 1));

    if (p.jumping) {
      p.jumpV += 1.1 * dt;
      p.jumpY -= p.jumpV * dt;
      if (p.jumpY <= 0) { p.jumpY = 0; p.jumpV = 0; p.jumping = false; }
    }

    if (p.sliding && (p.slideT -= dt) <= 0) { p.sliding = false; p.slideT = 0; }
    if (p.blinkT > 0) p.blinkT -= dt;
    p.animT += 0.35 * dt;
  }

  // ── spawn (world-space) ─────────────────────────────────────────────────

  _spawn() {
    const horizon = this.cameraZ + FAR_Z;

    // Coins – evenly spaced rows ahead
    while (this._nextCoinZ < horizon) {
      const lane  = randInt(0, 2);
      const count = randInt(4, 7);
      for (let i = 0; i < count; i++) {
        this.coinItems.push({
          lane,
          worldZ:    this._nextCoinZ + i * COIN_SPACING,
          collected: false,
        });
      }
      this._nextCoinZ += COIN_SPACING * count + rand(120, 260);
    }

    // Power-ups
    while (this._nextPowerZ < horizon) {
      const types = ['shield', 'magnet', 'speed'];
      this.powerItems.push({
        lane:   randInt(0, 2),
        worldZ: this._nextPowerZ,
        type:   types[randInt(0, 2)],
      });
      this._nextPowerZ += rand(420, 640);
    }

    // Obstacles
    while (this._nextObsZ < horizon) {
      this._placeObstacle(this._nextObsZ);
      // Gap shrinks slowly as speed grows; floor at 290 world-units
      const gap = Math.max(290, 480 - this.speed * 22);
      this._nextObsZ += rand(gap * 0.85, gap * 1.2);
    }
  }

  _placeObstacle(worldZ) {
    const lane   = randInt(0, 2);
    const tall   = Math.random() < 0.35;
    const dbl    = this.frame > 600 && Math.random() < 0.12;
    if (dbl) {
      const s = randInt(0, 1);
      this.obstacles.push({ lane: s,     worldZ, tall });
      this.obstacles.push({ lane: s + 1, worldZ, tall });
    } else {
      this.obstacles.push({ lane, worldZ, tall });
    }
  }

  // ── magnet ──────────────────────────────────────────────────────────────

  _magnetPull() {
    const pZ = this.cameraZ + CAM_REL_Z;
    const p  = this.player;
    for (const c of this.coinItems) {
      if (Math.abs(c.worldZ - pZ) < 260 && Math.abs(c.lane - p.laneF) < 2.5) {
        c.lane   = lerp(c.lane,   p.laneF, 0.06);
        c.worldZ = lerp(c.worldZ, pZ,      0.03);
      }
    }
  }

  // ── collision (world-space) ──────────────────────────────────────────────

  _collide() {
    const p   = this.player;
    const pZ  = this.cameraZ + CAM_REL_Z;   // player world-Z
    const LT  = 0.48;                        // lane tolerance

    // Obstacles
    if (p.blinkT <= 0) {
      for (const obs of this.obstacles) {
        if (Math.abs(obs.worldZ - pZ) < COL_Z && Math.abs(obs.lane - p.laneF) < LT) {
          if (obs.tall && p.sliding)       continue; // slid under
          if (!obs.tall && p.jumpY > 20)   continue; // jumped over
          this._hit();
          return;
        }
      }
    }

    // Coins
    for (const c of this.coinItems) {
      if (Math.abs(c.worldZ - pZ) < COL_Z && Math.abs(c.lane - p.laneF) < LT) {
        c.collected = true;
        this.coins++;
        this.score += 50 * this.multiplier;
        const { sx, sy } = this._project(c.lane, c.worldZ);
        this._burst(sx, sy);
      }
    }

    // Power-ups
    for (let i = this.powerItems.length - 1; i >= 0; i--) {
      const pu = this.powerItems[i];
      if (Math.abs(pu.worldZ - pZ) < COL_Z && Math.abs(pu.lane - p.laneF) < LT) {
        this._activatePu(pu.type);
        this.powerItems.splice(i, 1);
      }
    }
  }

  _hit() {
    if (this.pu.shield > 0) {
      this.pu.shield    = 0;
      this.player.blinkT = 90;
      this.flash = { alpha: 0.5, color: '#4488ff' };
      return;
    }
    this.state = 'gameover';
    this.flash = { alpha: 0.7, color: '#ff2020' };
    this.cb.onGameOver({
      score:    Math.floor(this.score),
      coins:    this.coins,
      distance: Math.floor(this.distance),
    });
  }

  _activatePu(type) {
    const D = 60; // frames
    if (type === 'shield') this.pu.shield     = 5 * D;
    if (type === 'magnet') this.pu.magnet     = 8 * D;
    if (type === 'speed')  this.pu.speedBoost = 5 * D;
    const col = { shield: '#4488ff', magnet: '#ff44ff', speed: '#44ffaa' }[type];
    this.flash = { alpha: 0.25, color: col };
  }

  // ── particles ───────────────────────────────────────────────────────────

  _burst(x, y) {
    for (let i = 0; i < 8; i++) {
      this.particles.push({
        x, y,
        vx: rand(-3, 3), vy: rand(-5, -1),
        life: rand(14, 28), r: rand(2, 5), hue: rand(40, 55),
      });
    }
  }

  // ── projection  (world → screen) ─────────────────────────────────────────
  //
  //  relZ  = worldZ - cameraZ   (distance ahead of camera; > 0 = in front)
  //  t     = CAM_REL_Z / relZ   (perspective scale; 1.0 at player depth)
  //  sx    = W/2  + worldX * t
  //  sy    = horizonY + (playerY - horizonY) * t
  //
  //  laneWorldX: lane 0 → -LANE_W, lane 1 → 0, lane 2 → +LANE_W

  _laneX(laneF)    { return (laneF - 1) * LANE_W; }

  _project(laneF, worldZ) {
    const relZ = worldZ - this.cameraZ;
    if (relZ < 1) return { sx: this.W / 2, sy: this.H + 50, scale: 0 };
    const t     = CAM_REL_Z / relZ;
    const scale = clamp(t, 0.02, 2.2);
    const sx    = this.W / 2 + this._laneX(laneF) * t;
    const sy    = this._horizonY + (this._playerY - this._horizonY) * t;
    return { sx, sy, scale };
  }

  // relZ at which screenY = H (road continues below player to screen bottom)
  get _relZ_bottom() {
    return CAM_REL_Z * (this._playerY - this._horizonY) / (this.H - this._horizonY);
  }

  // ── render ──────────────────────────────────────────────────────────────

  _render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);
    this._drawSky();
    this._drawBuildings();
    this._drawRoad();
    this._drawEntities();
    this._drawPlayer();
    this._drawParticles();
    if (this.pu.speedBoost > 0 && this.state === 'playing') this._drawSpeedLines();
    if (this.flash.alpha > 0) {
      const a = Math.round(clamp(this.flash.alpha, 0, 1) * 255).toString(16).padStart(2, '0');
      ctx.fillStyle = this.flash.color + a;
      ctx.fillRect(0, 0, this.W, this.H);
    }
    if (this.state === 'paused') this._drawPause();
  }

  _drawSpeedLines() {
    const ctx = this.ctx, W = this.W, H = this.H;
    ctx.save();
    const n = 22;
    for (let i = 0; i < n; i++) {
      const y      = rand(H * 0.22, H * 0.96);
      const onLeft = i < n / 2;
      const x      = onLeft ? rand(0, W * 0.30) : rand(W * 0.70, W);
      const len    = rand(W * 0.05, W * 0.22);
      const alpha  = rand(0.05, 0.20);
      ctx.strokeStyle = `rgba(68,255,170,${alpha})`;
      ctx.lineWidth   = rand(0.8, 2.4);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(onLeft ? x - len : x + len, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawSky() {
    const ctx = this.ctx, W = this.W, H = this.H;
    const skyH = H * 0.42;
    const g = ctx.createLinearGradient(0, 0, 0, skyH);
    g.addColorStop(0, '#080014'); g.addColorStop(1, '#160030');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, skyH);

    const off = this.cameraZ * 0.016;
    for (const s of this._stars) {
      const sy = ((s.y * H + off * 0.18) % skyH + skyH) % skyH;
      ctx.globalAlpha = s.b * 0.85;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(s.x * W, sy, s.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  _drawBuildings() {
    const ctx = this.ctx, W = this.W, H = this.H;
    const skyH = H * 0.42;
    for (const b of this._buildings) {
      const scrollX = (this.cameraZ * b.p * 0.04) % W;
      const bx = ((b.x * W - b.w / 2 - scrollX + W * 2) % (W + b.w)) - b.w;
      const by = skyH - b.h;

      // Building body
      ctx.fillStyle = `hsl(${b.hue},30%,5%)`;
      ctx.fillRect(bx, by, b.w, b.h + 4);

      // Neon roof edge
      ctx.strokeStyle = `hsl(${b.hue},100%,52%)`;
      ctx.lineWidth = 1.8; ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + b.w, by); ctx.stroke();
      ctx.globalAlpha = 1;

      // Antenna on taller buildings
      if (b.h > 130) {
        ctx.strokeStyle = `rgba(255,100,100,0.7)`;
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(bx + b.w * 0.5, by); ctx.lineTo(bx + b.w * 0.5, by - 14); ctx.stroke();
        ctx.fillStyle = `rgba(255,60,60,${0.5 + 0.5 * Math.sin(this.frame * 0.04)})`;
        ctx.beginPath(); ctx.arc(bx + b.w * 0.5, by - 14, 2, 0, Math.PI * 2); ctx.fill();
      }

      // Pre-baked windows (no flicker)
      if (b.lit) {
        ctx.fillStyle = 'rgba(255,218,90,0.44)';
        for (let r = 0; r < b.rows; r++) {
          for (let c = 0; c < b.cols; c++) {
            if (b.windows[r * b.cols + c]) {
              ctx.fillRect(bx + 6 + c * 12, by + 12 + r * 18, 7, 9);
            }
          }
        }
      }
    }
  }

  _drawRoad() {
    const ctx = this.ctx, W = this.W, H = this.H;
    const horizY   = this._horizonY;
    const playerY  = this._playerY;
    const relZBot  = this._relZ_bottom;
    const sBot     = CAM_REL_Z / relZBot;
    const halfRoad = LANE_W * 1.5;
    const botL     = W / 2 - halfRoad * sBot;
    const botR     = W / 2 + halfRoad * sBot;
    // Sidewalk panels extend beyond road
    const botLW    = W / 2 - halfRoad * sBot * 2.5;
    const botRW    = W / 2 + halfRoad * sBot * 2.5;

    // ── Background ground ─────────────────────────────────────────
    const gnd = ctx.createLinearGradient(0, H * 0.35, 0, H);
    gnd.addColorStop(0, '#07001a'); gnd.addColorStop(1, '#03000a');
    ctx.fillStyle = gnd;
    ctx.fillRect(0, H * 0.35, W, H * 0.65);

    // ── Sidewalk panels (outside the road) ────────────────────────
    const panelG = ctx.createLinearGradient(0, horizY, 0, H);
    panelG.addColorStop(0, '#0d002a'); panelG.addColorStop(1, '#070018');
    ctx.fillStyle = panelG;
    ctx.beginPath();
    ctx.moveTo(W / 2, horizY); ctx.lineTo(botLW, H); ctx.lineTo(botL, H);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(W / 2, horizY); ctx.lineTo(botR, H); ctx.lineTo(botRW, H);
    ctx.closePath(); ctx.fill();

    // ── Road surface ──────────────────────────────────────────────
    const roadG = ctx.createLinearGradient(0, horizY, 0, H);
    roadG.addColorStop(0, '#0a0024'); roadG.addColorStop(1, '#140038');
    ctx.fillStyle = roadG;
    ctx.beginPath();
    ctx.moveTo(W / 2, horizY); ctx.lineTo(botR, H); ctx.lineTo(botL, H);
    ctx.closePath(); ctx.fill();

    // ── Horizontal depth grid (perspective-animated tiles) ────────
    const animG = ((this.cameraZ * 0.008) % 1 + 1) % 1;
    for (let i = 0; i < 14; i++) {
      const t = ((i / 14) + animG) % 1;
      if (t < 0.04 || t > 0.98) continue;
      const sy = horizY + (playerY - horizY) * t;
      if (sy < horizY || sy > H + 2) continue;
      const lx = W / 2 - halfRoad * t;
      const rx = W / 2 + halfRoad * t;
      ctx.strokeStyle = `rgba(90,50,190,${t * 0.18})`;
      ctx.lineWidth = Math.max(0.4, t * 0.85);
      ctx.beginPath(); ctx.moveTo(lx, sy); ctx.lineTo(rx, sy); ctx.stroke();
    }

    // ── Street lights along both sides ───────────────────────────
    const lSpacing = 180; // world units between poles
    const firstLZ  = Math.ceil((this.cameraZ + RENDER_NEAR) / lSpacing) * lSpacing;
    for (let wZ = firstLZ; wZ < this.cameraZ + FAR_Z * 0.92; wZ += lSpacing) {
      const relZ = wZ - this.cameraZ;
      if (relZ < RENDER_NEAR) continue;
      const t     = CAM_REL_Z / relZ;
      const psy   = horizY + (playerY - horizY) * t;
      const poleH = 55 * t;
      const armL  = 15 * t;
      const alpha = Math.min(t * 0.72, 0.65);

      ctx.strokeStyle = `rgba(155,115,255,${alpha})`;
      ctx.lineWidth   = Math.max(0.8, t * 1.8);

      // Left pole
      const lx = W / 2 - halfRoad * t * 1.78;
      ctx.beginPath(); ctx.moveTo(lx, psy); ctx.lineTo(lx, psy - poleH); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(lx, psy - poleH); ctx.lineTo(lx + armL, psy - poleH); ctx.stroke();

      // Right pole
      const rx2 = W / 2 + halfRoad * t * 1.78;
      ctx.beginPath(); ctx.moveTo(rx2, psy); ctx.lineTo(rx2, psy - poleH); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(rx2, psy - poleH); ctx.lineTo(rx2 - armL, psy - poleH); ctx.stroke();

      // Light bulbs + glow cone
      if (t > 0.15) {
        ctx.shadowColor = '#cc88ff'; ctx.shadowBlur = 8 * t;
        ctx.fillStyle   = `rgba(220,175,255,${alpha})`;
        ctx.beginPath(); ctx.arc(lx + armL,  psy - poleH, 2.8 * t, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(rx2 - armL, psy - poleH, 2.8 * t, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        // Soft light cone on road
        if (t > 0.35) {
          const coneAlpha = (t - 0.35) * 0.10;
          [lx + armL, rx2 - armL].forEach(bx => {
            const cg = ctx.createRadialGradient(bx, psy - poleH, 0, bx, psy, 38 * t);
            cg.addColorStop(0, `rgba(180,120,255,${coneAlpha})`);
            cg.addColorStop(1, 'transparent');
            ctx.fillStyle = cg;
            ctx.beginPath(); ctx.arc(bx, psy, 38 * t, 0, Math.PI * 2); ctx.fill();
          });
        }
      }
    }

    // ── Glowing road-edge rails ───────────────────────────────────
    ctx.save();
    ctx.shadowColor = '#7030ff'; ctx.shadowBlur = 14;
    ctx.strokeStyle = '#6020dd'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(W / 2, horizY); ctx.lineTo(botL, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W / 2, horizY); ctx.lineTo(botR, H); ctx.stroke();

    // Inner lane rails (subtle)
    [-1, 0, 1].forEach(lxW => {
      const bx = W / 2 + lxW * LANE_W * sBot;
      ctx.strokeStyle = 'rgba(130,75,255,0.28)';
      ctx.lineWidth = 1.0; ctx.shadowBlur = 3;
      ctx.beginPath(); ctx.moveTo(W / 2, horizY); ctx.lineTo(bx, H); ctx.stroke();
    });
    ctx.restore();

    // ── Animated lane-divider dashes (1/relZ interpolation) ───────
    const invNear = 1 / relZBot;
    const invFar  = 1 / (FAR_Z * 0.14);
    const N       = 22, DUTY = 0.42;
    const animOff = ((this.cameraZ * 0.009) % 1 + 1) % 1;
    for (let lane = 1; lane < 3; lane++) {
      const divX = (lane - 1.5) * LANE_W;
      for (let i = 0; i < N; i++) {
        const t0 = ((i / N) + animOff) % 1;
        const t1 = t0 + DUTY / N;
        if (t1 > 1) continue;
        const inv0 = lerp(invNear, invFar, t0);
        const inv1 = lerp(invNear, invFar, t1);
        const s0   = CAM_REL_Z * inv0;
        const s1   = CAM_REL_Z * inv1;
        const x0 = W / 2 + divX * s0, y0 = horizY + (playerY - horizY) * s0;
        const x1 = W / 2 + divX * s1, y1 = horizY + (playerY - horizY) * s1;
        ctx.strokeStyle = `rgba(105,65,255,${Math.min(s0 * 0.46, 0.67)})`;
        ctx.lineWidth   = clamp(s0 * 2.8, 0.5, 3.5);
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      }
    }
  }

  // ── entities ────────────────────────────────────────────────────────────

  _drawEntities() {
    const visible = [
      ...this.obstacles.map(o  => ({ ...o,  kind: 'obs'  })),
      ...this.coinItems.filter(c => !c.collected).map(c => ({ ...c, kind: 'coin' })),
      ...this.powerItems.map(p  => ({ ...p,  kind: 'pu'   })),
    ].filter(e => {
      const relZ = e.worldZ - this.cameraZ;
      return relZ > RENDER_NEAR && relZ < FAR_Z;
    }).sort((a, b) => b.worldZ - a.worldZ); // far → near

    for (const e of visible) {
      if (e.kind === 'obs')  this._drawObs(e);
      if (e.kind === 'coin') this._drawCoin(e);
      if (e.kind === 'pu')   this._drawPu(e);
    }
  }

  // helper — diagonal hazard stripes clipped to a rect
  _drawStripeBar(ctx, x, y, w, h, scale, col1, col2) {
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    const sw = h * 1.3;
    const n  = Math.ceil((w + h) / sw) + 3;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i % 2 === 0 ? col1 : col2;
      ctx.beginPath();
      ctx.moveTo(x + i * sw - h,       y);
      ctx.lineTo(x + i * sw,           y);
      ctx.lineTo(x + (i + 1) * sw - h, y + h);
      ctx.lineTo(x + (i - 1) * sw,     y + h);
      ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = Math.max(scale, 0.5);
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }

  _drawObs(obs) {
    const ctx = this.ctx;
    const { sx, sy, scale } = this._project(obs.lane, obs.worldZ);
    if (scale < 0.03) return;
    const w  = OBS_HALF_W * 2 * scale;
    const h  = (obs.tall ? OBS_H_TALL : OBS_H_SHORT) * scale;
    const rx = sx - w / 2;

    // ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath(); ctx.ellipse(sx, sy, w * 0.5, 5 * scale, 0, 0, Math.PI * 2); ctx.fill();

    if (obs.tall) {
      // ── GATE BARRICADE — player must slide under ──────────────────
      const ry    = sy - h;
      const postW = Math.max(w * 0.1, 3 * scale);

      // Vertical posts
      ctx.fillStyle = '#2a1800';
      ctx.fillRect(rx,               ry, postW, h);
      ctx.fillRect(rx + w - postW,   ry, postW, h);

      // Post highlight
      ctx.fillStyle = '#553300';
      ctx.fillRect(rx,             ry, postW * 0.4, h);
      ctx.fillRect(rx + w - postW, ry, postW * 0.4, h);

      const barX = rx + postW;
      const barW = w - postW * 2;

      // Upper bar — red / white stripes
      const b1y = ry + h * 0.06, b1h = h * 0.22;
      this._drawStripeBar(ctx, barX, b1y, barW, b1h, scale, '#cc1500', '#eeeeee');

      // Lower bar — red / yellow stripes
      const b2y = ry + h * 0.44, b2h = h * 0.17;
      this._drawStripeBar(ctx, barX, b2y, barW, b2h, scale, '#cc1500', '#ffcc00');

      // Glowing post caps
      ctx.shadowColor = '#ff6600'; ctx.shadowBlur = 10 * scale;
      ctx.fillStyle = '#ff7700';
      ctx.beginPath(); ctx.arc(rx + postW / 2,      ry, postW * 0.85, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(rx + w - postW / 2,  ry, postW * 0.85, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;

      // Label
      if (scale > 0.28) {
        ctx.fillStyle = '#ff5500';
        ctx.font = `bold ${Math.round(8 * scale)}px Orbitron,monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('STOP', sx, ry + h * 0.75);
      }

    } else {
      // ── LOW BARRIER — player must jump over ───────────────────────
      const bh = h * 0.68;
      const by = sy - bh;

      // Concrete block base
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(rx, by, w, bh);

      // Hazard stripes (lower 70% of block)
      this._drawStripeBar(ctx, rx, by + bh * 0.22, w, bh * 0.58, scale, '#aa1a00', '#ffbb00');

      // Top surface (lighter concrete)
      ctx.fillStyle = '#2c2c44';
      ctx.fillRect(rx, by, w, bh * 0.22);

      // Bottom shadow strip
      ctx.fillStyle = '#0d0d1a';
      ctx.fillRect(rx, by + bh * 0.8, w, bh * 0.2);

      // Glow outline
      ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 12 * scale;
      ctx.strokeStyle = '#ff5500'; ctx.lineWidth = 1.8 * scale;
      ctx.strokeRect(rx, by, w, bh);
      ctx.shadowBlur = 0;

      // Traffic cones on top
      if (scale > 0.2) {
        const nCones = 3;
        for (let ci = 0; ci < nCones; ci++) {
          const cx    = rx + w * (ci + 0.5) / nCones;
          const coneH = bh * 0.72;
          const coneW = w / nCones * 0.48;

          ctx.fillStyle = '#ff5500';
          ctx.beginPath();
          ctx.moveTo(cx, by - coneH);
          ctx.lineTo(cx - coneW / 2, by);
          ctx.lineTo(cx + coneW / 2, by);
          ctx.closePath(); ctx.fill();

          // White reflective stripe
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(cx - coneW * 0.22, by - coneH * 0.60);
          ctx.lineTo(cx + coneW * 0.22, by - coneH * 0.60);
          ctx.lineTo(cx + coneW * 0.30, by - coneH * 0.38);
          ctx.lineTo(cx - coneW * 0.30, by - coneH * 0.38);
          ctx.closePath(); ctx.fill();
        }
      }
    }
  }

  _drawCoin(coin) {
    const ctx = this.ctx;
    const { sx, sy, scale } = this._project(coin.lane, coin.worldZ);
    if (scale < 0.03) return;
    const r = clamp(10 * scale, 2, 13);

    // Coin-flip animation: squish X → looks like coin spinning in place
    const flipX = Math.max(0.08, Math.abs(Math.sin(this.frame * 0.09 + coin.worldZ * 0.018)));

    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(flipX, 1);
    ctx.shadowColor = '#ffcc00'; ctx.shadowBlur = 14 * scale;

    // Gold radial gradient
    const cg = ctx.createRadialGradient(-r * 0.3, -r * 0.35, 0, 0, 0, r);
    cg.addColorStop(0,    '#fff5a0');
    cg.addColorStop(0.45, '#ffcc00');
    cg.addColorStop(1,    '#aa6600');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();

    // Inner ring
    ctx.strokeStyle = '#ffee66'; ctx.lineWidth = 1.3 * scale;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.68, 0, Math.PI * 2); ctx.stroke();

    // Symbol inside
    if (r > 5) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#7a4400';
      ctx.font = `bold ${Math.round(r * 1.1)}px monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('₵', 0, r * 0.06); // ₵ (Cedi sign — looks like a coin symbol)
    }
    ctx.restore();

    // Sparkle dots orbiting the coin when facing front (flipX near 1)
    if (flipX > 0.72 && r > 5) {
      const alpha = (flipX - 0.72) / 0.28;
      ctx.shadowBlur = 0;
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2 + this.frame * 0.14;
        const pr    = r * 1.55;
        ctx.fillStyle = `rgba(255,220,50,${(alpha * 0.9).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(sx + Math.cos(angle) * pr, sy + Math.sin(angle) * pr, r * 0.16, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  _drawPu(pu) {
    const ctx = this.ctx;
    const { sx, sy, scale } = this._project(pu.lane, pu.worldZ);
    if (scale < 0.03) return;
    const r      = clamp(18 * scale, 3, 22);
    const bounce = Math.sin(this.frame * 0.06) * 4 * scale;
    const cy     = sy + bounce;

    const cfg = {
      shield: { color: '#4488ff', glow: '#2255ff' },
      magnet: { color: '#ee44ff', glow: '#aa00cc' },
      speed:  { color: '#44ffaa', glow: '#00cc66' },
    }[pu.type];

    ctx.save();

    // Glowing outer ring
    ctx.shadowColor = cfg.glow; ctx.shadowBlur = 22 * scale;
    ctx.strokeStyle = cfg.color; ctx.lineWidth = 2.2 * scale;
    ctx.beginPath(); ctx.arc(sx, cy, r, 0, Math.PI * 2); ctx.stroke();

    // Soft fill background
    const bg = ctx.createRadialGradient(sx, cy, 0, sx, cy, r);
    bg.addColorStop(0, cfg.color + '50'); bg.addColorStop(1, cfg.glow + '10');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.arc(sx, cy, r, 0, Math.PI * 2); ctx.fill();

    ctx.shadowBlur = 0;

    if (pu.type === 'shield') {
      // ── SHIELD SHAPE (pointed heraldic shield) ──────────────────
      const sw = r * 1.05, sh = r * 1.25;
      ctx.fillStyle = '#88bbff';
      ctx.beginPath();
      ctx.moveTo(sx - sw / 2, cy - sh * 0.44);    // top-left
      ctx.lineTo(sx + sw / 2, cy - sh * 0.44);    // top-right
      ctx.lineTo(sx + sw / 2, cy + sh * 0.05);    // right
      ctx.lineTo(sx,          cy + sh * 0.56);    // bottom point
      ctx.lineTo(sx - sw / 2, cy + sh * 0.05);    // left
      ctx.closePath(); ctx.fill();
      // Vertical stripe accent
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2 * scale; ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(sx, cy - sh * 0.34);
      ctx.lineTo(sx, cy + sh * 0.28);
      ctx.stroke();
      ctx.globalAlpha = 1;

    } else if (pu.type === 'magnet') {
      // ── U-SHAPE HORSESHOE MAGNET ─────────────────────────────────
      const mw    = r * 1.05;
      const mh    = r * 0.55;  // how far down the arms extend below the arch
      const thick = Math.max(r * 0.30, 2.2);
      const archY = cy - r * 0.18;  // arch centre Y

      ctx.lineWidth = thick;
      ctx.strokeStyle = '#dd44ff';
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx - mw / 2, cy + mh);        // left arm bottom
      ctx.lineTo(sx - mw / 2, archY);           // left arm up
      ctx.arc(sx, archY, mw / 2, Math.PI, 0, false); // arch top
      ctx.lineTo(sx + mw / 2, cy + mh);        // right arm bottom
      ctx.stroke();
      ctx.lineCap = 'butt';

      // Pole tips: N = red, S = blue
      const tipH = thick * 1.1, tipW = thick;
      ctx.fillStyle = '#ff3333'; // North
      ctx.fillRect(sx - mw / 2 - tipW / 2, cy + mh, tipW, tipH);
      ctx.fillStyle = '#4477ff'; // South
      ctx.fillRect(sx + mw / 2 - tipW / 2, cy + mh, tipW, tipH);

    } else if (pu.type === 'speed') {
      // ── LIGHTNING BOLT ───────────────────────────────────────────
      const lh = r * 1.55, lw = r * 0.85;
      ctx.fillStyle = '#66ffbb';
      ctx.beginPath();
      ctx.moveTo(sx + lw * 0.30,  cy - lh / 2);       // top
      ctx.lineTo(sx - lw * 0.30,  cy + lh * 0.06);    // mid-left
      ctx.lineTo(sx + lw * 0.15,  cy + lh * 0.06);    // mid-right kink
      ctx.lineTo(sx - lw * 0.30,  cy + lh / 2);       // bottom
      ctx.lineTo(sx + lw * 0.30,  cy - lh * 0.06);    // mid-right
      ctx.lineTo(sx - lw * 0.15,  cy - lh * 0.06);    // mid-left kink
      ctx.closePath(); ctx.fill();
    }

    ctx.restore();
  }

  // ── player ──────────────────────────────────────────────────────────────

  _drawPlayer() {
    const ctx = this.ctx, p = this.player;
    if (p.blinkT > 0 && Math.floor(p.blinkT / 6) % 2 === 0) return;

    const { sx, sy, scale } = this._project(p.laneF, this.cameraZ + CAM_REL_Z);
    const py    = sy - p.jumpY * scale;
    const bodyH = p.sliding ? 22 * scale : 52 * scale;
    const bodyW = 28 * scale;
    const headR = 11 * scale;
    const ry    = py - bodyH;
    const anim  = Math.sin(p.animT * Math.PI * 2);

    ctx.save();

    // Ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(sx, sy, bodyW * 0.88, 5 * scale, 0, 0, Math.PI * 2); ctx.fill();

    // Shield bubble
    if (this.pu.shield > 0) {
      const pulseR = Math.max(bodyW, bodyH / 2) * 1.1 + (6 + Math.sin(this.frame * 0.12) * 3) * scale;
      ctx.shadowColor = '#4488ff'; ctx.shadowBlur = 30 * scale;
      ctx.strokeStyle = 'rgba(68,136,255,0.78)'; ctx.lineWidth = 2.2 * scale;
      ctx.beginPath(); ctx.arc(sx, ry + bodyH / 2, pulseR, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = '#4488ff';
      ctx.beginPath(); ctx.arc(sx, ry + bodyH / 2, pulseR, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    }

    if (p.sliding) {
      // ── SLIDE pose ─────────────────────────────────────────────
      // Extended body (horizontal crouch)
      const slideW = bodyW * 1.5;
      const bg = ctx.createLinearGradient(sx - slideW/2, ry, sx + slideW/2, ry + bodyH);
      bg.addColorStop(0, '#1a60e8'); bg.addColorStop(1, '#0c3a9a');
      ctx.fillStyle = bg;
      this._rrect(ctx, sx - slideW/2, ry, slideW, bodyH, 5 * scale);
      // Jacket center stripe
      ctx.fillStyle = 'rgba(255,255,255,0.13)';
      ctx.fillRect(sx - slideW*0.06, ry, slideW*0.12, bodyH);
      // Trailing leg
      ctx.fillStyle = '#151e7a';
      ctx.fillRect(sx - slideW*0.28, py - bodyH*0.65, bodyW*0.28, bodyH*0.5);
      ctx.fillStyle = '#eeeeee';
      ctx.fillRect(sx - slideW*0.35, py - bodyH*0.14, bodyW*0.32, bodyH*0.14);
      // Head (tucked forward)
      ctx.fillStyle = '#f0c880';
      const hx = sx + slideW*0.42;
      ctx.beginPath(); ctx.arc(hx, ry + bodyH*0.55, headR*0.88, 0, Math.PI*2); ctx.fill();
      // Visor
      ctx.fillStyle = 'rgba(80,200,255,0.52)';
      ctx.beginPath(); ctx.ellipse(hx, ry + bodyH*0.55, headR*0.84, headR*0.48, 0, Math.PI, 0); ctx.fill();
      // Helmet
      ctx.fillStyle = '#0044cc';
      ctx.beginPath(); ctx.arc(hx, ry + bodyH*0.55, headR*0.88, Math.PI, 0); ctx.fill();
      // Glow
      ctx.shadowColor = '#4488ff'; ctx.shadowBlur = 10 * scale;
      ctx.strokeStyle = '#88bbff'; ctx.lineWidth = 1.3 * scale;
      ctx.strokeRect(sx - slideW/2, ry, slideW, bodyH);

    } else {
      // ── RUNNING / JUMPING ─────────────────────────────────────
      // Legs: alternating stride
      const legW  = bodyW * 0.27;
      const leg1H = bodyH * 0.54 + anim * 13 * scale;
      const leg2H = bodyH * 0.54 - anim * 13 * scale;

      ctx.fillStyle = '#151e7a';
      ctx.fillRect(sx - bodyW * 0.31, py - leg1H, legW, leg1H);
      ctx.fillRect(sx + bodyW * 0.04,  py - leg2H, legW, leg2H);

      // Shoes
      ctx.fillStyle = '#eeeeee';
      ctx.fillRect(sx - bodyW * 0.39, py - 7 * scale, bodyW * 0.33, 7 * scale);
      ctx.fillRect(sx - bodyW * 0.03, py - 7 * scale, bodyW * 0.33, 7 * scale);

      // Body jacket
      const bg = ctx.createLinearGradient(sx - bodyW/2, ry, sx + bodyW/2, ry + bodyH * 0.62);
      bg.addColorStop(0, '#1e6ae8'); bg.addColorStop(1, '#0c3a9a');
      ctx.fillStyle = bg;
      this._rrect(ctx, sx - bodyW/2, ry, bodyW, bodyH * 0.62, 5 * scale);

      // Center stripe
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(sx - bodyW*0.065, ry, bodyW*0.13, bodyH * 0.62);

      // Logo
      if (scale > 0.30) {
        ctx.fillStyle = '#ffcc00';
        ctx.font = `bold ${Math.round(7 * scale)}px monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('MR', sx, ry + bodyH * 0.28);
      }

      // Arms (swing opposite to stride)
      const armSwing = anim * 10 * scale;
      ctx.fillStyle = '#1a5ed0';
      ctx.fillRect(sx - bodyW * 1.02, ry + bodyH*0.06 + armSwing, bodyW*0.5, 10*scale);
      ctx.fillRect(sx + bodyW * 0.52, ry + bodyH*0.06 - armSwing, bodyW*0.5, 10*scale);

      // Hands
      ctx.fillStyle = '#f0c880';
      ctx.beginPath(); ctx.arc(sx - bodyW*0.77, ry + bodyH*0.06 + armSwing + 5*scale, 5*scale, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(sx + bodyW*1.02, ry + bodyH*0.06 - armSwing + 5*scale, 5*scale, 0, Math.PI*2); ctx.fill();

      // Head
      ctx.fillStyle = '#f0c880';
      ctx.beginPath(); ctx.arc(sx, ry - headR * 0.18, headR, 0, Math.PI * 2); ctx.fill();

      // Visor / goggles
      ctx.fillStyle = 'rgba(80,210,255,0.52)';
      ctx.beginPath();
      ctx.ellipse(sx, ry - headR * 0.18, headR * 0.92, headR * 0.52, 0, Math.PI, 0);
      ctx.fill();

      // Eyes
      ctx.fillStyle = '#0d1a44';
      ctx.beginPath();
      ctx.arc(sx - headR * 0.33, ry - headR * 0.24, headR * 0.17, 0, Math.PI * 2);
      ctx.arc(sx + headR * 0.33, ry - headR * 0.24, headR * 0.17, 0, Math.PI * 2);
      ctx.fill();

      // Helmet
      ctx.fillStyle = '#0044cc';
      ctx.beginPath(); ctx.arc(sx, ry - headR * 0.18, headR, Math.PI, 0); ctx.fill();
      ctx.fillRect(sx - headR * 0.92, ry - headR * 0.22, headR * 1.84, headR * 0.2);

      // Yellow helmet stripe
      ctx.fillStyle = '#ffcc00';
      ctx.fillRect(sx - headR * 0.09, ry - headR * 1.18, headR * 0.18, headR * 0.92);

      // Glow outline
      ctx.shadowColor = '#4488ff'; ctx.shadowBlur = 10 * scale;
      ctx.strokeStyle = '#88bbff'; ctx.lineWidth = 1.3 * scale;
      ctx.strokeRect(sx - bodyW/2, ry, bodyW, bodyH * 0.62);
    }

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  _drawParticles() {
    for (const p of this.particles) {
      this.ctx.globalAlpha = clamp(p.life / 20, 0, 1);
      this.ctx.fillStyle = `hsl(${p.hue},100%,65%)`;
      this.ctx.beginPath(); this.ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); this.ctx.fill();
    }
    this.ctx.globalAlpha = 1;
  }

  _drawPause() {
    const ctx = this.ctx, W = this.W, H = this.H;
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = '#7030ff'; ctx.shadowBlur = 28;
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.round(H * 0.1)}px Orbitron,monospace`;
    ctx.fillText('PAUSED', W / 2, H / 2 - H * 0.06);
    ctx.shadowBlur = 0; ctx.fillStyle = '#aaaacc';
    ctx.font = `${Math.round(H * 0.04)}px Rajdhani,sans-serif`;
    ctx.fillText('Press P or tap to resume', W / 2, H / 2 + H * 0.05);
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  _rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath(); ctx.fill();
  }
}
