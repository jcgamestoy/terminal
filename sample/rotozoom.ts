import { Terminal } from '@retrovm/terminal'
import { Color } from '@retrovm/color'
import { rotozoomImgHeight, rotozoomImgWidth, rotozoomRGBA } from './rotozoom.img'
const out = Terminal.out

class RotoZoom {
  protected _angle = 0
  protected _w = 0
  protected _h = 0
  protected _buffer: Uint32Array = new Uint32Array()

  constructor() {
    this._loadTexture().then(() => {})
  }

  protected async _loadTexture() {}

  protected _update(dt: number) {
    const W = process.stdout.columns ?? 80
    const H = process.stdout.rows ?? 24
    if (W !== this._w || H !== this._h) {
      this._w = W
      this._h = H * 2
      this._buffer = new Uint32Array(W * H * 2)
    }

    const c = Math.cos((this._angle * Math.PI) / 180),
      s = Math.sin((this._angle * Math.PI) / 180)

    this._angle += 60 * dt

    const zoomMin = -10
    const zoomMax = -2
    const zoom = zoomMin + (zoomMax - zoomMin) * (Math.sin((this._angle * Math.PI) / 180) * 0.5 + 0.5)

    for (let j = 0; j < this._h; j++) {
      for (let i = 0; i < this._w; i++) {
        const u = Math.floor((i * c - j * s) * zoom) % rotozoomImgWidth
        let v = Math.floor((i * s + j * c) * zoom) % rotozoomImgHeight
        if (v < 0) v += rotozoomImgHeight

        this._buffer[j * this._w + i] = rotozoomRGBA[v * rotozoomImgWidth + u]!
      }
    }
  }

  protected _frame() {
    out.sync(() => {
      out.moveTo(0, 0)
      for (let j = 0; j < this._h; j += 2) {
        for (let i = 0; i < this._w; i++) {
          const idx = j * this._w + i
          const color1 = this._buffer[idx]
          const color2 = this._buffer[idx + this._w]
          out.paper(new Color(color1!)).ink(new Color(color2!)).raw('▄')
        }
      }
    })
  }

  public run() {
    let t = Date.now()
    setInterval(() => {
      const now = Date.now()
      const dt = (now - t) / 1000
      t = now
      this._update(dt)
      this._frame()
    }, 16)
  }
}

const app = new RotoZoom()

function cleanup() {
  out.reset().cursor(true).alt(false)
  process.exit(0)
}

process.on('SIGINT', cleanup)
process.stdin.setRawMode?.(true)
process.stdin.resume()
process.stdin.once('data', cleanup)

out.alt(true).cursor(false).cls()
app.run()
