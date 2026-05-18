import { Terminal } from '@retrovm/terminal'

const out = Terminal.out!
const W = process.stdout.columns || 80
const H = (process.stdout.rows || 24) - 1

const GLYPHS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' +
  'ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ'

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function glyph() {
  return GLYPHS[rnd(0, GLYPHS.length - 1)]!
}

function greenHex(brightness: number): string {
  const g = Math.floor(brightness * 220).toString(16).padStart(2, '0')
  return `#00${g}00`
}

type Drop = { y: number; len: number; speed: number; tick: number }

const drops: Drop[] = Array.from({ length: W }, () => ({
  y: rnd(-H, 0),
  len: rnd(6, 24),
  speed: rnd(1, 3),
  tick: 0,
}))

const bright = new Float32Array(W * H)

out.alt(true).cursor(false).cls()

function frame() {
  for (let x = 0; x < W; x++) {
    const d = drops[x]!
    if (++d.tick < d.speed) continue
    d.tick = 0

    d.y++

    if (d.y >= 0 && d.y < H) {
      bright[d.y * W + x] = 1.0
      out.moveTo(d.y + 1, x + 1).ink('#ffffff', glyph())
    }

    for (let y = 0; y < H; y++) {
      if (y === d.y) continue
      const idx = y * W + x
      const b = bright[idx]!
      if (b <= 0) continue
      const nb = Math.max(0, b - 1 / d.len)
      bright[idx] = nb
      out.moveTo(y + 1, x + 1)
      nb <= 0 ? out.print(' ') : out.ink(greenHex(nb), glyph())
    }

    if (d.y - d.len > H) {
      d.y = rnd(-H, 0)
      d.len = rnd(6, 24)
      d.speed = rnd(1, 3)
    }
  }
}

function cleanup() {
  clearInterval(timer)
  out.cursor(true).alt(false)
  process.exit(0)
}

const timer = setInterval(frame, 40)

process.on('SIGINT', cleanup)
process.stdin.setRawMode?.(true)
process.stdin.resume()
process.stdin.once('data', cleanup)
setTimeout(cleanup, 15_000)
