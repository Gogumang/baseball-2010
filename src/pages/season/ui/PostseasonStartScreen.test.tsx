// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PostseasonStartScreen } from '@/pages/season/ui/PostseasonStartScreen'
import { RANK_TAGS, TEAM_CELLS, cellIndexOfRank } from '@/widgets/season/lib/postseasonBracketLayout'
import { advancePostseason, startPostseason } from '@/entities/league/model/league'
import { TEAMS } from '@/shared/config/original/teams'

/**
 * 포스트시즌 시작 (0xee) — 대진표 0x853ac (P6 4a-1 확정).
 * 프레임 53 계단 칸·순위 딱지 자리와, 이긴 길이 빨강으로 다시 칠해지는지를 못박는다.
 */

afterEach(cleanup)

/** 정규시즌 순위 = 팀 0·1·2·3 이 1~4위 */
const 순위 = [0, 1, 2, 3]

/** jsdom 은 style.background 를 rgb() 로 돌려준다 — #08044A / #FF0000 과 같은 값이다 */
const LINE_RGB = 'rgb(8, 4, 74)'
const WON_RGB = 'rgb(255, 0, 0)'

const 선분색 = (container: HTMLElement, leg: string) =>
  container.querySelector<HTMLElement>(`div[data-leg="${leg}"]`)!.style.background

describe('대진표 배치 (확정값 — 근사가 아니다)', () => {
  it('계단 칸 4개에 1~4위 로고가 박스 + 3 자리에 놓인다', () => {
    render(<PostseasonStartScreen series={startPostseason(순위)} onNext={vi.fn()} />)

    for (const rank of [1, 2, 3, 4]) {
      const cell = TEAM_CELLS[cellIndexOfRank(rank)]
      const logo = screen.getByAltText(TEAMS[순위[rank - 1]].name)
      expect(logo.style.left).toBe(`${cell.x + 3}px`)
      expect(logo.style.top).toBe(`${cell.y + 3}px`)
    }
    // 1위 칸이 가장 높다 (계단)
    expect(TEAM_CELLS[cellIndexOfRank(1)].y).toBeLessThan(TEAM_CELLS[cellIndexOfRank(4)].y)
  })

  it('순위 딱지 "N위" 가 프레임 53 박스 4~7 자리에 놓인다', () => {
    const { container } = render(<PostseasonStartScreen series={startPostseason(순위)} onNext={vi.fn()} />)

    for (const rank of [1, 2, 3, 4]) {
      const tag = container.querySelector<HTMLElement>(`div[data-rank="${rank}"]`)!
      expect(tag.textContent).toBe(`${rank}위`)
      expect(tag.style.left).toBe(`${RANK_TAGS[cellIndexOfRank(rank)].x}px`)
      expect(tag.style.top).toBe(`${RANK_TAGS[cellIndexOfRank(rank)].y}px`)
    }
  })

  it('아직 아무도 안 이겼으면 모든 선분이 #08044A 다', () => {
    const { container } = render(<PostseasonStartScreen series={startPostseason(순위)} onNext={vi.fn()} />)

    for (const leg of ['rank1', 'rank2', 'rank3', 'rank4', 'semiAdvance', 'finalAdvance', 'champion']) {
      expect(선분색(container, leg)).toBe(LINE_RGB)
    }
  })

  it('준플레이오프를 4위가 이기면 4위 길과 합류 선분만 빨강이 된다', () => {
    let series = startPostseason(순위)
    // 5전 3선승 — 4위(팀 3)가 세 번 이긴다
    for (let game = 0; game < 3; game += 1) series = advancePostseason(series, 순위[3])
    const { container } = render(<PostseasonStartScreen series={series} onNext={vi.fn()} />)

    expect(선분색(container, 'rank4')).toBe(WON_RGB)
    expect(선분색(container, 'semiAdvance')).toBe(WON_RGB)
    expect(선분색(container, 'rank3')).toBe(LINE_RGB)
    expect(선분색(container, 'champion')).toBe(LINE_RGB)
  })
})

describe('화면 흐름', () => {
  it('올해의 목표 이벤트 392 를 알리고 타자시상으로 넘어간다', () => {
    const onNext = vi.fn()
    render(<PostseasonStartScreen series={startPostseason(순위)} onNext={onNext} />)

    expect(screen.getByRole('group', { name: '포스트시즌 대진표' })).toBeDefined()
    expect(document.body.textContent).toContain('이벤트 392')

    fireEvent.click(screen.getByRole('button', { name: '다음' }))
    expect(onNext).toHaveBeenCalled()
  })

  it('대진이 아직 없으면 빈 계단만 그린다', () => {
    const { container } = render(<PostseasonStartScreen series={null} onNext={vi.fn()} />)

    expect(container.querySelectorAll('img').length).toBe(0)
    expect(선분색(container, 'champion')).toBe(LINE_RGB)
  })
})
