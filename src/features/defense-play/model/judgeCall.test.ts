import { describe, expect, it } from 'vitest'
import { judgeCallSoundIdOf, replayCallsOnScreen } from '@/features/defense-play/model/judgeCall'
import { runnerPlayCallSoundIdOf } from '@/features/defense-play/model/runnerPlayEngine'

const 보통 = { caughtOnTheFly: false, tagOut: false }

describe('결과 메시지 0xbba 의 판정 콜 — 표 0xd0488', () => {
  it('6 · 10(안타) 은 소리가 없다 · 7 → 25 · 8/12 → 11 · 11 → 62 (조건 없음)', () => {
    expect(judgeCallSoundIdOf(6, 보통)).toBeNull()
    expect(judgeCallSoundIdOf(10, 보통)).toBeNull()
    expect(judgeCallSoundIdOf(7, 보통)).toBe(25)
    expect(judgeCallSoundIdOf(8, 보통)).toBe(11)
    expect(judgeCallSoundIdOf(12, 보통)).toBe(11)
    expect(judgeCallSoundIdOf(11, 보통)).toBe(62)
  })

  it('13 은 state[0x1f] · state[0x87] 중 하나면 62, 둘 다 아니면 20 (0x51b36)', () => {
    expect(judgeCallSoundIdOf(13, 보통)).toBe(20)
    expect(judgeCallSoundIdOf(13, { caughtOnTheFly: true, tagOut: false })).toBe(62)
    expect(judgeCallSoundIdOf(13, { caughtOnTheFly: false, tagOut: true })).toBe(62)
  })

  it('9 는 판 종류와 상관없이 17 — 종류 4 · 5 는 곧장, 그 밖은 소리 객체 +5(PHONEMODEL 조회 뒤 늘 1)가 서 있어서 (0x51c14)', () => {
    expect(judgeCallSoundIdOf(9, 보통)).toBe(17)
    // 주자 판(도루 · 폭투 · 견제)도 같은 표다
    expect(runnerPlayCallSoundIdOf(9, false)).toBe(17)
    expect(runnerPlayCallSoundIdOf(13, true)).toBe(62)
    expect(runnerPlayCallSoundIdOf(13, false)).toBe(20)
  })
})

describe('미리 돌린 판의 콜을 재생 화면이 내는가 (`replayCallsOnScreen`)', () => {
  const 판 = { ticks: [1, 2] }
  const 빈판 = { ticks: [] }
  it('이번 걸음에 재생 칸에 새로 들어가고 그릴 틱이 있으면 화면이 낸다', () => {
    expect(replayCallsOnScreen(null, 판, 판)).toBe(true)
  })
  it('재생 칸이 안 바뀌었거나 다른 판이거나 그릴 틱이 없으면 판을 연 자리가 낸다', () => {
    expect(replayCallsOnScreen(판, 판, 판)).toBe(false)
    expect(replayCallsOnScreen(null, { ticks: [1] }, 판)).toBe(false)
    expect(replayCallsOnScreen(null, 빈판, 빈판)).toBe(false)
    expect(replayCallsOnScreen(null, 판, null)).toBe(false)
  })
})
