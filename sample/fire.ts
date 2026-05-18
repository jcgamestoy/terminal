import { Terminal } from '@retrovm/terminal'

const out = Terminal.out!
const W = process.stdout.columns || 80
const H = process.stdout.rows || 24

// Half-block trick: each char cell = 2 fire pixels (▄ fg=bottom, bg=top)
const FW = W
const FH = H * 2
const buf = new Uint8Array(FW * (FH + 4))

function fireColor(v: number): string {
  if (v === 0)    return '#000000'
  if (v < 64)  { const r = Math.floor(v / 63 * 180);                                           return `#${r.toString(16).padStart(2,'0')}0000` }
  if (v < 128) { const t = (v - 64)  / 63; const r = 180 + Math.floor(t * 75); const g = Math.floor(t * 100); return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}00` }
  if (v < 192) { const t = (v - 128) / 63; const g = 100 + Math.floor(t * 155);                return `#ff${g.toString(16).padStart(2,'0')}00` }
  {              const t = (v - 192) / 63; const b = Math.floor(t * 255);                       return `#ffff${b.toString(16).padStart(2,'0')}` }
}

function seed() {
  for (let x = 0; x < FW; x++) {
    buf[(FH)     * FW + x] = Math.random() > 0.4 ? 255 : Math.floor(Math.random() * 160)
    buf[(FH + 1) * FW + x] = 255
  }
}

function update() {
  seed()
  for (let y = 0; y < FH; y++) {
    for (let x = 0; x < FW; x++) {
      const b0 = buf[(y + 1) * FW + x]!
      const b1 = buf[(y + 1) * FW + Math.max(0, x - 1)]!
      const b2 = buf[(y + 1) * FW + Math.min(FW - 1, x + 1)]!
      const b3 = buf[(y + 2) * FW + x]!
      buf[y * FW + x] = Math.max(0, Math.floor((b0 + b1 + b2 + b3) / 4) - 3)
    }
  }
}

out.alt(true).cursor(false).cls()

function frame() {
  update()
  for (let row = 0; row < H; row++) {
    for (let col = 0; col < W; col++) {
      const top = buf[(row * 2)     * FW + col]!
      const bot = buf[(row * 2 + 1) * FW + col]!
      out.moveTo(row + 1, col + 1).paper(fireColor(top)).ink(fireColor(bot), '▄')
    }
  }
  out.reset()
}

function cleanup() {
  clearInterval(timer)
  out.reset().cursor(true).alt(false)
  process.exit(0)
}

const timer = setInterval(frame, 40)

process.on('SIGINT', cleanup)
process.stdin.setRawMode?.(true)
process.stdin.resume()
process.stdin.once('data', cleanup)
setTimeout(cleanup, 20_000)
