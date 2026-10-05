import { describe, expect, it } from 'vitest'
import { countsAsAtBat, isFreePass, isHit } from '@/entities/at-bat/model/atBatOutcome'

describe('사구 — 볼넷과 같이 셈하는 칸들', () => {
  it('타수에 안 든다 (타수++ 0xa8894 는 안타·아웃 갈래뿐)', () => {
    expect(countsAsAtBat({ kind: '사구' })).toBe(false)
    expect(countsAsAtBat({ kind: '볼넷' })).toBe(false)
    expect(countsAsAtBat({ kind: '삼진' })).toBe(true)
  })

  it('출루 허용 state[0x88]·투수 +0x2a 쪽 — 볼넷·사구만 무료 출루다', () => {
    expect(isFreePass({ kind: '사구' })).toBe(true)
    expect(isFreePass({ kind: '볼넷' })).toBe(true)
    expect(isFreePass({ kind: '안타', bases: 1 })).toBe(false)
    expect(isHit({ kind: '사구' })).toBe(false)
  })
})
