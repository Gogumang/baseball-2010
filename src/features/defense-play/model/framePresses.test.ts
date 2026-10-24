import { describe, expect, it } from 'vitest'
import { framePressesOf } from '@/features/defense-play/model/runDefensePlay'

describe('한 틀의 키 — 0x498d4 는 누름 [+0x40] → 되풀이 [+0x50] 차례로 조작 객체에 보낸다(49a3a · 49a56)', () => {
  it('키가 없으면 비고, 하나면 그 하나', () => {
    expect(framePressesOf(null)).toEqual([])
    expect(framePressesOf({ key: '2' })).toEqual([{ key: '2' }])
  })

  it('앞 키를 누른 채 새 키를 누른 틀은 누름 먼저 · 되풀이 나중 둘 다', () => {
    const repeated = { key: '6', isRepeat: true }
    expect(framePressesOf({ key: '2', thenRepeat: repeated })).toEqual([{ key: '2', thenRepeat: repeated }, repeated])
  })
})
