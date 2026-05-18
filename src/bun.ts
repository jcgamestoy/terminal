import { createTerminal } from "./terminal"
export { createTerminal, type ITerminal, type ITerminalWriter } from "./terminal"

const  _writeOut=(data:string)=>{
    const w=Bun.stdout.writer()
    w.write(data)
    w.flush()
  }

const  _writeErr=(data:string)=>{
    const w=Bun.stderr.writer()
    w.write(data)
    w.flush()
  }


export const Terminal={
  out: createTerminal({ write: _writeOut }) ,
  err: createTerminal({ write: _writeErr }) ,
}