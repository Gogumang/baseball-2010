// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { YearGoalWindow } from '@/pages/story/ui/YearGoalWindow'
import { SEASON_YEAR_GOAL_LABEL_SET } from '@/pages/story/lib/yearGoalWindow'

afterEach(cleanup)

const filterOf = (frame: number) =>
  (screen.getByTestId('올해의-목표-창').querySelector(`img[data-frame="${frame}"]`) as HTMLImageElement).style.filter

describe('올해의 목표 창 img_text 팔레트', () => {
  it('제목 358 은 팔레트 3, 시즌 이름표 47 "순위" 는 팔레트 0(0x8664a) — 팔레트 3 으로 구운 그림을 흰 글자로 되돌린다', () => {
    render(
      <YearGoalWindow
        values={{ labelSet: SEASON_YEAR_GOAL_LABEL_SET, current: [1, 50, 280, 350, 3], goals: [4, 50, 270, 400, 5] }}
        onClose={() => {}}
      />,
    )
    expect(filterOf(358)).toMatch(/^url\(#img-text-palette-.*-0-3\)$/)
    expect(filterOf(47)).toMatch(/^url\(#img-text-palette-.*-3-0\)$/)
    // 흰 글자로 구운 이름표는 그대로
    expect(filterOf(330)).toBe('')
  })
})
