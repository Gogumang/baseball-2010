// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PostseasonBracket } from '@/pages/season-end/ui/PostseasonBracket'
import { SeasonEndScreen } from '@/pages/season-end/ui/SeasonEndScreen'
import {
  LINE_SEGMENTS, RANK_TAGS, RANK_UNIT, TEAM_CELLS, cellIndexOfRank, rankDigitRightOf,
  rankUnitPositionOf,
} from '@/pages/season-end/lib/bracketLayout'
import { advancePostseason, startPostseason } from '@/entities/league/model/league'
import { TEAMS } from '@/shared/config/original/teams'
import { createCareer } from '@/entities/career/model/playerCareer'

/**
 * 포스트시즌 대진표 (0x853ac — P6 4a-1).
 * 프레임 53 계단 그림 + 선분 프레임 54~57 이고, 이긴 길은 빨강이다.
 */

afterEach(cleanup)

/** 정규시즌 순위 = 팀 0·1·2·3 이 1~4위 */
const 순위 = [0, 1, 2, 3]

const 선분 = (container: HTMLElement, leg: string) =>
  Array.from(container.querySelectorAll<HTMLElement>(`div[data-leg="${leg}"]`))

const 색 = (container: HTMLElement, leg: string) => 선분(container, leg)[0].style.background

describe('대진표 배치', () => {
  it('계단 칸 4개에 1~4위 로고가 박스 + 3 자리에 놓인다', () => {
    const { container } = render(<PostseasonBracket series={startPostseason(순위)} />)

    for (const rank of [1, 2, 3, 4]) {
      const cell = TEAM_CELLS[cellIndexOfRank(rank)]
      const logo = screen.getByAltText(TEAMS[순위[rank - 1]].name)
      expect(logo.style.left).toBe(`${cell.x + 3}px`)
      expect(logo.style.top).toBe(`${cell.y + 3}px`)
    }
    // 1위 칸이 가장 높다 (계단)
    expect(TEAM_CELLS[cellIndexOfRank(1)].y).toBeLessThan(TEAM_CELLS[cellIndexOfRank(4)].y)
    // 로고 4 + 순위 딱지 4줄(숫자 한 글자 + "위") = 4 + 8
    expect(container.querySelectorAll('img[alt]:not([alt=""])').length).toBe(4 + 4)
  })

  it('순위 딱지가 프레임 53 박스 4~7 자리에 놓인다', () => {
    const { container } = render(<PostseasonBracket series={startPostseason(순위)} />)

    for (const rank of [1, 2, 3, 4]) {
      const tag = container.querySelector<HTMLElement>(`div[data-rank="${rank}"]`)!
      expect(tag.style.left).toBe(`${RANK_TAGS[cellIndexOfRank(rank)].x}px`)
      expect(tag.style.top).toBe(`${RANK_TAGS[cellIndexOfRank(rank)].y}px`)
    }
  })

  it('딱지 글은 숫자 그림 + img_text 307 "위" 이고 오른쪽 정렬이다 (0x24)', () => {
    const { container } = render(<PostseasonBracket series={startPostseason(순위)} />)

    const 위들 = Array.from(container.querySelectorAll<HTMLImageElement>('img[alt="위"]'))
    expect(위들.length).toBe(4)
    expect(위들[0].getAttribute('src')).toContain(`img_text/frames/${String(RANK_UNIT.frame).padStart(3, '0')}.png`)

    for (const rank of [1, 2, 3, 4]) {
      const tag = RANK_TAGS[cellIndexOfRank(rank)]
      const 위치 = rankUnitPositionOf(tag)
      // "위" 는 딱지 칸 오른쪽 끝에 붙는다
      expect(위치.x + RANK_UNIT.width).toBe(tag.x + tag.width)
      // 숫자는 그 바로 왼쪽에서 끝난다
      expect(rankDigitRightOf(tag)).toBe(위치.x)
      expect(위들.some((image) => image.style.left === `${위치.x}px` && image.style.top === `${위치.y}px`)).toBe(true)
    }
  })

  it('선분 박스는 프레임 54~57 좌표 그대로다 — 4위 길 첫 박스 (44,162,2,32)', () => {
    const { container } = render(<PostseasonBracket series={startPostseason(순위)} />)
    const [세로, 가로] = 선분(container, 'rank4')

    expect([세로.style.left, 세로.style.top, 세로.style.width, 세로.style.height])
      .toEqual(['44px', '162px', '2px', '32px'])
    expect([가로.style.left, 가로.style.top, 가로.style.width, 가로.style.height])
      .toEqual(['46px', '162px', '25px', '2px'])
  })

  it('1위 길은 결승 꼭짓점 (120,87) 로 올라간다', () => {
    const { container } = render(<PostseasonBracket series={startPostseason(순위)} />)
    const 꼭짓점 = 선분(container, 'champion')[0]

    expect([꼭짓점.style.left, 꼭짓점.style.top, 꼭짓점.style.height]).toEqual(['120px', '87px', '29px'])
    expect(LINE_SEGMENTS.rank1[1].x + LINE_SEGMENTS.rank1[1].width).toBe(196)
  })
})

describe('이긴 길 빨강 (0x855b4~0x857ec)', () => {
  it('아직 한 라운드도 안 끝나면 모든 선분이 #08044A 다', () => {
    const { container } = render(<PostseasonBracket series={startPostseason(순위)} />)

    for (const leg of Object.keys(LINE_SEGMENTS)) {
      expect(색(container, leg)).toBe('rgb(8, 4, 74)')
    }
    expect(container.querySelectorAll('div[data-won="true"]').length).toBe(0)
  })

  it('4위가 준플레이오프를 이기면 4위 길과 합류 선분이 빨강이다', () => {
    // 준PO = 3위(팀 2) vs 4위(팀 3). 4위가 3승
    let series = startPostseason(순위)
    for (let i = 0; i < 3; i += 1) series = advancePostseason(series, 3)
    const { container } = render(<PostseasonBracket series={series} />)

    expect(색(container, 'rank4')).toBe('rgb(255, 0, 0)')
    expect(색(container, 'semiAdvance')).toBe('rgb(255, 0, 0)')
    expect(색(container, 'rank3')).toBe('rgb(8, 4, 74)')
    expect(색(container, 'rank2')).toBe('rgb(8, 4, 74)')
    expect(색(container, 'champion')).toBe('rgb(8, 4, 74)')
  })

  it('3위가 올라오면 3위 길이 빨강이고 4위 길은 파랑이다', () => {
    let series = startPostseason(순위)
    for (let i = 0; i < 3; i += 1) series = advancePostseason(series, 2)
    const { container } = render(<PostseasonBracket series={series} />)

    expect(색(container, 'rank3')).toBe('rgb(255, 0, 0)')
    expect(색(container, 'rank4')).toBe('rgb(8, 4, 74)')
  })

  it('2위가 플레이오프를 이기면 2위 길과 한국시리즈 합류 선분이 빨강이다', () => {
    let series = startPostseason(순위)
    for (let i = 0; i < 3; i += 1) series = advancePostseason(series, 3) // 4위가 준PO 승
    for (let i = 0; i < 3; i += 1) series = advancePostseason(series, 1) // 2위가 PO 승
    const { container } = render(<PostseasonBracket series={series} />)

    expect(색(container, 'rank2')).toBe('rgb(255, 0, 0)')
    expect(색(container, 'finalAdvance')).toBe('rgb(255, 0, 0)')
    expect(색(container, 'semiAdvance')).toBe('rgb(255, 0, 0)')
    // 준PO 승자가 누구였는지는 웹 모델에 안 남아 3·4위 칸 선분은 파랑으로 둔다 (근사)
    expect(색(container, 'rank4')).toBe('rgb(8, 4, 74)')
    expect(색(container, 'rank3')).toBe('rgb(8, 4, 74)')
    expect(색(container, 'champion')).toBe('rgb(8, 4, 74)')
  })

  it('1위가 한국시리즈까지 이기면 1위 길과 꼭짓점이 빨강이다', () => {
    let series = startPostseason(순위)
    for (let i = 0; i < 3; i += 1) series = advancePostseason(series, 3)
    for (let i = 0; i < 3; i += 1) series = advancePostseason(series, 1)
    for (let i = 0; i < 4; i += 1) series = advancePostseason(series, 0) // 1위가 KS 4승
    const { container } = render(<PostseasonBracket series={series} />)

    expect(series.champion).toBe(0)
    expect(색(container, 'rank1')).toBe('rgb(255, 0, 0)')
    expect(색(container, 'champion')).toBe('rgb(255, 0, 0)')
    expect(색(container, 'rank2')).toBe('rgb(255, 0, 0)')
  })

  it('아랫 시드가 우승하면 1위 길은 파랑이고 꼭짓점만 빨강이다', () => {
    let series = startPostseason(순위)
    for (let i = 0; i < 3; i += 1) series = advancePostseason(series, 3) // 4위 준PO 승
    for (let i = 0; i < 3; i += 1) series = advancePostseason(series, 3) // 4위 PO 승
    for (let i = 0; i < 4; i += 1) series = advancePostseason(series, 3) // 4위 우승
    const { container } = render(<PostseasonBracket series={series} />)

    expect(series.champion).toBe(3)
    expect(색(container, 'rank4')).toBe('rgb(255, 0, 0)')
    expect(색(container, 'finalAdvance')).toBe('rgb(255, 0, 0)')
    expect(색(container, 'champion')).toBe('rgb(255, 0, 0)')
    expect(색(container, 'rank1')).toBe('rgb(8, 4, 74)')
    expect(색(container, 'rank2')).toBe('rgb(8, 4, 74)')
  })
})

describe('시즌 끝 화면에 붙었다', () => {
  const 선수 = { ...createCareer('홍길동'), postseason: startPostseason(순위) }

  it('포스트시즌이 있으면 대진표를 먼저 보여 준다', () => {
    const { container } = render(<SeasonEndScreen career={선수} onStartNextSeason={vi.fn()} />)

    expect(container.querySelectorAll('div[data-leg]').length).toBeGreaterThan(0)
  })

  it('오른쪽 위 단추로 시즌 성적 요약으로 넘어가고 다시 돌아온다', () => {
    const { container } = render(<SeasonEndScreen career={선수} onStartNextSeason={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: '시즌 성적 ›' }))
    expect(container.querySelectorAll('div[data-leg]').length).toBe(0)

    fireEvent.click(screen.getByRole('button', { name: '대진표' }))
    expect(container.querySelectorAll('div[data-leg]').length).toBeGreaterThan(0)
  })

  it('포스트시즌 기록이 없으면 예전 성적 요약 그대로다', () => {
    const { container } = render(
      <SeasonEndScreen career={{ ...createCareer('홍길동'), postseason: null }} onStartNextSeason={vi.fn()} />,
    )

    expect(container.querySelectorAll('div[data-leg]').length).toBe(0)
  })
})
