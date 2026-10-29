// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useNariMainCursor } from '@/app/model/useNariMainCursor'
import { nariMainCursorOnEntry } from '@/pages/management/model/nariMainMenuCursor'
import { createSeededRandom } from '@/shared/api/random/seededRandom'

type Input = Parameters<typeof useNariMainCursor>[0]

/** 옛 꼴(CareerRoutes 의 그리는 중 entryTrail · mainCursor 고침)을 그대로 옮긴 셈 — 그림마다 커서 값. `moves[i]` 는 그 그림 전에 자식이 키로 옮긴 칸 */
function oldCursorTrail(inputs: readonly Input[], moves: readonly (number | null)[]): number[] {
  let entryTrail: string | null = null
  let cursor = 0
  return inputs.map((input, index) => {
    cursor = moves[index] ?? cursor
    if (input.entryKey !== entryTrail) {
      const isFromManagementFrame = input.isEventScreen && entryTrail === '관리'
      if (input.entryKey !== null && !isFromManagementFrame) {
        const isFromStandings = entryTrail === null && input.previous === '다음경기순위'
        const isSubMenuReturn = entryTrail === null && input.previous === input.subMenuScreen
        if (!isSubMenuReturn) cursor = nariMainCursorOnEntry(cursor, input.hasActedThisCycle, isFromStandings)
      }
      entryTrail = input.entryKey
    }
    return cursor
  })
}

describe('관리 메뉴 커서 105 진입 규칙 0x11910', () => {
  it('아무 차례로 화면이 바뀌어도 옛 그리는 중 고침과 같은 커서 — 자식이 키로 고친 값도 이어간다', () => {
    const random = createSeededRandom(368)
    const keys = [null, '관리', '이벤트:3', '이벤트:7']
    const previous = [null, '다음경기순위', '아이템', '이벤트', '관리']
    const inputs: Input[] = Array.from({ length: 400 }, () => ({
      entryKey: keys[random.rand(0, keys.length - 1)],
      isEventScreen: random.rand(0, 1) === 1,
      previous: previous[random.rand(0, previous.length - 1)],
      subMenuScreen: '아이템',
      hasActedThisCycle: random.rand(0, 1) === 1,
    }))
    const moves = inputs.map((_, index) => (index > 0 && random.rand(0, 3) === 0 ? random.rand(1, 5) : null))
    const { result, rerender } = renderHook(({ input }) => useNariMainCursor(input), { initialProps: { input: inputs[0] } })
    const actual = [result.current.current]
    for (const [index, input] of inputs.entries()) {
      if (index === 0) continue
      const move = moves[index]
      if (move !== null) result.current.current = move
      rerender({ input })
      actual.push(result.current.current)
    }
    expect(actual).toEqual(oldCursorTrail(inputs, moves))
    expect(new Set(actual).size).toBeGreaterThan(1)
  })
})
