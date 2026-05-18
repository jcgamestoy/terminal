import { Terminal } from '@retrovm/terminal'
import { Color } from '@retrovm/color'

const t = Terminal.out!
const BAR = 32

function draw(label: string, pct: number) {
  const n = Math.round(pct / 100 * BAR)
  t.column(1)
   .ink('#888', `${label.padEnd(12)} `)
   .ink('#444', '[')
  const H1 = 0.6, H2 = 0.38  // blue → cyan → green
  const hue = (i: number) => Color.fromHSV(H1 + (H2 - H1) * (i / BAR), 1, 1)
  for (let i = 0; i < n; i++) t.ink(hue(i), '█')
  t.ink('#333', '░'.repeat(BAR - n))
   .ink('#444', '] ')
   .ink(hue(n), `${String(pct).padStart(3)}%`)
}

async function task(label: string, ms: number) {
  for (let i = 0; i <= 100; i++) {
    draw(label, i)
    await Bun.sleep(ms / 100)
  }
  t.println()
}

t.println()
await task('Downloading', 2000)
await task('Extracting',   600)
await task('Installing',  1200)
t.ink('#22cc44', '\n  ✓ Done!\n').reset()
