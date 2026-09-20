import { describe, expect, it } from 'vitest'
import {
  pickoffCoverFielderOf,
  pickoffPlayOf,
  PICKOFF_PLAY_KIND,
  RUNNER_LEAD_DISTANCE,
} from '@/entities/defense-controls/model/pickoff'

describe('견제 — 원본 0x50f28 · 0xb28be', () => {
  it('루 커버 야수는 "루 번호 + 1" 고정이다 (0루 포수 · 1루 1루수 · 2루 2루수 · 3루 3루수)', () => {
    const 표: ReadonlyArray<readonly [0 | 1 | 2 | 3, number]> = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
    ]
    표.forEach(([base, slot]) => {
      expect(pickoffCoverFielderOf(base), `${base}루`).toBe(slot)
    })
  })

  it('2루 견제도 늘 2루수(칸 3)가 받는다 — 유격수/2루수 고르기가 없다', () => {
    expect(pickoffCoverFielderOf(2)).toBe(3)
  })

  it('그 루에 주자가 있을 때만 플레이 종류 4 로 들어간다', () => {
    expect(pickoffPlayOf({ base: 1, hasRunner: true })).toEqual({
      playKind: PICKOFF_PLAY_KIND,
      targetBase: 1,
      coverFielderSlot: 2,
      nextGameState: 0x17,
    })
    expect(pickoffPlayOf({ base: 1, hasRunner: false })).toBeNull()
  })

  it('주자 리드 폭이라는 값이 원본에 없다 — 주자는 루 좌표에 정확히 선다', () => {
    expect(RUNNER_LEAD_DISTANCE).toBe(0)
  })
})
