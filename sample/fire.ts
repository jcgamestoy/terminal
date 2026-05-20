import { Terminal } from '@retrovm/terminal'
const out = Terminal.out!

const W = process.stdout.columns || 80
const H = process.stdout.rows || 24
const FW = W, FH = H * 2

const buf  = new Uint8Array(FW * (FH + 4))
const prev = new Uint8Array(W * H * 2)

// LUT: "r;g;b" precomputado para cada intensidad
const pal: string[] = new Array(256)
for (let v = 0; v < 256; v++) {
  let r = 0, g = 0, b = 0
  if (v < 64)       { r = (v / 63 * 180) | 0 }
  else if (v < 128) { const t = (v - 64)  / 63; r = 180 + (t * 75)  | 0; g = (t * 100) | 0 }
  else if (v < 192) { const t = (v - 128) / 63; r = 255; g = 100 + (t * 155) | 0 }
  else              { const t = (v - 192) / 63; r = 255; g = 255; b = (t * 255) | 0 }
  pal[v] = `${r};${g};${b}`
}

function seed() {
  for (let x = 0; x < FW; x++) {
    buf[ FH      * FW + x] = Math.random() > 0.4 ? 255 : (Math.random() * 160) | 0
    buf[(FH + 1) * FW + x] = 255
  }
}

function update() {
  seed()
  for (let y = 0; y < FH; y++) {
    const r0 = (y + 1) * FW, r1 = (y + 2) * FW, ry = y * FW
    for (let x = 0; x < FW; x++) {
      const xm = x > 0 ? x - 1 : 0
      const xp = x < FW - 1 ? x + 1 : FW - 1
      const s = buf[r0 + x]! + buf[r0 + xm]! + buf[r0 + xp]! + buf[r1 + x]!
      const v = (s >> 2) - 3
      buf[ry + x] = v > 0 ? v : 0
    }
  }
}

let firstFrame = true

function frame() {
  update()

  out.sync(() => {
    let curBg = -1, curFg = -1
    let lastRow = -1, lastCol = -2

    for (let row = 0; row < H; row++) {
      const yt = (row * 2)     * FW
      const yb = (row * 2 + 1) * FW
      for (let col = 0; col < W; col++) {
        const top = buf[yt + col]!
        const bot = buf[yb + col]!
        const idx = (row * W + col) * 2

        if (!firstFrame && prev[idx] === top && prev[idx + 1] === bot) continue
        prev[idx] = top; prev[idx + 1] = bot

        if (row !== lastRow || col !== lastCol + 1) {
          out.raw(`\x1b[${row + 1};${col + 1}H`)
        }

        const bgChanged = top !== curBg
        const fgChanged = bot !== curFg
        if (bgChanged && fgChanged) {
          out.raw(`\x1b[48;2;${pal[top]};38;2;${pal[bot]}m`)
          curBg = top; curFg = bot
        } else if (bgChanged) {
          out.raw(`\x1b[48;2;${pal[top]}m`); curBg = top
        } else if (fgChanged) {
          out.raw(`\x1b[38;2;${pal[bot]}m`); curFg = bot
        }

        out.raw('▄')
        lastRow = row; lastCol = col
      }
    }
    out.raw('\x1b[0m')
  })

  firstFrame = false
}

out.alt(true).cursor(false).cls()

function cleanup() {
  clearInterval(timer)
  out.reset().cursor(true).alt(false)
  process.exit(0)
}
const timer = setInterval(frame, 32)
process.on('SIGINT', cleanup)
process.stdin.setRawMode?.(true)
process.stdin.resume()
process.stdin.once('data', cleanup)
setTimeout(cleanup, 20_000)