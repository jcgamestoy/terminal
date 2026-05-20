import { Terminal } from '@retrovm/terminal'
import { Color } from '@retrovm/color'

const out = Terminal.out!

// ─── Layout ───────────────────────────────────────────────────────────────────
const CELL = 2   // terminal columns per game cell (makes cells ~square)
const TICK = 130 // base ms per step

let COLS = 0, ROWS = 0, GW = 0, GH = 0

function resize() {
  COLS = process.stdout.columns ?? 80
  ROWS = process.stdout.rows ?? 24
  GW = Math.floor((COLS - 2) / CELL)  // -2 for left/right border chars
  GH = ROWS - 4                         // -1 UI row -2 border rows -1 status bar
}

// 1-based terminal position for game cell (gx, gy)
const toRow = (gy: number) => gy + 3         // row1=UI, row2=top border, row3+=game
const toCol = (gx: number) => gx * CELL + 2  // col1=left border, col2+=game

// ─── Palette ──────────────────────────────────────────────────────────────────
const C_BG     = new Color(0.03, 0.04, 0.06)
const C_BORDER = new Color(0.12, 0.18, 0.26)
const C_UI_BG  = new Color(0.04, 0.06, 0.10)
const C_DIM    = new Color(0.28, 0.38, 0.50)
const C_BRIGHT = new Color(0.88, 0.94, 1.00)
const C_DEAD   = new Color(0.75, 0.04, 0.04)

// Snake gradient: bright cyan-green at head → dark teal at tail
const C_HEAD = new Color(0.10, 1.00, 0.55)
const C_TAIL = new Color(0.00, 0.28, 0.14)
const GRAD_LEN = 256
const snakeGrad: Color[] = Array.from({ length: GRAD_LEN }, (_, i) =>
  C_HEAD.interpolate(C_TAIL, i / (GRAD_LEN - 1))
)

// Food: pulsing warm glow (orange → yellow)
const FOOD_FRAMES = 30
const foodPal: Color[] = Array.from({ length: FOOD_FRAMES }, (_, i) => {
  const t = Math.sin((i / FOOD_FRAMES) * Math.PI * 2) * 0.5 + 0.5
  return new Color(1.0, 0.30 + t * 0.60, t * 0.15)
})

// ─── State ────────────────────────────────────────────────────────────────────
type Pos = { x: number; y: number }
type Dir = [number, number]

let snake:   Pos[] = []
let dir:     Dir   = [1, 0]
let nextDir: Dir   = [1, 0]
let food: Pos      = { x: 0, y: 0 }
let score = 0, best = 0, tick = 0, alive = false
let timer: ReturnType<typeof setTimeout>

// ─── Helpers ──────────────────────────────────────────────────────────────────
function putCell(gx: number, gy: number, c: Color) {
  out.moveTo(toRow(gy), toCol(gx)).paper(c).raw('  ')
}

function snakeColor(idx: number): Color {
  const t = idx / Math.max(snake.length - 1, 1)
  return snakeGrad[Math.min((t * (GRAD_LEN - 1)) | 0, GRAD_LEN - 1)]!
}

function placeFood() {
  const busy = new Set(snake.map(p => p.x * 10000 + p.y))
  do { food = { x: (Math.random() * GW) | 0, y: (Math.random() * GH) | 0 }
  } while (busy.has(food.x * 10000 + food.y))
}

function tickDelay(): number {
  return Math.max(55, TICK - Math.floor(score / 4) * 7)
}

// ─── Rendering ────────────────────────────────────────────────────────────────
function drawFood() {
  putCell(food.x, food.y, foodPal[tick % FOOD_FRAMES]!)
}

function drawSnake() {
  for (let i = 0; i < snake.length; i++) {
    putCell(snake[i]!.x, snake[i]!.y, snakeColor(i))
  }
}

function drawUI() {
  out.moveTo(1, 1).paper(C_UI_BG).raw(' '.repeat(COLS))
  out.moveTo(1, 3)
  out.paper(C_UI_BG).ink(C_HEAD).raw('▶ SNAKE  ')
  out.ink(C_DIM).raw('SCORE ').ink(C_BRIGHT).raw(String(score).padStart(4))
  out.ink(C_DIM).raw('   BEST ').ink(C_BRIGHT).raw(String(best).padStart(4))
  const hint = 'WASD · Q quit  '
  out.moveTo(1, COLS - hint.length + 1).paper(C_UI_BG).ink(C_DIM).raw(hint)
  out.resetText()
}

function drawBorder() {
  const hr = '─'.repeat(GW * CELL)
  out.moveTo(2, 1).paper(C_BG).ink(C_BORDER).raw(`┌${hr}┐`)
  out.moveTo(GH + 3, 1).ink(C_BORDER).raw(`└${hr}┘`)
  for (let gy = 0; gy < GH; gy++) {
    out.moveTo(toRow(gy), 1).ink(C_BORDER).raw('│')
    out.moveTo(toRow(gy), GW * CELL + 2).ink(C_BORDER).raw('│')
  }
}

function drawField() {
  for (let gy = 0; gy < GH; gy++) {
    out.moveTo(toRow(gy), toCol(0)).paper(C_BG).raw(' '.repeat(GW * CELL))
  }
}

function drawStatus() {
  const copy = '© 2026  Juan Carlos González Amestoy'
  out.moveTo(GH + 4, 1).paper(C_UI_BG).raw(' '.repeat(COLS))
  out.moveTo(GH + 4, Math.floor((COLS - copy.length) / 2) + 1)
  out.paper(C_UI_BG).ink(C_DIM).raw(copy)
  out.resetText()
}

function fullRedraw() {
  out.sync(() => {
    drawUI()
    drawBorder()
    drawField()
    drawSnake()
    drawFood()
    drawStatus()
    out.resetText()
  })
}

function drawGameOver() {
  const lines = [
    '                    ',
    '    G A M E  O V E R    ',
    `         Score: ${String(score).padEnd(5)}     `,
    '                    ',
    '    R  →  restart   ',
    '    Q  →  quit      ',
    '                    ',
  ]
  const maxLen = Math.max(...lines.map(l => l.length))
  const startRow = Math.max(3, toRow(Math.floor(GH / 2)) - Math.floor(lines.length / 2))
  const startCol = Math.max(2, Math.floor((COLS - maxLen) / 2) + 1)
  const C_GOBG = new Color(0.35, 0.0, 0.04)
  const C_GOFG = new Color(1.0,  0.7, 0.7)
  out.sync(() => {
    for (let i = 0; i < lines.length; i++) {
      out.moveTo(startRow + i, startCol).paper(C_GOBG).ink(C_GOFG).raw(lines[i]!.padEnd(maxLen))
    }
    out.resetText()
  })
}

// ─── Game logic ───────────────────────────────────────────────────────────────
function gameTick() {
  tick++
  if (!alive) return

  dir = nextDir
  const head = snake[0]!
  const nx = head.x + dir[0]
  const ny = head.y + dir[1]

  if (nx < 0 || nx >= GW || ny < 0 || ny >= GH) { die(); return }
  for (let i = 1; i < snake.length; i++) {
    if (snake[i]!.x === nx && snake[i]!.y === ny) { die(); return }
  }

  const atFood = nx === food.x && ny === food.y
  const oldTail = atFood ? null : snake[snake.length - 1]!

  snake.unshift({ x: nx, y: ny })
  if (!atFood) snake.pop()

  out.sync(() => {
    if (oldTail) putCell(oldTail.x, oldTail.y, C_BG)
    drawSnake()

    if (atFood) {
      score++
      if (score > best) best = score
      placeFood()
      drawUI()
    }

    drawFood()
    out.resetText()
  })

  timer = setTimeout(gameTick, tickDelay())
}

function die() {
  alive = false
  out.sync(() => {
    for (const seg of snake) putCell(seg.x, seg.y, C_DEAD)
    out.resetText()
  })
  setTimeout(drawGameOver, 350)
}

function initGame() {
  resize()
  const cx = Math.floor(GW / 2), cy = Math.floor(GH / 2)
  snake   = [{ x: cx, y: cy }, { x: cx - 1, y: cy }, { x: cx - 2, y: cy }]
  dir     = [1, 0]
  nextDir = [1, 0]
  score   = 0; tick = 0; alive = true
  placeFood()
}

function restart() {
  clearTimeout(timer)
  initGame()
  fullRedraw()
  timer = setTimeout(gameTick, tickDelay())
}

// ─── Input ────────────────────────────────────────────────────────────────────
const DIRS: Record<string, Dir> = {
  '\x1b[A': [0, -1], w: [0, -1], W: [0, -1],
  '\x1b[B': [0,  1], s: [0,  1], S: [0,  1],
  '\x1b[C': [1,  0], d: [1,  0], D: [1,  0],
  '\x1b[D': [-1, 0], a: [-1, 0], A: [-1, 0],
}

process.stdin.on('data', (data: Buffer) => {
  const key = data.toString()
  if (key === 'q' || key === 'Q' || key === '\x03') { cleanup(); return }
  if ((key === 'r' || key === 'R') && !alive)       { restart(); return }

  const d = DIRS[key]
  if (d && alive && (d[0] !== -dir[0] || d[1] !== -dir[1])) nextDir = d
})

// ─── Lifecycle ────────────────────────────────────────────────────────────────
function cleanup() {
  clearTimeout(timer)
  out.reset()
  process.exit(0)
}

process.on('SIGINT', cleanup)
process.stdin.setRawMode?.(true)
process.stdin.resume()

out.alt(true).cursor(false).cls()
initGame()
fullRedraw()
timer = setTimeout(gameTick, tickDelay())
