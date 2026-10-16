import { describe, expect, it } from 'vitest'
import {
  BURST_WINDOW_START, burstBandTopOf, burstNextMarkAt, burstPortraitAnchorOf, burstPortraitOf, burstResultPopupTextOf,
  burstShakeOffsetOf, burstSpeakerPrefixOf, burstTextBoxOf, isBurstWindowOpen, tickBurstWindow,
} from '@/widgets/burst-mission/lib/burstMissionWindowLayout'
import type { BurstWindowState } from '@/widgets/burst-mission/lib/burstMissionWindowLayout'
import { 행 } from '@/entities/burst-mission/model/burstMissionTestRows'

const 갱신 = (n: number): BurstWindowState[] => {
  const states: BurstWindowState[] = []
  let state = BURST_WINDOW_START
  for (let i = 0; i < n; i += 1) {
    state = tickBurstWindow(state)
    states.push(state)
  }
  return states
}

describe('갱신 0x8e5b8 — 판 높이 · 흔들기 카운터', () => {
  it('h = min(55, 2h + 2) 로 오르고, 다 오른 뒤 c 가 1 · 2 · 3 을 지나 −1 이 된다', () => {
    const states = 갱신(10)
    expect(states.map((s) => s.height)).toEqual([2, 6, 14, 30, 55, 55, 55, 55, 55, 55])
    expect(states.map((s) => s.shake)).toEqual([0, 0, 0, 0, 0, 1, 2, 3, -1, -1])
    expect(states.map(isBurstWindowOpen)).toEqual([false, false, false, false, false, false, false, false, true, true])
  })

  it('흔들기 0xba888(0, ±1) — c 홀수 +1 · 짝수 −1, c ≤ 0 이면 없다', () => {
    const states = 갱신(9)
    expect(states.map(burstShakeOffsetOf)).toEqual([
      null, null, null, null, null, { x: 0, y: 1 }, { x: 0, y: -1 }, { x: 0, y: 1 }, null,
    ])
  })
})

describe('그리기 자리 (0x8f29c · 0x8f194 · 0x8ea18)', () => {
  it('다 오른 판: 윗 띠 y = 253 · 글 (5, 268) 폭 215', () => {
    expect(burstBandTopOf(55)).toBe(253)
    expect(burstTextBoxOf(55)).toEqual({ x: 5, y: 268, width: 215 })
  })

  it('초상은 좌타면 (35, H − h − 13) 뒤집기, 우타면 (200, …)', () => {
    expect(burstPortraitAnchorOf(55, true)).toEqual({ x: 35, y: 252, isFlipped: true })
    expect(burstPortraitAnchorOf(55, false)).toEqual({ x: 200, y: 252, isFlipped: false })
  })

  it('넘김 표시는 t % 8 ≤ 3 이면 H − 8, 아니면 H − 10', () => {
    expect([0, 3, 4, 7, 8].map((t) => burstNextMarkAt(t).y)).toEqual([312, 312, 310, 310, 312])
  })

  it('초상 0x63a04 — 10~13 event_char_1 · 17~22 event_char_2 · 애니 = 0xd0ae6[화자] + 표정', () => {
    expect(burstPortraitOf(2, 6)).toEqual({ file: 'event_char_0', animation: 22 })
    expect(burstPortraitOf(11, 7)).toEqual({ file: 'event_char_1', animation: 14 })
    expect(burstPortraitOf(22, 0)).toEqual({ file: 'event_char_2', animation: 32 })
  })

  it('이름 머리 — "[" 초록 이름 "] : "', () => {
    expect(burstSpeakerPrefixOf(10)).toBe('!cFFFFFF[!c00CC00메디카!cFFFFFF] : ')
  })
})

describe('결과 공용 창 글 (0x8e5b8 키 갈래)', () => {
  it('성공 — 보상 칸이 둘 다 비어도 머리는 띄운다', () => {
    expect(burstResultPopupTextOf('성공', 행())).toBe('!C!cffffff[!cffff00돌발미션 성공!!!cffffff]!N')
  })

  it('실패 — b15 = 0 이면 창이 없고, 있으면 주황 머리 + " -" 값(소지금도 ×100 없음)', () => {
    expect(burstResultPopupTextOf('실패', 행({ failurePenalty: { kind: 3, amount: 0 } }))).toBeNull()
    expect(burstResultPopupTextOf('실패', 행({ failurePenalty: { kind: 4, amount: 7 } }))).toBe(
      '!C!cffffff[!cff5500돌발미션 실패!!!cffffff]!N!C!cffffff소지금 -7',
    )
  })

  it('무효 · 제안은 창이 없다', () => {
    expect(burstResultPopupTextOf('무효', 행())).toBeNull()
    expect(burstResultPopupTextOf(null, 행())).toBeNull()
  })
})
