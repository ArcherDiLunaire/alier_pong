// Constants
const PADDLE_WIDTH = 150;
const PADDLE_HEIGHT = 20;
const BALL_RADIUS = 14;
const INITIAL_BALL_SPEED = 5;
const SPEED_INCREMENT = 0.002;
const MAX_SPEED = 15;
const RESET_DELAY = 10000; // 10 seconds

const BRICK_ROWS = 5;
const BRICK_COLS = 5;
const BRICK_PADDING = 10;
const BRICK_OFFSET_TOP = 100;
const BRICK_OFFSET_LEFT = 40;
const BRICK_HEIGHT = 50;

interface FloatingText {
  x: number;
  y: number;
  text: string;
  opacity: number;
  color: string;
  life: number;
}

interface Brick {
  x: number;
  y: number;
  width: number;
  height: number;
  active: boolean;
  color: string;
}

class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width: number = 0;
  private height: number = 0;

  private blocksCount: number = 0;
  private polyAlCount: number = 0;
  private papelCount: number = 0;

  private gameState: 'IDLE' | 'PLAYING' | 'GAMEOVER' = 'IDLE';
  
  private paddleX: number = 0;
  private ballX: number = 0;
  private ballY: number = 0;
  private ballDX: number = 0;
  private ballDY: number = 0;
  private ballSpeed: number = INITIAL_BALL_SPEED;

  private bricks: Brick[] = [];
  private floatingTexts: FloatingText[] = [];
  private keys: Set<string> = new Set();
  
  private lastTime: number = 0;
  private timeLeft: number = 0;
  private resetInterval: number | null = null;
  private resetTimeout: number | null = null;

  // FPS tracking
  private frameCount: number = 0;
  private fpsLastTime: number = 0;
  private fpsEl: HTMLElement;

  // DOM elements
  private blocksEl: HTMLElement;
  private polyAlEl: HTMLElement;
  private papelEl: HTMLElement;
  private idleOverlay: HTMLElement;
  private gameoverOverlay: HTMLElement;
  private timerText: HTMLElement;
  private progressFill: HTMLElement;

  private left: boolean = false;
  private right: boolean = false;

  constructor() {
    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    
    this.blocksEl = document.getElementById('blocks-count')!;
    this.polyAlEl = document.getElementById('polyAl-count')!;
    this.papelEl = document.getElementById('papel-count')!;
    this.idleOverlay = document.getElementById('idle-overlay')!;
    this.gameoverOverlay = document.getElementById('gameover-overlay')!;
    this.timerText = document.getElementById('timer-text')!;
    this.progressFill = document.getElementById('progress-fill')!;
    this.fpsEl = document.getElementById('fps-counter')!;

    this.initEventListeners();
    this.handleResize();
    this.initBricks();
    this.resetBall();
    this.loop();
  }

  private initEventListeners() {
    window.addEventListener('resize', () => this.handleResize());
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (this.gameState === 'IDLE' && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
        this.startGame();
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
  }

  private handleResize() {
    const container = document.getElementById('canvas-container')!;
    this.width = container.clientWidth;
    this.height = container.clientHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    
    this.paddleX = (this.width - PADDLE_WIDTH) / 2;
    if (this.gameState === 'IDLE') {
        this.initBricks();
        this.resetBall();
    }
  }

  private readGamePad() {
    const gp = navigator.getGamepads()[0];
    if (!gp) return;

    this.left = gp.buttons[0]?.pressed;
    this.right = gp.buttons[1]?.pressed;

    if (this.gameState === 'IDLE' && (this.left || this.right)) {
        this.startGame();
      }
  }

  private initBricks() {
    this.bricks = [];
    const availableWidth = this.width - BRICK_OFFSET_LEFT * 2;
    const brickWidth = (availableWidth - (BRICK_COLS - 1) * BRICK_PADDING) / BRICK_COLS;
    const brickHeight = BRICK_HEIGHT;

    for (let r = 0; r < BRICK_ROWS; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        const x = c * (brickWidth + BRICK_PADDING) + BRICK_OFFSET_LEFT;
        const y = r * (brickHeight + BRICK_PADDING) + BRICK_OFFSET_TOP;
        const color = `hsl(${220 + r * 10}, 70%, ${50 + r * 5}%)`;
        this.bricks.push({ x, y, width: brickWidth, height: brickHeight, active: true, color });
      }
    }
  }

  private resetBall() {
    this.ballX = this.width / 2;
    this.ballY = this.height - 75;
    this.ballDX = (Math.random() - 0.5) * 2;
    this.ballDY = -1;
    this.ballSpeed = INITIAL_BALL_SPEED;
    this.paddleX = (this.width - PADDLE_WIDTH) / 2;
    this.blocksCount = 0;
    this.polyAlCount = 0;
    this.papelCount = 0;
  }

  private startGame() {
    this.gameState = 'PLAYING';
    this.idleOverlay.classList.add('hidden');
    this.updateHUD();
    this.initBricks();
  }

  private updateHUD() {
    this.blocksEl.innerText = this.blocksCount.toString().padStart(2, '0');
    this.polyAlEl.innerText = this.polyAlCount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "g";
    this.papelEl.innerText = this.papelCount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "g";

    // const totalScore = (this.blocksCount * 100) + this.polyAlCount + this.papelCount;
    // const scoreEl = document.getElementById('current-score');
    // if (scoreEl) {
    //   scoreEl.innerText = totalScore.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    // }
  }

  private gameOver() {
    this.gameState = 'GAMEOVER';
    this.gameoverOverlay.classList.remove('hidden');
    
    const totalScore = (this.blocksCount * 100) + this.polyAlCount + this.papelCount;
    const finalScoreDisplay = document.getElementById('final-total-score');
    if (finalScoreDisplay) {
      finalScoreDisplay.innerText = totalScore.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    document.querySelectorAll('#final-blocks')!.forEach(el => el.innerHTML = this.blocksCount.toString());
    document.getElementById('final-polyAl')!.innerText = this.polyAlCount.toString() + "g";
    document.getElementById('final-papel')!.innerText = this.papelCount.toString() + "g";

    this.timeLeft = RESET_DELAY / 1000;
    
    if (this.resetInterval) clearInterval(this.resetInterval);
    if (this.resetTimeout) clearTimeout(this.resetTimeout);

    this.resetInterval = window.setInterval(() => {
      this.timeLeft -= 0.1;
      if (this.timeLeft <= 0) {
        if (this.resetInterval) clearInterval(this.resetInterval);
      }
      this.timerText.innerText = `Reiniciando en ${Math.ceil(this.timeLeft)}s`;
      this.progressFill.style.width = `${(this.timeLeft / (RESET_DELAY / 1000)) * 100}%`;
    }, 100);

    this.resetTimeout = window.setTimeout(() => {
      this.gameState = 'IDLE';
      this.gameoverOverlay.classList.add('hidden');
      this.idleOverlay.classList.remove('hidden');
      this.initBricks();
      this.resetBall();
      this.updateHUD();
      this.paddleX = (this.width - PADDLE_WIDTH) / 2;
    }, RESET_DELAY);
  }

  private update(dt: number) {
    if (this.gameState !== 'PLAYING') return;

    // Paddle movement
    const paddleSpeed = 10;
    if (this.keys.has('ArrowLeft') || this.left) {
      this.paddleX = Math.max(0, this.paddleX - paddleSpeed);
    }
    if (this.keys.has('ArrowRight') || this.right) {
      this.paddleX = Math.min(this.width - PADDLE_WIDTH, this.paddleX + paddleSpeed);
    }

    // Ball movement
    this.ballX += this.ballDX * this.ballSpeed;
    this.ballY += this.ballDY * this.ballSpeed;
    this.ballSpeed = Math.min(MAX_SPEED, this.ballSpeed + SPEED_INCREMENT);

    // Wall collisions
    if (this.ballX + BALL_RADIUS > this.width) {
      this.ballX = this.width - BALL_RADIUS;
      this.ballDX *= -1;
    } else if (this.ballX - BALL_RADIUS < 0) {
      this.ballX = BALL_RADIUS;
      this.ballDX *= -1;
    }

    if (this.ballY - BALL_RADIUS < 0) {
      this.ballY = BALL_RADIUS;
      this.ballDY *= -1;
    }

    // Paddle collision
    if (
      this.ballY + BALL_RADIUS >= this.height - 40 - PADDLE_HEIGHT &&
      this.ballY + BALL_RADIUS <= this.height - 40 &&
      this.ballX >= this.paddleX &&
      this.ballX <= this.paddleX + PADDLE_WIDTH
    ) {
      this.ballDY = -Math.abs(this.ballDY);
      this.ballY = this.height - 40 - PADDLE_HEIGHT - BALL_RADIUS;
      // Change DX based on where it hit the paddle
      const paddleCenter = this.paddleX + PADDLE_WIDTH / 2;
      this.ballDX = (this.ballX - paddleCenter) / (PADDLE_WIDTH / 2);
    }

    // Brick collision
    let brokenThisFrame = 0;
    let collisionX = 0;
    let collisionY = 0;

    for (let brick of this.bricks) {
      if (brick.active) {
        if (
          this.ballX + BALL_RADIUS > brick.x &&
          this.ballX - BALL_RADIUS < brick.x + brick.width &&
          this.ballY + BALL_RADIUS > brick.y &&
          this.ballY - BALL_RADIUS < brick.y + brick.height
        ) {
          brick.active = false;
          this.ballDY *= -1;
          brokenThisFrame++;
          collisionX = brick.x + brick.width / 2;
          collisionY = brick.y;
          // Continue to check for other collisions this frame if needed, 
          // but usually one ball hits one brick. If we have multiple balls or high speed, 
          // we might hit multiple.
        }
      }
    }

    if (brokenThisFrame > 0) {
      this.blocksCount += brokenThisFrame;
      this.polyAlCount += 10 * brokenThisFrame;
      this.papelCount += 50 * brokenThisFrame;
      this.updateHUD();
      this.addFloatingPoint(collisionX, collisionY, brokenThisFrame);
    }

    // Death
    if (this.ballY + BALL_RADIUS > this.height) {
      this.gameOver();
    }

    // Update floating texts
    this.floatingTexts = this.floatingTexts.filter(t => {
      t.y -= 1;
      t.life -= 0.01;
      t.opacity = t.life;
      return t.life > 0;
    });
  }

  private addFloatingPoint(x: number, y: number, count: number) {
    const polyAl = 10 * count;
    const papel = 50 * count;
    
    this.floatingTexts.push({
      x: x,
      y: y - 10,
      text: `${polyAl}g polyAl`,
      opacity: 1,
      color: '#fff',
      life: 1
    });
    this.floatingTexts.push({
      x: x,
      y: y - 30,
      text: `${papel}g papel`,
      opacity: 1,
      color: '#fff',
      life: 1
    });
  }

  private draw() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Draw Bricks
    for (let brick of this.bricks) {
      if (brick.active) {
        // Glass effect for bricks
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.lineWidth = 1;
        
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        
        this.ctx.beginPath();
        this.ctx.roundRect(brick.x, brick.y, brick.width, brick.height, 6);
        this.ctx.fill();
        this.ctx.stroke();
        
        // Add a small highlight line at the top
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.beginPath();
        this.ctx.moveTo(brick.x + 5, brick.y + 2);
        this.ctx.lineTo(brick.x + brick.width - 5, brick.y + 2);
        this.ctx.stroke();
        
      }
    }

    // Draw Paddle
    this.ctx.fillStyle = '#fff';
    this.ctx.beginPath();
    this.ctx.roundRect(this.paddleX, this.height - 40 - PADDLE_HEIGHT, PADDLE_WIDTH, PADDLE_HEIGHT, 10);
    this.ctx.fill();
    
    // Paddle border
    this.ctx.stroke();

    // Draw Ball
    // if (this.gameState === 'PLAYING') {
      this.ctx.fillStyle = '#fff';
      this.ctx.beginPath();
      this.ctx.arc(this.ballX, this.ballY, BALL_RADIUS, 0, Math.PI * 2);
      this.ctx.fill();
    // }

    // Draw Floating Texts
    this.ctx.font = '12px "Inter", sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    for (let t of this.floatingTexts) {
      this.ctx.fillStyle = t.color;
      this.ctx.globalAlpha = t.opacity;
      this.ctx.fillText(t.text.toUpperCase(), t.x, t.y);
    }
    this.ctx.globalAlpha = 1;
  }

  private loop() {
    const now = Date.now();
    const dt = this.lastTime ? (now - this.lastTime) / 1000 : 0;
    this.lastTime = now;

    // Update FPS
    this.frameCount++;
    if (now - this.fpsLastTime >= 1000) {
      this.fpsEl.innerText = `FPS: ${this.frameCount}`;
      this.frameCount = 0;
      this.fpsLastTime = now;
    }

    this.update(dt);
    this.draw();
    this.readGamePad();
    requestAnimationFrame(() => this.loop());
  }
}

new Game();
