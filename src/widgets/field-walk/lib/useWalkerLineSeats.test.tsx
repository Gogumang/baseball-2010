// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { type WalkerLineSeatsEvents, useWalkerLineSeats } from '@/widgets/field-walk/lib/useWalkerLineSeats'

const recordsWith = (aceAt: number | null) => [2, 3, 4, 5, 6, 7, 8, 9, 1].map((position, index) => ({ position, ace: index === aceAt ? 2 : null }))

describe('useWalkerLineSeats — 장면 두 줄 +0xec', () => {
  it('벤치 클리어링 수비 줄은 마지막 수비 판 시작(그 판 앞 그림의 수비 팀)이 적은 값이다 — 그 뒤 수비 팀 니블이 바뀌어도 남는다', () => {
    const base: WalkerLineSeatsEvents = {
      sceneKey: 1,
      playKey: null,
      playDefenseRecords: recordsWith(null),
      board: null,
      benchClearing: null,
    }
    const { result, rerender } = renderHook((events: WalkerLineSeatsEvents) => useWalkerLineSeats(events), { initialProps: base })
    // 판이 하나 돈다 — 앞 그림의 수비 팀(마선수 없음)으로 훑는다
    rerender({ ...base, playKey: 'play-1', playDefenseRecords: recordsWith(0) })
    // 그 뒤 수비 팀 레코드에 마타자가 들어왔다(대타) — 판이 없으면 수비 줄은 안 바뀐다
    rerender({ ...base, playKey: 'play-1', playDefenseRecords: recordsWith(0) })
    rerender({ ...base, playKey: 'play-1', playDefenseRecords: recordsWith(0), benchClearing: { key: 'bc', offense: null } })
    expect(result.current.benchDefense[1]).toEqual({ ace: null })
    expect(result.current.benchDefense[0]).toBeNull()
  })

  it('판이 없던 장면의 벤치 클리어링 수비 줄은 모두 0 — 교대 판은 앞 값을 판 앞 값으로 넘긴다', () => {
    const base: WalkerLineSeatsEvents = {
      sceneKey: 2,
      playKey: null,
      playDefenseRecords: null,
      board: null,
      benchClearing: null,
    }
    const { result, rerender } = renderHook((events: WalkerLineSeatsEvents) => useWalkerLineSeats(events), { initialProps: base })
    rerender({ ...base, board: { key: 1, defense: recordsWith(3), offense: recordsWith(null) } })
    expect(result.current.boardBefore.defense.every((seat) => seat === null)).toBe(true)
    rerender({ ...base, board: { key: 2, defense: recordsWith(null), offense: recordsWith(null) } })
    expect(result.current.boardBefore.defense[4]).toEqual({ ace: 2 })
    rerender({
      ...base,
      sceneKey: 3,
      board: { key: 2, defense: recordsWith(null), offense: recordsWith(null) },
      benchClearing: { key: 'x', offense: null },
    })
    expect(result.current.benchDefense.every((seat) => seat === null)).toBe(false)
  })
})
