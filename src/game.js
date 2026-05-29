// ---- Constants ----
const PADDLE_WIDTH = 200;
const PADDLE_HEIGHT = 16;
const BALL_RADIUS = 20;
const INITIAL_BALL_SPEED = 6;
const SPEED_INCREMENT = 0.003;
const MAX_SPEED = 20;
const POLYAL_CONV = 9.6;
const PAPEL_CONV = 22.4;
const PADDLE_SPEED = 10;

// Envase SVG proportions: viewBox 0 0 62.7 124.5  → aspect ~0.5035 (width/height)
const ENVASE_ASPECT = 62.7 / 124.5; // ~0.503

// Grid layout: we want ~20 cols × 3 rows to match the design
// We'll compute brick size from canvas width so exactly BRICK_COLS fit
const BRICK_COLS = 15;
const BRICK_ROWS = 2;
const BRICK_PAD_H = 5;  // horizontal gap between bricks
const BRICK_PAD_V = 8;  // vertical gap between rows
const GRID_MARGIN = 250; // left/right margin
const GRID_TOP = 50;    // offset from top of canvas area

// Envase path data (SVG viewBox 62.7 x 124.5)
// We'll draw scaled versions directly on canvas
function drawEnvase(ctx, ox, oy, w, h) {
  const sx = w / 62.7;
  const sy = h / 124.5;
  function p(vx, vy) { return [ox + vx * sx, oy + vy * sy]; }

  ctx.beginPath();
  const front = [[12.8, 2.9], [12.8, 11.1], [3.2, 31], [3.2, 120.6], [40.5, 120.6], [40.5, 31], [50, 11.1], [50, 2.9]];
  front.forEach(([vx, vy], i) => { const [x, y] = p(vx, vy); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
  ctx.closePath();
  ctx.stroke();

  ctx.beginPath();
  const side = [[40.5, 31], [40.5, 120.6], [58.9, 120.6], [58.9, 31], [50, 11.1]];
  side.forEach(([vx, vy], i) => { const [x, y] = p(vx, vy); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
  ctx.closePath();
  ctx.stroke();

  // Shelf line
  let [ax, ay] = p(3.2, 31), [bx, by] = p(40.5, 31);
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
  // Top fold line
  let [cx2, cy2] = p(12.8, 11.1), [dx, dy] = p(50, 11.1);
  ctx.beginPath(); ctx.moveTo(cx2, cy2); ctx.lineTo(dx, dy); ctx.stroke();
}

// ---- State ----
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const floatingLayer = document.getElementById('floating-layer');

let width = 0, height = 0;
let paddleX = 0;
let ballX = 0, ballY = 0, ballDX = 0, ballDY = 0, ballSpeed = INITIAL_BALL_SPEED;
let bricks = [];
let blocksCount = 0, polyAlCount = 0, papelCount = 0;
let gameState = 'IDLE';
let keys = new Set();
let frameCount = 0, fpsLast = 0;
let left = false;
let right = false;

const blocksEl = document.getElementById('blocks-big');
const papelEl = document.getElementById('papel-count');
const polyAlEl = document.getElementById('polyal-count');
const idleOverlay = document.getElementById('idle-overlay');
const postGame = document.getElementById('post-game');
const fpsEl = document.getElementById('fps');
const resetBar = document.getElementById('reset-bar');
const resetBarFill = document.getElementById('reset-bar-fill');

// ---- Brick geometry ----
// Computes brickW, brickH from current canvas width
function brickSize() {
  const totalW = width - GRID_MARGIN * 2;
  const bw = (totalW - (BRICK_COLS - 1) * BRICK_PAD_H) / BRICK_COLS;
  const bh = bw / ENVASE_ASPECT;
  return { bw, bh };
}

function initBricks() {
  bricks = [];
  const { bw, bh } = brickSize();
  for (let r = 0; r < BRICK_ROWS; r++) {
    for (let c = 0; c < BRICK_COLS; c++) {
      const x = GRID_MARGIN + c * (bw + BRICK_PAD_H);
      const y = GRID_TOP + r * (bh + BRICK_PAD_V);
      bricks.push({ x, y, w: bw, h: bh, active: true });
    }
  }
}

function resetBall() {
  ballX = width / 2;
  ballY = height - 80;
  ballDX = (Math.random() > 0.5 ? 1 : -1) * (0.4 + Math.random() * 0.4);
  ballDY = -1;
  ballSpeed = INITIAL_BALL_SPEED;
  paddleX = (width - PADDLE_WIDTH) / 2;
  blocksCount = 0; polyAlCount = 0; papelCount = 0;
}

function handleResize() {
  width = canvas.clientWidth;
  height = canvas.clientHeight;
  canvas.width = width;
  canvas.height = height;
  paddleX = (width - PADDLE_WIDTH) / 2;
  if (gameState === 'IDLE') { initBricks(); resetBall(); }
}

// ---- HUD ----
function fmt(n) {
  const s = n.toFixed(1);
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function updateHUD() {
  blocksEl.textContent = blocksCount.toString().padStart(2, '0');
  papelEl.textContent = fmt(papelCount) + 'g';
  polyAlEl.textContent = fmt(polyAlCount) + 'g';
}

// ---- Floating texts ----
function spawnFloat(x, y, text) {
  const el = document.createElement('div');
  el.style.cssText = `position:absolute;
    left:${x}px;top:${y + 100}px;
    transform:translateX(-50%);
    font-family:Arial, sans-serif;
    font-size:30px;
    color:#fff;
    line-height: 1;
    white-space:nowrap;
    pointer-events:none;
    transition:opacity 1.5s ease,transform 1.5s ease;`;
  el.textContent = text;
  floatingLayer.appendChild(el);
  requestAnimationFrame(() => {
    el.style.transform = 'translateX(-50%) translateY(-50px)';
    el.style.opacity = '0';
  });
  setTimeout(() => el.remove(), 1500);
}

function addFloat(x, y, count) {
  spawnFloat(x, y - 10, `+${(POLYAL_CONV * count).toFixed(1)}g POLYAL`);
  spawnFloat(x, y - 50, `+${(PAPEL_CONV * count).toFixed(1)}g PAPEL`);
}

// ---- Draw ----
function draw() {
  ctx.clearRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(255,255,255)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const b of bricks) {
    if (b.active) drawEnvase(ctx, b.x, b.y, b.w, b.h);
  }

  // Paddle
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.rect(paddleX, height - 40 - PADDLE_HEIGHT, PADDLE_WIDTH, PADDLE_HEIGHT);
  ctx.fill();

  // Ball
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(ballX, ballY, BALL_RADIUS, 0, Math.PI * 2);
  ctx.fill();
}

// ---- Update ----
function update() {
  if (gameState !== 'PLAYING') return;

  if (keys.has('ArrowLeft') || left) paddleX = Math.max(0, paddleX - PADDLE_SPEED);
  if (keys.has('ArrowRight') || right) paddleX = Math.min(width - PADDLE_WIDTH, paddleX + PADDLE_SPEED);

  ballX += ballDX * ballSpeed;
  ballY += ballDY * ballSpeed;
  ballSpeed = Math.min(MAX_SPEED, ballSpeed + SPEED_INCREMENT);

  // Wall bounce
  if (ballX + BALL_RADIUS > width) { ballX = width - BALL_RADIUS; ballDX *= -1; }
  else if (ballX - BALL_RADIUS < 0) { ballX = BALL_RADIUS; ballDX *= -1; }
  if (ballY - BALL_RADIUS < 0) { ballY = BALL_RADIUS; ballDY *= -1; }

  // Paddle
  const py = height - 40 - PADDLE_HEIGHT;
  if (ballY + BALL_RADIUS >= py && ballY + BALL_RADIUS <= py + PADDLE_HEIGHT + 6 &&
    ballX >= paddleX && ballX <= paddleX + PADDLE_WIDTH) {
    ballDY = -Math.abs(ballDY);
    ballY = py - BALL_RADIUS;
    ballDX = (ballX - (paddleX + PADDLE_WIDTH / 2)) / (PADDLE_WIDTH / 2) * 1.2;
  }

  // Brick collision — one brick per frame (first hit)
  let hit = null;
  for (const b of bricks) {
    if (!b.active) continue;
    if (ballX + BALL_RADIUS > b.x && ballX - BALL_RADIUS < b.x + b.w &&
      ballY + BALL_RADIUS > b.y && ballY - BALL_RADIUS < b.y + b.h) {
      // Determine bounce axis
      const overlapL = (ballX + BALL_RADIUS) - b.x;
      const overlapR = (b.x + b.w) - (ballX - BALL_RADIUS);
      const overlapT = (ballY + BALL_RADIUS) - b.y;
      const overlapB = (b.y + b.h) - (ballY - BALL_RADIUS);
      const minH = Math.min(overlapL, overlapR);
      const minV = Math.min(overlapT, overlapB);
      if (minH < minV) ballDX *= -1; else ballDY *= -1;
      b.active = false;
      hit = b;
      break;
    }
  }

  if (hit) {
    blocksCount++;
    polyAlCount = parseFloat((polyAlCount + POLYAL_CONV).toFixed(1));
    papelCount = parseFloat((papelCount + PAPEL_CONV).toFixed(1));
    updateHUD();
    addFloat(hit.x + hit.w / 2, hit.y, 1);
  }

  // Death
  if (ballY - BALL_RADIUS > height) gameOver();
}

// ---- Game over / screens ----
function startGame() {
  gameState = 'PLAYING';
  idleOverlay.classList.add('hidden');
  initBricks();
  updateHUD();
}

const BRICK_SVG_INLINE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 62.7 124.5" width="100%" height="100%">
  <polygon fill="none" stroke="#fff" stroke-miterlimit="10" stroke-width="1.5" points="12.8 2.9 12.8 11.1 3.2 31 3.2 120.6 40.5 120.6 40.5 31 50 11.1 50 2.9 12.8 2.9"/>
  <polygon fill="none" stroke="#fff" stroke-miterlimit="10" stroke-width="1.5" points="40.5 31 40.5 120.6 58.9 120.6 58.9 31 50 11.1 40.5 31"/>
  <line fill="none" stroke="#fff" stroke-miterlimit="10" stroke-width="1.5" x1="3.2" y1="31" x2="40.5" y2="31"/>
  <line fill="none" stroke="#fff" stroke-miterlimit="10" stroke-width="1.5" x1="12.8" y1="11.1" x2="50" y2="11.1"/>
</svg>`;

function buildBrickGrid(total) {
  const container = document.getElementById('congrats-bricks');
  container.innerHTML = '';

  // Fill available width, figure out how many cols fit at a nice size
  const availW = window.innerWidth * 0.8;
  const iconH = 180;
  const iconW = Math.round(iconH * ENVASE_ASPECT);
  const gap = 6;
  const cols = Math.floor((availW + gap) / (iconW + gap));
  const rows = Math.ceil(total / cols);

  for (let r = 0; r < rows; r++) {
    const row = document.createElement('div');
    row.className = 'brick-row';
    const rowCount = (r === rows - 1) ? (total - r * cols) : cols;
    for (let c = 0; c < rowCount; c++) {
      const el = document.createElement('div');
      el.className = 'brick-icon';
      el.style.width = iconW + 'px';
      el.style.height = iconH + 'px';
      el.innerHTML = BRICK_SVG_INLINE;
      row.appendChild(el);
    }
    container.appendChild(row);
  }

  // Cascade animation — stagger each icon
  const icons = container.querySelectorAll('.brick-icon');
  setTimeout(() => {
    icons.forEach((el, i) => {
      setTimeout(() => el.classList.add('visible'), i * 120);
    });
  }, 1500);

  return icons.length;
}

function resetInfoElements() {
  ['ip1', 'ip2', 'ib1', 'ib2', 'itl'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.style.opacity = '0'; el.style.transform = 'translateY(14px)'; }
  });
  ['mat-papel', 'mat-polyal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.style.opacity = '0'; el.style.transform = 'translateY(22px)'; }
  });
}

function animateInfoScreen() {
  [
    { id: 'ip1', delay: 150 },
    { id: 'ib1', delay: 400 },
    { id: 'ip2', delay: 700 },
    { id: 'ib2', delay: 1000 },
    { id: 'itl', delay: 2000 },
    { id: 'mat-papel', delay: 2400 },
    { id: 'mat-polyal', delay: 2800 },
  ].forEach(({ id, delay }) => {
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) { el.style.opacity = '1'; el.style.transform = 'none'; }
    }, delay);
  });
}

function gameOver() {
  gameState = 'GAMEOVER';

  const total = blocksCount;
  // const total = 30;
  const pa = polyAlCount;
  const pp = papelCount;

  // Populate screens
  // document.getElementById('congrats-count').textContent = total.toString().padStart(2, '0');
  // document.getElementById('final-papel-hud').textContent = fmt(pp) + 'g';
  // document.getElementById('final-polyal-hud').textContent = fmt(pa) + 'g';
  document.getElementById('congrats-msg').innerHTML = `¡Enhorabuena! <br> Has reciclado ${total} envases.`;
  document.getElementById('info-produced-count').textContent = total;
  document.getElementById('info-recycled-count').textContent = total;
  document.getElementById('info-papel-grams').textContent = pp.toFixed(1);
  document.getElementById('info-polyal-grams').textContent = pa.toFixed(1);

  // Pre-reset info elements so they animate in fresh
  resetInfoElements();

  // Show post-game container
  postGame.style.display = 'block';

  // SCREEN 1: congrats + brick cascade
  const sc = document.getElementById('screen-congrats');
  sc.style.display = 'flex';
  sc.style.opacity = '0';
  requestAnimationFrame(() => { sc.style.opacity = '1'; });

  // Build cascade — count icons to know duration
  const iconCount = buildBrickGrid(total);
  const cascadeDuration = iconCount * 120 + 4000; // last icon + fade settle

  // SCREEN 2: after cascade fades in, cross-fade to info
  setTimeout(() => {
    document.getElementById('info-produced-count').textContent = total;
    document.getElementById('info-recycled-count').textContent = total;
    document.getElementById('info-papel-grams').textContent = pp.toFixed(1);
    document.getElementById('info-polyal-grams').textContent = pa.toFixed(1);

    const si = document.getElementById('screen-info');
    si.style.display = 'flex';
    si.style.opacity = '0';

    sc.style.opacity = '0';
    setTimeout(() => {
      sc.style.display = 'none';
      si.style.opacity = '1';
      animateInfoScreen();
    }, 1000);
  }, cascadeDuration);

  // return;

  // SCREEN 3: closing message
  const infoVisible = cascadeDuration + 7500;
  setTimeout(() => {
    const si = document.getElementById('screen-info');
    const scl = document.getElementById('screen-closing');
    scl.style.display = 'flex';
    scl.style.opacity = '0';

    si.style.opacity = '0';
    setTimeout(() => {
      si.style.display = 'none';
      scl.style.opacity = '1';
      const cl1 = document.getElementById('cl1');
      const cl2 = document.getElementById('cl2');
      setTimeout(() => { cl1.style.opacity = '1'; cl1.style.transform = 'none'; }, 200);
      setTimeout(() => { cl2.style.opacity = '1'; cl2.style.transform = 'none'; }, 800);
    }, 1000);
  }, infoVisible);

  // RESET after closing screen shows for 5s
  const totalDelay = infoVisible + 5800;

  resetBar.style.display = 'block';
  resetBarFill.style.transition = 'none';
  resetBarFill.style.width = '100%';
  requestAnimationFrame(() => {
    resetBarFill.style.transition = `width ${totalDelay}ms linear`;
    resetBarFill.style.width = '0%';
  });

  setTimeout(() => {
    // Hide all post-game screens
    postGame.style.display = 'none';

    // Reset closing lines
    ['cl1', 'cl2'].forEach(id => {
      const el = document.getElementById(id);
      el.style.opacity = '0'; el.style.transform = 'translateY(20px)';
    });
    document.getElementById('screen-closing').style.display = '';
    document.getElementById('screen-closing').style.opacity = '0';
    document.getElementById('screen-congrats').style.display = '';
    document.getElementById('screen-congrats').style.opacity = '0';
    document.getElementById('screen-info').style.display = '';
    document.getElementById('screen-info').style.opacity = '0';
    resetInfoElements();

    resetBar.style.display = 'none';
    resetBarFill.style.transition = 'none';
    resetBarFill.style.width = '100%';

    gameState = 'IDLE';
    idleOverlay.classList.remove('hidden');
    initBricks();
    resetBall();
    updateHUD();
  }, totalDelay);
}

function readGamePad() {
  const gp = navigator.getGamepads()[0];
  if (!gp) return;

  left = gp.buttons[0]?.pressed;
  right = gp.buttons[1]?.pressed;

  if (gameState === 'IDLE' && (left || right)) {
    startGame();
  }
}

// ---- Loop ----
function loop() {
  const now = Date.now();
  frameCount++;
  if (now - fpsLast >= 1000) {
    fpsEl.textContent = `FPS: ${frameCount}`;
    frameCount = 0; fpsLast = now;
  }
  update();
  draw();
  readGamePad();
  requestAnimationFrame(loop);
}

// ---- Events ----
window.addEventListener('keydown', e => {
  keys.add(e.code);
  if (gameState === 'IDLE' && (e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'Space')) {
    startGame();
  }
});
window.addEventListener('keyup', e => keys.delete(e.code));
window.addEventListener('resize', handleResize);

// Init
handleResize();
updateHUD();
loop();
