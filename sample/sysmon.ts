import { Terminal } from '@retrovm/terminal'
import * as os from 'node:os'

const t  = Terminal.out!
const W  = process.stdout.columns ?? 80
const H  = process.stdout.rows    ?? 24
const M  = Math.floor(W / 2)   // column of center divider
const LW = M - 2               // left panel inner width
const RW = W - M - 2           // right panel inner width
const LB = LW - 11             // bar width: label(6) + bar + " XXX%"(5) = LW
const RB = RW - 11

// ─── CPU sampling ─────────────────────────────────────────────────────────

type Snap = os.CpuInfo['times']
let snap: Snap[] = []

function cpuPcts(): number[] {
  return os.cpus().map((cpu, i) => {
    const c = cpu.times, p = snap[i]
    snap[i] = { ...c }
    if (!p) return 0
    const dt = (c.user + c.nice + c.sys + c.idle + c.irq)
             - (p.user + p.nice + p.sys + p.idle + p.irq)
    return dt <= 0 ? 0 : Math.round((1 - (c.idle - p.idle) / dt) * 100)
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const tint = (n: number) => n >= 90 ? '#ff3333' : n >= 70 ? '#ffaa00' : '#22cc44'
const fmtB = (b: number) => b >= 1e9 ? `${(b / 1e9).toFixed(1)}G` : `${(b / 1e6).toFixed(0)}M`
const fmtU = (s: number) => {
  const [d, h, m] = [~~(s / 86400), ~~(s % 86400 / 3600), ~~(s % 3600 / 60)]
  return d ? `${d}d ${h}h` : `${h}h ${m}m`
}

// Fixed-width labeled bar: label(6) + bar(barW) + " XXX%"(5) = barW+11 chars
function brow(label: string, pct: number, barW: number) {
  const n = Math.round(Math.min(100, pct) / 100 * barW)
  t.ink('#777', label)
   .ink(tint(pct), '█'.repeat(n))
   .ink('#333', '░'.repeat(barW - n))
   .ink(tint(pct), ` ${String(pct).padStart(3)}%`)
}

// Plain text row padded to exact width
function trow(text: string, width: number) {
  t.ink('#555', text.slice(0, width).padEnd(width))
}

// ─── Frame ────────────────────────────────────────────────────────────────

function frame() {
  const pcts  = cpuPcts()
  const avg   = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0
  const total = os.totalmem(), free = os.freemem(), used = total - free
  const mPct  = Math.round(used / total * 100)
  const heap  = process.memoryUsage()
  const hPct  = Math.round(heap.heapUsed / heap.heapTotal * 100)
  const now   = new Date().toLocaleTimeString('en-GB')

  // Top border
  t.moveTo(1, 1).ink('#555', `┌${'─'.repeat(W - 2)}┐`)

  // Header
  const info = `${os.hostname()}  ${os.platform()}  up ${fmtU(os.uptime())}`
  const gap  = Math.max(1, W - 12 - info.length - now.length)
  t.moveTo(2, 1)
   .ink('#555', '│').ink('#eee', ' SYSMON ').ink('#555', ' ')
   .ink('#666', info)
   .print(' '.repeat(gap))
   .ink('#888', now).ink('#555', ' │')

  // Column separator
  t.moveTo(3, 1).ink('#555', `├${'─'.repeat(M - 2)}┬${'─'.repeat(W - M - 1)}┤`)

  // Panel titles
  t.moveTo(4, 1).ink('#555', '│')
   .moveTo(4, 2).ink('#aaa', ' CPU'.padEnd(LW))
   .moveTo(4, M).ink('#555', '│')
   .moveTo(4, M + 1).ink('#aaa', ' MEMORY'.padEnd(RW))
   .moveTo(4, W).ink('#555', '│')

  // Content rows: 5 to H-3
  const CH = H - 3 - 5 + 1

  for (let i = 0; i < CH; i++) {
    const r = 5 + i
    t.moveTo(r, 1).ink('#555', '│')

    // Left panel: avg, gap, then per-core
    t.moveTo(r, 2)
    if (i === 0)      brow(' avg  ', avg, LB)
    else if (i === 1) t.print(' '.repeat(LW))
    else {
      const ci = i - 2
      ci < pcts.length
        ? brow(` c${String(ci).padEnd(4)}`, pcts[ci]!, LB)
        : t.print(' '.repeat(LW))
    }

    t.moveTo(r, M).ink('#555', '│')

    // Right panel: sys mem, text, gap, heap, text, empty
    t.moveTo(r, M + 1)
    if      (i === 0) brow(' sys  ', mPct, RB)
    else if (i === 1) trow(` ${fmtB(used)} / ${fmtB(total)}`, RW)
    else if (i === 2) t.print(' '.repeat(RW))
    else if (i === 3) brow(' heap ', hPct, RB)
    else if (i === 4) trow(` ${fmtB(heap.heapUsed)} / ${fmtB(heap.heapTotal)}`, RW)
    else              t.print(' '.repeat(RW))

    t.moveTo(r, W).ink('#555', '│')
  }

  // Footer
  t.moveTo(H - 2, 1).ink('#555', `├${'─'.repeat(W - 2)}┤`)
  t.moveTo(H - 1, 1).ink('#555', '│')
   .ink('#444', ' press any key to exit'.padEnd(W - 2))
   .ink('#555', '│')
  t.moveTo(H, 1).ink('#555', `└${'─'.repeat(W - 2)}┘`)

  t.reset()
}

// ─── Run ──────────────────────────────────────────────────────────────────

function cleanup() {
  clearInterval(timer)
  t.cursor(true).alt(false)
  process.exit(0)
}

t.alt(true).cursor(false).cls()
frame()
const timer = setInterval(frame, 1000)

process.on('SIGINT', cleanup)
process.stdin.setRawMode?.(true)
process.stdin.resume()
process.stdin.once('data', cleanup)
