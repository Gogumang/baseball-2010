import { describe, expect, it } from 'vitest'
import { drawCallWithRedraws, redrawsBetween, redrawsUpTo, withRedrawAt } from '@/widgets/batting-stage/lib/stageRedraws'

describe('창이 선 첫 그림([창+0x250])의 그리기 쪽 애니 셈 — 52efe 가 갱신 없이 그리기 표를 한 번 더 돈다', () => {
  it('그 애니가 처음 그려진 틱 뒤에 든 창 첫 그림만 더한다', () => {
    // 틱 10 에 처음 그린 애니 — 틱 14 그림은 다섯째, 틱 12 뒤 창 첫 그림이 한 칸 더 넘겼다
    expect(drawCallWithRedraws(5, 14, [12])).toBe(6)
    // 처음 그리기 전(틱 8)의 창 첫 그림은 안 센다
    expect(drawCallWithRedraws(5, 14, [8])).toBe(5)
    // 창 첫 그림 자신(목록에 든 채 같은 틱으로 그린다)
    expect(drawCallWithRedraws(5, 14, [14])).toBe(6)
    // 아직 안 그린 애니는 그대로
    expect(drawCallWithRedraws(0, 14, [12])).toBe(0)
  })

  it('장면 내내 도는 애니는 그 틱까지 든 수를 더한다 · 목록은 새로 만든다', () => {
    expect(redrawsUpTo([3, 9, 20], 9)).toBe(2)
    expect(redrawsBetween(undefined, 0, 10)).toBe(0)
    const before: readonly number[] = [3]
    const after = withRedrawAt(before, 7)
    expect(after).toEqual([3, 7])
    expect(before).toEqual([3])
  })
})
