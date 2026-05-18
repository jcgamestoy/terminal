# @retrovm/terminal

A fluent ANSI terminal library for Bun (and Node.js). Wraps any object with a `write(string)` method and exposes a chainable API for text output, 24-bit color, cursor control, and screen management.

Depends on [`@retrovm/color`](https://www.npmjs.com/package/@retrovm/color) (bundled — no extra install needed).

## Features

- **Fluent API** — every method returns `this`, so calls chain naturally
- **24-bit RGB color** — foreground and background via hex strings, `rgb()`, or [`@retrovm/color`](https://www.npmjs.com/package/@retrovm/color) instances
- **Named color shortcuts** — `term.red(...)`, `term.bgBlue(...)` etc., generated automatically from the `Color` registry
- **Full cursor control** — move, save/restore, show/hide
- **Screen management** — clear, alternate buffer, scroll region, auto-wrap
- **Sink-agnostic** — works with Bun's stdout/stderr writers, Node.js `Writable`s, xterm.js terminals, or any test double
- **`NO_COLOR` support** — respects the [no-color.org](https://no-color.org/) convention out of the box
- **TypeScript-first** — strict types with full autocompletion for all color methods

---

## Installation

```sh
bun add @retrovm/terminal        # or: npm install @retrovm/terminal
```

---

## Quick start

### Bun

```typescript
import { Terminal } from '@retrovm/terminal'

const term = Terminal.out   // pre-wired to Bun.stdout
term.red('Hello ').bgBlue(' world ').reset().println()
```

`Terminal.out` and `Terminal.err` are ready-made instances wired to `Bun.stdout` and `Bun.stderr`. Both are `ITerminal | undefined` — use `Terminal.out!` if you know stdout is available.

### Any runtime (Node.js, xterm.js, custom)

```typescript
import { createTerminal } from '@retrovm/terminal'

// Node.js writable
const term = createTerminal(process.stdout)

// xterm.js
import { Terminal as XTerm } from '@xterm/xterm'
const xterm = new XTerm()
xterm.open(document.getElementById('term')!)
const term = createTerminal(xterm)

// Custom / test
const lines: string[] = []
const term = createTerminal({ write: s => lines.push(s) })
```

The only requirement is an object satisfying `ITerminalWriter` — `{ write(data: string): void }`.

---

## API reference

All methods return `this` (the `ITerminal` instance) unless noted otherwise.

### Text output

#### `print(fmt?, ...args)`
Writes formatted text. Uses `util.format` semantics (`%s`, `%d`, `%o`, …).

```typescript
term.print('Value: %d', 42)           // "Value: 42"
term.print('Hello, %s!', 'world')     // "Hello, world!"
```

#### `println(fmt?, ...args)`
Same as `print` but appends `\r\n`.

```typescript
term.println('Line 1').println('Line 2')
```

---

### Color — foreground

#### `ink(color, fmt?, ...args)`
Sets the foreground color and optionally writes formatted text. Resets nothing — the color persists until changed or reset.

```typescript
term.ink('#ff6600', 'Orange text')
term.ink('rgb(100, 200, 50)', 'Custom green')
term.ink(new Color('#3399ff'), 'Color instance')
term.ink('#aaaaaa')   // set color only, write nothing
```

#### `reset(fmt?, ...args)`
Resets **all** attributes (color, background, bold, etc.) and optionally writes text.

```typescript
term.red('warning').reset(' — back to normal')
```

#### `resetInk(fmt?, ...args)`
Resets only the foreground color (leaves background intact).

#### Named color shortcuts
Every named color in the `Color` registry gets an auto-generated method. Call them with or without text:

```typescript
term.red('error')
term.lime('success')
term.cyan()          // set color only
term.white('value: ').yellow('%d', n).reset()
```

The full list depends on the `@retrovm/color` version. All are fully typed and appear in autocomplete.

---

### Color — background

#### `paper(color, fmt?, ...args)`
Sets the background color and optionally writes formatted text.

```typescript
term.paper('#1a1a2e', '  dark bg  ')
term.paper('rgb(30, 30, 30)')   // set only
```

#### `resetPaper(fmt?, ...args)`
Resets only the background color.

#### Named background shortcuts
Same as foreground but prefixed with `bg`:

```typescript
term.bgRed('  error  ')
term.bgBlue(' info ').white(' message ').reset()
```

---

### Cursor movement

All movement methods accept an optional `n` (default `1`).

| Method | ANSI | Description |
|---|---|---|
| `up(n?)` | `ESC[nA` | Move cursor up `n` rows |
| `down(n?)` | `ESC[nB` | Move cursor down `n` rows |
| `right(n?)` | `ESC[nC` | Move cursor right `n` columns |
| `left(n?)` | `ESC[nD` | Move cursor left `n` columns |
| `column(n?)` | `ESC[nG` | Move to column `n` (1-based) |
| `row(n?)` | `ESC[nd` | Move to row `n` (1-based) |
| `moveTo(row, col)` | `ESC[row;colH` | Move to absolute position (both 1-based) |
| `saveCursor()` | `ESC[s` | Save current cursor position |
| `restoreCursor()` | `ESC[u` | Restore previously saved position |

```typescript
term.moveTo(5, 1).print('Row 5, col 1')
term.saveCursor().moveTo(1, 1).print('top').restoreCursor()
term.column(1).print('back to start of line')
```

#### `cursor(visible?)`
Shows or hides the cursor.

```typescript
term.cursor(false)   // hide
term.cursor(true)    // show (default)
```

---

### Screen

#### `cls()`
Clears the entire screen and moves the cursor to the home position (row 1, col 1).

```typescript
term.cls()
```

#### `clearLine()`
Clears from the cursor to the end of the current line.

```typescript
term.column(20).clearLine()   // clear everything after col 20
```

#### `alt(enable?)`
Enables or disables the **alternate screen buffer**. The alternate buffer is a separate screen area — the original content is preserved and restored when you switch back. Essential for full-screen TUI applications.

```typescript
term.alt(true).cursor(false).cls()
// ... full-screen UI ...
term.cursor(true).alt(false)
```

#### `autoWrap(enable?)`
Enables or disables DECAWM (auto-wrap mode). When disabled, output past the last column stays at the last column instead of wrapping to the next line.

```typescript
term.autoWrap(false)
```

#### `scrollRegion(top, bottom)`
Sets the scrolling region to rows `top`–`bottom` (both 1-based, inclusive). Only that region scrolls; content above and below is pinned.

```typescript
term.scrollRegion(3, 20)   // only rows 3–20 scroll
term.scrollRegion(1, process.stdout.rows)   // reset to full screen
```

---

### Options

#### `plain`
Boolean property. When `true`, all ANSI escape sequences are suppressed and only plain text is emitted. Automatically set to `true` if `NO_COLOR` is present in the environment.

```typescript
const term = createTerminal(writer, { plain: true })
term.plain = false   // can be toggled at runtime
```

---

## Colors (`@retrovm/color`)

`@retrovm/color` is a bundled dependency — it ships with this package, nothing extra to install. The `Color` class integrates directly with `ink()` and `paper()`:

```typescript
import { Color } from '@retrovm/color'

// Named colors (also available as term.red, term.bgBlue, etc.)
term.ink(Color.red, 'red text')

// HSV — cycle through the color wheel
term.ink(Color.fromHSV(0.6, 1, 1), 'blue')   // hue 0=red, 0.33=green, 0.66=blue

// Gradient across a string
const str = 'Hello, world!'
for (let i = 0; i < str.length; i++) {
  term.ink(Color.fromHSV(i / str.length, 1, 1), str[i])
}
term.reset()

// Interpolate between two hues
const H1 = 0.6, H2 = 0.38   // blue → cyan → green
for (let i = 0; i < 40; i++) {
  term.ink(Color.fromHSV(H1 + (H2 - H1) * (i / 40), 1, 1), '█')
}
```

Named shortcuts (`term.red`, `term.bgBlue`, …) are built from the static `Color` properties at construction time, so adding a color to the `Color` class automatically exposes it as a method — no changes needed here.

---

## Package exports

```json
{
  "exports": {
    ".": {
      "bun":    "./src/bun.ts",
      "types":  "./src/bun.ts",
      "import": "./src/terminal.ts"
    }
  }
}
```

| Condition | File | Used by |
|---|---|---|
| `bun` | `src/bun.ts` | Bun runtime — exports pre-wired `Terminal.out` / `Terminal.err` plus re-exports everything from `terminal.ts` |
| `types` | `src/bun.ts` | TypeScript language server (VSCode, tsc) |
| `import` | `src/terminal.ts` | Node.js ESM, bundlers |

When running under Bun, `import { Terminal } from '@retrovm/terminal'` resolves to `src/bun.ts`. In Node.js it resolves to `src/terminal.ts`, which exports `createTerminal` and the `Terminal` class directly.

---

## Samples

Run any sample with `bun run sample/<name>.ts`.

### `basic.ts`
Minimal hello-world in lime green.

```typescript
import { Terminal } from '@retrovm/terminal'
Terminal.out!.lime('Hello, world!\n').reset()
```

### `rainbow.ts`
Cycles the full HSV hue wheel across a string, one color per character.

```sh
bun run sample/rainbow.ts
```

### `progress.ts`
Animated multi-stage progress bar. Uses `column(1)` to rewrite the line in place — no alternate screen, no flicker. The filled blocks carry an HSV gradient from blue through cyan to green; the percentage label tracks the gradient front.

```sh
bun run sample/progress.ts
```

### `matrix.ts`
Full-screen Matrix rain in the alternate buffer. Katakana + ASCII glyphs fall in columns with randomized speed and trail length. The head of each column is white; the trail fades from bright green to dark green. Exit with any key or after 15 seconds.

```sh
bun run sample/matrix.ts
```

### `fire.ts`
Procedural fire simulation using the **half-block trick**: the `▄` character has its foreground and background set to different colors, doubling the effective vertical resolution. Heat propagates upward from a seeded bottom row, cooling as it rises. Color palette: black → dark red → orange → yellow → white.

```sh
bun run sample/fire.ts
```

### `sysmon.ts`
Live system monitor that refreshes every second inside the alternate buffer. Two-panel layout drawn with box-drawing characters (`┌┬┐│├┤└┴┘─`). Left panel shows overall CPU average and per-core usage bars; right panel shows system RAM and process heap. All bars are color-coded: green below 70%, orange 70–90%, red above 90%.

```sh
bun run sample/sysmon.ts
```

---

## Writing a custom sink

Any object satisfying `ITerminalWriter` (`{ write(data: string): void }`) works:

```typescript
// Collect output for testing
const chunks: string[] = []
const term = createTerminal({ write: s => chunks.push(s) })
term.red('error').reset()
// chunks contains raw ANSI bytes

// Write to a file
import { createWriteStream } from 'node:fs'
const stream = createWriteStream('out.ans')
const term = createTerminal({ write: s => stream.write(s) })
```

---

## `NO_COLOR`

If the environment variable `NO_COLOR` is set (to any value), `plain` defaults to `true` and all escape sequences are suppressed. The API stays identical — only the output changes.

```sh
NO_COLOR=1 bun run sample/rainbow.ts   # plain text, no color
```

---

## License

MIT © Juan Carlos González Amestoy
