import { describe, expect, it } from 'vitest'
import { scoreboardScrollX } from '@/widgets/batting-stage/lib/renderScenery'

// 전광판 흐르는 글자 (0x77fb4, R2-game-effects.md 6절): 상자 폭+2 에서 시작해 틱당 1px 씩
// 왼쪽으로 흐르고, −153 밑으로 완전히 빠지면 시작값으로 되감는다.
describe('scoreboardScrollX — 전광판 글자 x 이동', () => {
  const boxWidth = 48

  it('틱 0 은 시작값(상자 폭 + 2) 이다', () => {
    expect(scoreboardScrollX(boxWidth, 0)).toBe(boxWidth + 2)
  })

  it('틱마다 1px 씩 왼쪽(음의 방향)으로 흐른다', () => {
    expect(scoreboardScrollX(boxWidth, 1)).toBe(boxWidth + 1)
    expect(scoreboardScrollX(boxWidth, 10)).toBe(boxWidth + 2 - 10)
  })

  it('−153 을 넘어가기 직전까지는 되감지 않는다', () => {
    const start = boxWidth + 2
    const ticksToThreshold = start - -153 // start 에서 -153 까지 걸리는 틱 수
    expect(scoreboardScrollX(boxWidth, ticksToThreshold)).toBe(-153)
  })

  it('−153 밑으로 빠지면 시작값으로 되감는다', () => {
    const start = boxWidth + 2
    const ticksToThreshold = start - -153
    expect(scoreboardScrollX(boxWidth, ticksToThreshold + 1)).toBe(start)
  })

  it('음수 틱은 0 취급한다', () => {
    expect(scoreboardScrollX(boxWidth, -5)).toBe(boxWidth + 2)
  })
})
