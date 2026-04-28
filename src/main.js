import './style.scss';

// Constants
const PADDLE_WIDTH = 25;
const PADDLE_HEIGHT = 130;
const BALL_SIZE = 20;
const INITIAL_BALL_SPEED = 4;
const SPEED_INCREMENT = 0.001;
const MAX_SPEED = 20;
const RESET_DELAY = 12000;

const COLOURS = ['#002a94', '#ff3a61']

class Game {
  constructor() {
    this.score = 0;
    this.gameState = 'IDLE';
    this.p1Human = false;
    this.p2Human = false;
    this.timeLeft = 0;
    this.balls = [];
    this.paddles = {
      p1: { y: 0, error: 0 },
      p2: { y: 0, error: 0 }
    };
    this.keys = new Set();
    this.width = 0;
    this.height = 0;
    this.resetTimeout = null;
    this.resetInterval = null;

    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.scoreEl = document.getElementById('score');
    this.idleOverlay = document.getElementById('idle-overlay');
    this.gameoverOverlay = document.getElementById('gameover-overlay');
    this.finalScoreEl = document.querySelectorAll('.final-score');
    this.polyAlEl = document.getElementById('polyAl');
    this.papelEl = document.getElementById('papel');
    this.progressFill = document.getElementById('progress-fill');
    this.timerText = document.getElementById('timer-text');
    this.p2Hint = document.getElementById('p2-hint');

    this.initEventListeners();
    this.handleResize();
    this.initGame();
    this.loop();
  }

  initEventListeners() {
    window.addEventListener('resize', () => this.handleResize());
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
  }

  handleResize() {
    const container = document.getElementById('canvas-container');
    this.width = container.clientWidth;
    this.height = container.clientHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    if (this.gameState === 'IDLE') this.initGame();
  }

  initGame() {
    this.paddles.p1.y = this.height / 2 - PADDLE_HEIGHT / 2;
    this.paddles.p2.y = this.height / 2 - PADDLE_HEIGHT / 2;
    this.score = 0;
    this.updateScore();

    this.balls = [
      { x: this.width / 2 - BALL_SIZE / 2, y: this.height / 2 - 40, dx: 1, dy: (Math.random() - 0.5) * 1.5, speed: INITIAL_BALL_SPEED, size: BALL_SIZE, active: true },
      { x: this.width / 2 - BALL_SIZE / 2, y: this.height / 2 + 40, dx: -1, dy: (Math.random() - 0.5) * 1.5, speed: INITIAL_BALL_SPEED, size: BALL_SIZE, active: true }
    ];
  }

  handleKeyDown(e) {
    this.keys.add(e.code);
    const isP1 = ['KeyW', 'KeyS'].includes(e.code);
    const isP2 = ['ArrowUp', 'ArrowDown'].includes(e.code);

    if (isP1) this.p1Human = true;
    if (isP2) {
      if (!this.p2Human) {
        this.p2Human = true;
      }
    }

    if (this.gameState === 'IDLE' && (isP1 || isP2)) {
      this.gameState = 'PLAYING';
      this.idleOverlay.classList.add('hidden');
    }
  }

  update() {
    if (this.gameState !== 'PLAYING') return;

    const ps = 15;
    // P1
    if (this.p1Human) {
      if (this.keys.has('KeyW')) this.paddles.p1.y -= ps;
      if (this.keys.has('KeyS')) this.paddles.p1.y += ps;
    } else {
      const b = this.balls.filter(b => b.active && b.dx < 0).sort((a, b) => a.x - b.x)[0];
      if (b) {
        if (Math.random() < 0.01) this.paddles.p1.error = (Math.random() - 0.5) * (PADDLE_HEIGHT * 0.8);
        const target = b.y - PADDLE_HEIGHT / 2 + this.paddles.p1.error;
        const diff = target - this.paddles.p1.y;
        this.paddles.p1.y += Math.sign(diff) * Math.min(Math.abs(diff), ps);
        // clamp for security
        if (b.x < 120) {
          this.paddles.p1.y = Math.min(this.paddles.p1.y, b.y + BALL_SIZE - 1);
          this.paddles.p1.y = Math.max(this.paddles.p1.y, b.y - PADDLE_HEIGHT + 1);
        }
      }
    }

    // P2
    if (this.p2Human) {
      if (this.keys.has('ArrowUp')) this.paddles.p2.y -= ps;
      if (this.keys.has('ArrowDown')) this.paddles.p2.y += ps;
    } else {
      const b = this.balls.filter(b => b.active && b.dx > 0).sort((a, b) => (this.width - a.x) - (this.width - b.x))[0];
      if (b) {
        if (Math.random() < 0.01) this.paddles.p2.error = (Math.random() - 0.5) * (PADDLE_HEIGHT * 0.8);
        const target = b.y - PADDLE_HEIGHT / 2 + this.paddles.p2.error;
        const diff = target - this.paddles.p2.y;
        this.paddles.p2.y += Math.sign(diff) * Math.min(Math.abs(diff), ps);
        // clamp for security
        if (b.x > this.width - 120) {
          this.paddles.p2.y = Math.min(this.paddles.p2.y, b.y + BALL_SIZE - 1);
          this.paddles.p2.y = Math.max(this.paddles.p2.y, b.y - PADDLE_HEIGHT + 1);
        }
      }
    }

    this.paddles.p1.y = Math.max(0, Math.min(this.height - PADDLE_HEIGHT, this.paddles.p1.y));
    this.paddles.p2.y = Math.max(0, Math.min(this.height - PADDLE_HEIGHT, this.paddles.p2.y));

    let activeCount = 0;
    this.balls.forEach(b => {
      if (!b.active) return;
      activeCount++;
      const prevX = b.x;
      b.x += b.dx * b.speed;
      b.y += b.dy * b.speed;
      b.speed = Math.min(MAX_SPEED, b.speed + SPEED_INCREMENT);
      if (b.y <= 0 || b.y >= this.height - BALL_SIZE) b.dy *= -1;
      if ((prevX < this.width / 2 && b.x >= this.width / 2) || (prevX > this.width / 2 && b.x <= this.width / 2)) {
        this.score++;
        this.updateScore();
      }

      // Collisions
      if (b.dx < 0 && b.x <= 40 + PADDLE_WIDTH && b.x >= 40) {
        if (b.y + BALL_SIZE >= this.paddles.p1.y && b.y <= this.paddles.p1.y + PADDLE_HEIGHT) {
          b.dx = Math.abs(b.dx);
          b.dy = ((b.y + BALL_SIZE / 2) - (this.paddles.p1.y + PADDLE_HEIGHT / 2)) / (PADDLE_HEIGHT / 2) * 1.5;
          b.x = 40 + PADDLE_WIDTH + 1;
        }
      }
      if (b.dx > 0 && b.x >= this.width - 40 - PADDLE_WIDTH - BALL_SIZE && b.x <= this.width - 40) {
        if (b.y + BALL_SIZE >= this.paddles.p2.y && b.y <= this.paddles.p2.y + PADDLE_HEIGHT) {
          b.dx = -Math.abs(b.dx);
          b.dy = ((b.y + BALL_SIZE / 2) - (this.paddles.p2.y + PADDLE_HEIGHT / 2)) / (PADDLE_HEIGHT / 2) * 1.5;
          b.x = this.width - 40 - PADDLE_WIDTH - BALL_SIZE - 1;
        }
      }
      if (b.x < -100 || b.x > this.width + 100) b.active = false;
    });

    if (activeCount === 0) this.gameOver();
  }

  updateScore() {
    this.scoreEl.innerText = this.score.toString().padStart(2, '0');
  }

  gameOver() {
    this.gameState = 'GAMEOVER';
    this.gameoverOverlay.classList.remove('hidden');
    this.finalScoreEl.forEach(el => el.innerText = this.score.toString());
    this.polyAlEl.innerText = (this.score * 0.02).toFixed(2);
    this.papelEl.innerText = (this.score * 0.05).toFixed(2);
    this.timeLeft = RESET_DELAY / 1000;

    this.resetInterval = setInterval(() => {
      this.timeLeft = Math.max(0, this.timeLeft - 1);
      this.timerText.innerText = `Reiniciando en ${Math.ceil(this.timeLeft)}s`;
      this.progressFill.style.width = `${(this.timeLeft / (RESET_DELAY / 1000)) * 100}%`;
    }, 1000);

    this.resetTimeout = setTimeout(() => {
      this.gameState = 'IDLE';
      this.p1Human = false;
      this.p2Human = false;
      this.gameoverOverlay.classList.add('hidden');
      this.idleOverlay.classList.remove('hidden');
      clearInterval(this.resetInterval);
      this.initGame();
    }, RESET_DELAY);
  }

  draw() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ctx.setLineDash([10, 15]);
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(this.width / 2, 0); this.ctx.lineTo(this.width / 2, this.height);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    this.ctx.fillStyle = 'rgb(255, 255, 255)';
    this.ctx.shadowBlur = 15;
    this.ctx.shadowColor = 'rgba(59, 130, 246, 0.5)';
    this.ctx.beginPath();
    // if (this.ctx.roundRect) {
    //   this.ctx.roundRect(40, this.paddles.p1.y, PADDLE_WIDTH, PADDLE_HEIGHT, 6);
    // } else {
    this.ctx.rect(40, this.paddles.p1.y, PADDLE_WIDTH, PADDLE_HEIGHT);
    // }
    this.ctx.fill();

    this.ctx.shadowColor = 'rgba(168, 85, 247, 0.5)';
    this.ctx.beginPath();
    // if (this.ctx.roundRect) {
    //   this.ctx.roundRect(this.width - 40 - PADDLE_WIDTH, this.paddles.p2.y, PADDLE_WIDTH, PADDLE_HEIGHT, 6);
    // } else {
    this.ctx.rect(this.width - 40 - PADDLE_WIDTH, this.paddles.p2.y, PADDLE_WIDTH, PADDLE_HEIGHT);
    // }
    this.ctx.fill();

    this.balls.forEach((b, i) => {
      if (!b.active) return;
      this.ctx.shadowBlur = 20;
      // this.ctx.shadowColor = i === 0 ? COLOURS[0] : COLOURS[1];
      this.ctx.fillStyle = '#fff';
      this.ctx.beginPath();
      this.ctx.arc(b.x + BALL_SIZE / 2, b.y + BALL_SIZE / 2, BALL_SIZE, 0, Math.PI * 2);
      this.ctx.fill();
    });
  }

  loop() {
    this.update();
    this.draw();
    requestAnimationFrame(() => this.loop());
  }
}

new Game();
