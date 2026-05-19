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
  [K in keyof typeof Color]: typeof Color[K] extends Color ? K : never
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

  // Allows the auto-attached color methods to typecheck on `this`.
  [key: string]: unknown

  constructor(
    private readonly writer: ITerminalWriter,
    options: { plain?: boolean } = {},
  ) {
    // Honor NO_COLOR (https://no-color.org/) by default when running under
    // Node/Bun; in browser/xterm contexts `process` may be undefined.
    const envNoColor =
      typeof process !== 'undefined' && !!process?.env?.NO_COLOR
    this.plain = options.plain ?? envNoColor
  }

  /** Internal write helper. Single point of contact with the sink. */
  private emit(data: string): void {
    this.writer.write(data)
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

  /** Sets the foreground color and optionally writes formatted text. */
  ink(c: string | Color, fmt: string = '', ...args: unknown[]): this {
    const color = typeof c === 'string' ? new Color(c) : c
    return this.style(color.toAnsiRGB(), fmt, args)
  }

  /** Sets the background color and optionally writes formatted text. */
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

  up(n: number = 1): this    { this.emit(`\x1b[${n}A`); return this }
  down(n: number = 1): this  { this.emit(`\x1b[${n}B`); return this }
  right(n: number = 1): this { this.emit(`\x1b[${n}C`); return this }
  left(n: number = 1): this  { this.emit(`\x1b[${n}D`); return this }

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

  /** Enables or disables the alternate screen buffer. */
  alt(b: boolean = true): this {
    this.emit(`\x1b[?1049${b ? 'h' : 'l'}`)
    return this
  }

  /**
   * Enables or disables auto-wrap (DECAWM, mode 7).
   * Note: this is the rename of the old `scroll()` method, which was
   * misnamed — DEC private mode 7 controls wrapping, not scrolling.
   */
  autoWrap(b: boolean = true): this {
    this.emit(`\x1b[?7${b ? 'h' : 'l'}`)
    return this
  }

  /** Sets the scrolling region (DECSTBM), both rows 1-based and inclusive. */
  scrollRegion(top: number, bottom: number): this {
    this.emit(`\x1b[${top};${bottom}r`)
    return this
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
 * Public constructor. Accepts any object with a `write(string)` method —
 * an xterm.js `Terminal`, a Node `Writable`, a Bun writer wrapper, or a mock.
 *
 * @example
 * import { Terminal as XTerm } from '@xterm/xterm'
 * const xterm = new XTerm()
 * xterm.open(document.getElementById('term')!)
 * const term = createTerminal(xterm)
 * term.red('Hello ').bgBlue(' world ').reset().println()
 */
export function createTerminal(
  writer: ITerminalWriter,
  options: { plain?: boolean } = {},
): ITerminal {
  return new TerminalCore(writer, options) as unknown as ITerminal
}

export { TerminalCore }


