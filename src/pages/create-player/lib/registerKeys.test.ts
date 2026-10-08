import { describe, expect, it } from 'vitest'
import { nameWithoutLastChar, registerKeyOf, registerKeyOutcomeOf } from '@/pages/create-player/lib/registerKeys'

describe('선수 등록 줄 키 (0x16f28 · 목록 [0x74] 꼴 0)', () => {
  it('이름 줄: 비면 OK · ↓ 무시, CLR 은 팀 고르기로', () => {
    expect(registerKeyOutcomeOf(0, 'ok', 0)).toEqual({ kind: 'none' })
    expect(registerKeyOutcomeOf(0, 'down', 0)).toEqual({ kind: 'none' })
    expect(registerKeyOutcomeOf(0, 'clr', 0)).toEqual({ kind: 'cancel' })
  })

  it('이름 줄: 글자가 있으면 OK · ↓ 는 아래로, CLR 은 한 글자 지움', () => {
    expect(registerKeyOutcomeOf(0, 'ok', 1)).toEqual({ kind: 'move', row: 1 })
    expect(registerKeyOutcomeOf(0, 'down', 1)).toEqual({ kind: 'move', row: 1 })
    expect(registerKeyOutcomeOf(0, 'clr', 1)).toEqual({ kind: 'deleteChar' })
  })

  it('다른 줄: CLR 은 위로, 마지막 줄 OK 는 끝내기, 끝에서는 멈춘다', () => {
    expect(registerKeyOutcomeOf(2, 'clr', 0)).toEqual({ kind: 'move', row: 1 })
    expect(registerKeyOutcomeOf(4, 'ok', 3)).toEqual({ kind: 'finish' })
    expect(registerKeyOutcomeOf(4, 'down', 3)).toEqual({ kind: 'move', row: 4 })
    expect(registerKeyOutcomeOf(0, 'up', 3)).toEqual({ kind: 'move', row: 0 })
  })

  it("'2' · '8' 은 이름 줄에선 글자, 다른 줄에선 ↑ · ↓", () => {
    expect(registerKeyOf('2', true)).toBeNull()
    expect(registerKeyOf('8', false)).toBe('down')
    expect(registerKeyOf('Backspace', true)).toBe('clr')
  })

  it('한 글자 지우기는 한글도 한 글자', () => {
    expect(nameWithoutLastChar('홍길')).toBe('홍')
  })
})
