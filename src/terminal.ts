/*Copyright (c) 2026 Juan Carlos González Amestoy

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.*/

import { Color } from '@retrovm/color'
import { format } from 'node:util'

/**
 * Minimal sink interface. Anything with a `write(data: string)` method works:
 * an xterm.js Terminal instance, a Node Writable, a Bun writer wrapper, or a
 * test double that pushes to an array.
 */
export interface ITerminalWriter {
  write(data: string): void
}

/**
 * Extracts from `Color` only the keys whose value is an instance of `Color`,
 * so the generated method names exactly match the available named colors.
 * Add a color to the `Color` class and both `ink<Name>` and `bg<Name>` methods
 * appear automatically with full type safety and autocompletion.
 */
type ColorName = {
  [K in keyof typeof Color]: (typeof Color)[K] extends Color ? K : never
}[keyof typeof Color]

type ColorMethod = (fmt?: string, ...args: unknown[]) => ITerminal
type InkMethods = { [K in ColorName]: ColorMethod }
type BgMethods = { [K in ColorName as `bg${Capitalize<string & K>}`]: ColorMethod }

/**
 * Public type of a Terminal instance: core methods plus all the auto-generated
 * color shortcuts. Consumers see one cohesive type with autocompletion.
 */
export type ITerminal = TerminalCore & InkMethods & BgMethods

/**
 * Core terminal output. Wraps any object with a `write(string)` method and
 * exposes a fluent API for ANSI styling and cursor control.
 *
 * Color shortcut methods (e.g. `red`, `bgBlue`) are attached at construction
 * time from the `Color` registry. They are declared via the `ITerminal` type
 * and dispatched through an index signature on the class.
 */
class TerminalCore {
  /** ANSI is suppressed when true; styling/cursor methods become no-ops. */
  public plain: boolean

  /** Accumulated output when in buffered mode; `null` when unbuffered. */
  protected _buffer: string | null = null
  /** Nesting depth of active `sync()` calls; only the outermost emits mode 2026. */
  protected _syncDepth = 0
  /** Tracks whether the alternate screen buffer is currently active. */
  protected _altScreen = false;

  // Allows the auto-attached color methods to typecheck on `this`.
  [key: string]: unknown

  /**
   * @param writer - Any object that implements `write(data: string)`.
   * @param options.plain - When `true`, all ANSI escape sequences are stripped
   *   and only plain text is emitted. Defaults to `true` when the `NO_COLOR`
   *   environment variable is set; `false` otherwise.
   */
  constructor(
    protected readonly writer: ITerminalWriter,
    options: { plain?: boolean } = {},
  ) {
    // Honor NO_COLOR (https://no-color.org/) by default when running under
    // Node/Bun; in browser/xterm contexts `process` may be undefined.
    const envNoColor = typeof process !== 'undefined' && !!process?.env?.NO_COLOR
    this.plain = options.plain ?? envNoColor
  }

  /** Internal style helper: skips ANSI when `plain` is enabled. */
  private style(seq: string, fmt: string, args: unknown[]): this {
    const text = format(fmt, ...args)
    this.emit(this.plain ? text : seq + text)
    return this
  }

  // ─── Text output ──────────────────────────────────────────────────────────

  /** Prints formatted text. Uses `util.format` semantics (`%s`, `%d`, …). */
  print(fmt: string = '', ...args: unknown[]): this {
    this.emit(format(fmt, ...args))
    return this
  }

  /** Prints formatted text followed by a newline. */
  println(fmt: string = '', ...args: unknown[]): this {
    this.emit(format(fmt, ...args) + '\r\n')
    return this
  }

  // ─── Color ────────────────────────────────────────────────────────────────

  /**
   * Sets the foreground color and optionally writes formatted text.
   *
   * @param c - A `Color` instance or a CSS-compatible color string (`'#f80'`,
   *   `'#ff8800'`, `'red'`). Strings are parsed by `Color` on every call;
   *   prefer passing a pre-built `Color` instance in hot loops.
   * @param fmt - `util.format`-style template string.
   * @param args - Substitution values for `fmt`.
   */
  ink(c: string | Color, fmt: string = '', ...args: unknown[]): this {
    const color = typeof c === 'string' ? new Color(c) : c
    return this.style(color.toAnsiRGB(), fmt, args)
  }

  /**
   * Sets the background color and optionally writes formatted text.
   *
   * @param c - A `Color` instance or a CSS-compatible color string (`'#f80'`,
   *   `'#ff8800'`, `'red'`). Strings are parsed by `Color` on every call;
   *   prefer passing a pre-built `Color` instance in hot loops.
   * @param fmt - `util.format`-style template string.
   * @param args - Substitution values for `fmt`.
   */
  paper(c: string | Color, fmt: string = '', ...args: unknown[]): this {
    const color = typeof c === 'string' ? new Color(c) : c
    return this.style(color.toAnsiBackgroundRGB(), fmt, args)
  }

  /**
   * Resets all text attributes (color, background, bold, dim, italic,
   * underline, blink, reverse, …) by emitting `\x1b[0m`.
   *
   * Unlike {@link reset}, this does **not** touch the cursor visibility
   * or the alternate screen buffer.
   */
  resetText(fmt: string = '', ...args: unknown[]): this {
    return this.style('\x1b[0m', fmt, args)
  }

  /**
   * Fully resets the terminal to a clean state.
   *
   * In order:
   * 1. Shows the cursor (`cursor(true)`)
   * 2. Exits the alternate screen buffer (`alt(false)`)
   * 3. Resets all text attributes — color, background, intensity, etc. (`\x1b[0m`)
   *
   * Safe to call as a teardown step after any TUI or interactive session.
   */
  reset(fmt: string = '', ...args: unknown[]): this {
    return this.cursor(true).alt(false).style('\x1b[0m', fmt, args)
  }

  /** Resets only the foreground color. */
  resetInk(fmt: string = '', ...args: unknown[]): this {
    return this.style('\x1b[39m', fmt, args)
  }

  /** Resets only the background color. */
  resetPaper(fmt: string = '', ...args: unknown[]): this {
    return this.style('\x1b[49m', fmt, args)
  }

  // ─── Screen ───────────────────────────────────────────────────────────────

  /** Clears the screen and homes the cursor. */
  cls(): this {
    this.emit('\x1b[2J\x1b[H')
    return this
  }

  /** Clears from cursor to end of line. */
  clearLine(): this {
    this.emit('\x1b[K')
    return this
  }

  // ─── Cursor ───────────────────────────────────────────────────────────────

  /** Moves the cursor up by `n` rows (CUU). */
  up(n: number = 1): this {
    this.emit(`\x1b[${n}A`)
    return this
  }

  /** Moves the cursor down by `n` rows (CUD). */
  down(n: number = 1): this {
    this.emit(`\x1b[${n}B`)
    return this
  }

  /** Moves the cursor right by `n` columns (CUF). */
  right(n: number = 1): this {
    this.emit(`\x1b[${n}C`)
    return this
  }

  /** Moves the cursor left by `n` columns (CUB). */
  left(n: number = 1): this {
    this.emit(`\x1b[${n}D`)
    return this
  }

  /** Moves the cursor to the given column (1-based). */
  column(n: number = 1): this {
    this.emit(`\x1b[${n}G`)
    return this
  }

  /** Moves the cursor to the given row (1-based). */
  row(n: number = 1): this {
    this.emit(`\x1b[${n}d`)
    return this
  }

  /** Moves the cursor to the given (row, col), both 1-based. */
  moveTo(row: number, col: number): this {
    this.emit(`\x1b[${row};${col}H`)
    return this
  }

  /** Saves the current cursor position. */
  saveCursor(): this {
    this.emit('\x1b[s')
    return this
  }

  /** Restores the previously saved cursor position. */
  restoreCursor(): this {
    this.emit('\x1b[u')
    return this
  }

  /** Shows or hides the cursor. */
  cursor(visible: boolean = true): this {
    this.emit(visible ? '\x1b[?25h' : '\x1b[?25l')
    return this
  }

  // ─── Modes ────────────────────────────────────────────────────────────────

  /**
   * Switches to (`true`) or exits (`false`) the alternate screen buffer
   * (DECSET/DECRST 1049). The alternate screen saves the current scrollback
   * and cursor state on entry, presents a blank canvas for TUI rendering, and
   * restores the original view on exit — exactly what `vim`, `less`, and
   * similar programs do. Calls are idempotent: switching to a buffer already
   * active emits nothing.
   */
  alt(b: boolean = true): this {
    if (b !== this._altScreen) {
      this.emit(`\x1b[?1049${b ? 'h' : 'l'}`)
      this._altScreen = b
    }
    return this
  }

  /**
   * Enables or disables auto-wrap (DECAWM, DEC private mode 7). When enabled
   * (the default in most terminals), the cursor wraps to the next line when
   * it reaches the right margin. Disable it to overwrite characters in place,
   * which is useful for progress bars and fixed-width TUI cells.
   */
  autoWrap(b: boolean = true): this {
    this.emit(`\x1b[?7${b ? 'h' : 'l'}`)
    return this
  }

  /**
   * Sets the scrolling region (DECSTBM). Scroll and line-feed operations are
   * confined to rows `top`–`bottom`, leaving content outside the region
   * undisturbed. Both values are 1-based and inclusive. Useful for keeping a
   * status bar or header fixed while the main content area scrolls normally.
   *
   * @param top - First row of the scrolling region (1-based).
   * @param bottom - Last row of the scrolling region (1-based).
   */
  scrollRegion(top: number, bottom: number): this {
    this.emit(`\x1b[${top};${bottom}r`)
    return this
  }

  // ─── Buffered output ──────────────────────────────────────────────────────

  /**
   * Enters buffered mode. Subsequent emissions accumulate in memory until
   * `flush()` commits them in a single `write()` to the underlying sink.
   *
   * Essential for animation loops and full-screen redraws on terminals
   * that perform poorly with many small writes (macOS Terminal, GNOME
   * Terminal, Konsole). A 80×24 frame can easily produce thousands of
   * style transitions; coalescing them into one write turns thousands
   * of syscalls into one.
   *
   * Calling `buffer()` while already buffered is a no-op — buffered
   * mode is a single state, not a stack.
   */
  buffer(): this {
    if (this._buffer === null) this._buffer = ''
    return this
  }

  /**
   * Commits the accumulated buffer in a single `write()` and exits
   * buffered mode. Calling `flush()` when not buffered is a no-op.
   */
  flush(): this {
    if (this._buffer !== null) {
      const data = this._buffer
      this._buffer = null
      if (data.length > 0) this.writer.write(data)
    }
    return this
  }

  /**
   * Writes a pre-built string directly, bypassing `util.format`. Useful
   * in hot loops where the caller has already constructed the exact bytes
   * to emit (e.g. precomputed SGR sequences from a palette LUT) and wants
   * to avoid the per-call formatting overhead.
   *
   * Honors buffered mode like every other emission.
   */
  raw(data: string): this {
    this.emit(data)
    return this
  }

  // ─── Synchronized output ──────────────────────────────────────────────────

  /**
   * Runs `fn` inside a synchronized-output block (DEC private mode 2026).
   * The terminal accumulates all changes from the block and presents them
   * atomically when the block ends, eliminating tearing in TUIs and
   * animations. Terminals that don't support mode 2026 (e.g. macOS
   * Terminal.app, plain xterm) ignore the escape silently.
   *
   * Automatically enables buffered mode for the duration of the block —
   * synchronized output without buffering would defeat its purpose, since
   * each tiny write would still race the terminal's refresh.
   *
   * Re-entrant: nested `sync()` calls share the outer block (mode 2026
   * is not stackable in the protocol).
   *
   * The block is guarded by try/finally so the closing escape and flush
   * always run, even if `fn` throws — important because mode 2026 has a
   * ~150ms server-side timeout and leaving it open looks like a freeze.
   *
   * @example
   * out.sync(() => {
   *   for (let row = 0; row < H; row++) {
   *     for (let col = 0; col < W; col++) {
   *       out.moveTo(row + 1, col + 1).paper(bg).ink(fg, '▄')
   *     }
   *   }
   * })
   */
  sync(fn: () => void): this {
    const outer = this._syncDepth === 0
    const startedBuffer = outer && this._buffer === null
    if (outer) {
      if (startedBuffer) this.buffer()
      this.emit('\x1b[?2026h')
    }
    this._syncDepth++
    try {
      fn()
    } finally {
      this._syncDepth--
      if (outer) {
        this.emit('\x1b[?2026l')
        if (startedBuffer) this.flush()
      }
    }
    return this
  }

  private emit(data: string): void {
    if (this._buffer !== null) this._buffer += data
    else this.writer.write(data)
  }
}

/**
 * Attaches one method per named color in the `Color` registry. Done once,
 * on the prototype, so every Terminal instance shares the same functions and
 * adding a new color to `Color` propagates automatically — no edits here.
 */
function installColorMethods(): void {
  const proto = TerminalCore.prototype as unknown as Record<string, unknown>
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

  for (const key of Object.keys(Color) as Array<keyof typeof Color>) {
    const value = Color[key]
    if (!(value instanceof Color)) continue

    const name = key as string

    proto[name] = function (this: TerminalCore, fmt: string = '', ...args: unknown[]) {
      return (this as unknown as ITerminal).ink(value, fmt, ...args)
    }

    proto[`bg${cap(name)}`] = function (this: TerminalCore, fmt: string = '', ...args: unknown[]) {
      return (this as unknown as ITerminal).paper(value, fmt, ...args)
    }
  }
}

installColorMethods()

/**
 * Creates a new `Terminal` instance backed by `writer`.
 *
 * Accepts any object with a `write(string)` method — an xterm.js `Terminal`,
 * a Node `Writable`, a Bun writer wrapper, or a test double.
 *
 * @param writer - The output sink. Must implement `write(data: string): void`.
 * @param options.plain - Suppress all ANSI sequences and emit plain text only.
 *   Defaults to `true` when `NO_COLOR` is set in the environment.
 * @returns A fully typed `ITerminal` with core methods and auto-generated
 *   named-color shortcuts (`red`, `bgBlue`, …).
 *
 * @example
 * import { Terminal as XTerm } from '@xterm/xterm'
 * const xterm = new XTerm()
 * xterm.open(document.getElementById('term')!)
 * const term = createTerminal(xterm)
 * term.red('Hello ').bgBlue(' world ').reset().println()
 */
export function createTerminal(writer: ITerminalWriter, options: { plain?: boolean } = {}): ITerminal {
  return new TerminalCore(writer, options) as unknown as ITerminal
}

export { TerminalCore }
