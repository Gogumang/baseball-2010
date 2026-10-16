// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { PostseasonBracketWindow } from '@/widgets/season/ui/PostseasonBracketWindow'
import { PostseasonBracket } from '@/pages/season-end/ui/PostseasonBracket'
import { RANK_TAGS, TEAM_CELLS } from '@/widgets/season/lib/postseasonBracketLayout'
import { advancePostseason, startPostseason } from '@/entities/league/model/league'
import type { PostseasonSeries } from '@/entities/league/model/league'
import { TEAMS } from '@/shared/config/original/teams'

/** 포스트시즌 대진표 0x853ac — 시즌 0xef · 나리 128 이 함께 쓴다 */

afterEach(cleanup)

/** 정규시즌 순위 = 팀 0·1·2·3 이 1~4위 */
const 순위 = [0, 1, 2, 3]

const 이김 = (series: PostseasonSeries, team: number, times: number) => {
  let next = series
  for (let i = 0; i < times; i += 1) next = advancePostseason(next, team)
  return next
}

describe('대진표 그림', () => {
  it('칸 0("4위" 딱지)에 정규 3위, 칸 1("3위")에 4위, 칸 2·3 에 2위·1위 로고 — 0x8533c', () => {
    const { container } = render(<PostseasonBracketWindow series={startPostseason(순위)} />)
    const 칸팀 = [2, 3, 1, 0]
    TEAM_CELLS.forEach((cell, k) => {
      const logo = screen.getByAltText(TEAMS[칸팀[k]].name)
      expect([logo.style.left, logo.style.top, logo.style.width, logo.style.height])
        .toEqual([`${cell.x + 3}px`, `${cell.y + 3}px`, '35px', '34px'])
      const tag = container.querySelector<HTMLElement>(`div[data-cell="${k}"] div[data-rank]`)!
      expect(tag.dataset.rank).toBe(String(4 - k))
      expect(tag.style.left).toBe(`${RANK_TAGS[k].x}px`)
    })
  })

  it('처음엔 선 프레임 54~57 이 모두 #08044A 고 빨강·덮기가 없다', () => {
    const { container } = render(<PostseasonBracketWindow series={startPostseason(순위)} />)
    expect(container.querySelectorAll('div[data-frame]').length).toBe(7 + 7 + 5 + 3)
    expect(container.querySelectorAll('div[data-won="true"]').length).toBe(0)
    expect(container.querySelectorAll('div[data-dark-cell]').length).toBe(0)
  })

  it('진 칸은 프레임 53 박스를 (x, y, w, h + 1) 로 검정 단계 7(9/16) 덮는다', () => {
    const series = 이김(startPostseason(순위), 3, 3) // 4위 준PO 승 → 3위(칸 0) 덮기
    const { container } = render(<PostseasonBracketWindow series={series} />)
    const dark = container.querySelector<HTMLElement>('div[data-dark-cell]')!
    expect(dark.dataset.darkCell).toBe('0')
    expect([dark.style.left, dark.style.top, dark.style.width, dark.style.height]).toEqual(['25px', '195px', '41px', '41px'])
    expect(dark.style.opacity).toBe(String(9 / 16))
  })
})

describe('나리 대진 화면도 같은 위젯이다', () => {
  it('PostseasonBracket 은 위젯 + 다음 누름 칸', () => {
    render(<PostseasonBracket series={startPostseason(순위)} onNext={() => {}} />)
    expect(screen.getByRole('group', { name: '포스트시즌 대진표' })).toBeDefined()
    expect(screen.getByRole('button', { name: '다음' })).toBeDefined()
  })
})
