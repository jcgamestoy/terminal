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

import { createTerminal } from "./terminal"
export { createTerminal, type ITerminal, type ITerminalWriter } from "./terminal"

const _outWriter = Bun.stdout.writer()
const _errWriter = Bun.stderr.writer()

const _writeOut = (data: string) => { _outWriter.write(data); _outWriter.flush() }
const _writeErr = (data: string) => { _errWriter.write(data); _errWriter.flush() }

export const Terminal = {
  out: createTerminal({ write: _writeOut }),
  err: createTerminal({ write: _writeErr }),
}