import { Terminal } from '@retrovm/terminal'
import { Color } from "@retrovm/color"

const tt=Terminal.out!

const rainbow = (s: string) => {
  const l = s.length
  for (let i = 0; i < l; i++) {
    tt.ink(Color.fromHSV(i / l, 1, 1), s[i])
  }
  tt.reset('')
  return tt
}

rainbow("Hello, world!\n").reset()