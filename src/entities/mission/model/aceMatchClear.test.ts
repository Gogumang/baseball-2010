import { describe, expect, it } from 'vitest'
import { aceMatchMissionOf } from '@/entities/story/model/aceMatch'
import { aceMatchClearCountAfterWin, aceMatchClearKeyOf } from '@/entities/mission/model/aceMatchClear'

describe('마선수 대결의 클리어 칸 — 0xa5368(obj, 1), +0xbd = team − 1', () => {
  it('team 16(레코드 15)만 칸을 올린다 — 17~20 은 idx > 15 라 건너뛴다', () => {
    const medica = aceMatchMissionOf(16, '투수')
    const tiger = aceMatchMissionOf(17, '투수')
    const siker = aceMatchMissionOf(16, '타자')
    if (medica === null || tiger === null || siker === null) throw new Error('대결 레코드가 없다')
    expect(aceMatchClearKeyOf(medica)).toBe('투수:16')
    expect(aceMatchClearKeyOf(siker)).toBe('타자:16')
    expect(aceMatchClearKeyOf(tiger)).toBeNull()
  })

  it('새 저장의 −1(memset 0xff)에서 세어 첫 승리는 0, 99 에서 멈춘다', () => {
    expect(aceMatchClearCountAfterWin(undefined)).toBe(0)
    expect(aceMatchClearCountAfterWin(0)).toBe(1)
    expect(aceMatchClearCountAfterWin(99)).toBe(99)
  })
})
