import { createTerminal } from "./terminal"
export { createTerminal, type ITerminal, type ITerminalWriter } from "./terminal"

export const Terminal = {
  out: createTerminal(process.stdout),
  err: createTerminal(process.stderr),
}
