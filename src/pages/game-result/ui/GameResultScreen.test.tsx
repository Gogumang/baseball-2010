// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GameResultScreen } from '@/pages/game-result/ui/GameResultScreen'
import { createCareer } from '@/entities/career/model/playerCareer'
import { EMPTY_SEASON_STATS } from '@/entities/career/model/seasonStats'
import type { GameSummary } from '@/entities/game/model/gameSummary'
import {
  BAND, PITCHER_LABELS, PITCHER_ROWS, PITCHER_ROW_X, RESULT_SPRITES, TITLE_BAR,
  pitcherRowTopOf,
} from '@/pages/game-result/lib/gameResultLayout'

/**
 * 경기 결과 (정산 0x4a384 + 상태 0x18 결과 판 0x4fe9c — F-7 · R10 5절).
 * y40 반투명 띠 위에 game_ui 프레임 8 막대와 YOU WIN/LOSE 가 놓이고,
 * 아래에 승리투수·패전투수·세이브 세 줄(img_text 388·389·329)이 온다.
 */

afterEach(cleanup)

const 요약 = (overrides: Partial<GameSummary> = {}): GameSummary => ({
  result: '승',
  ourScore: 5,
  opponentScore: 3,
  stats: EMPTY_SEASON_STATS,
  popularityPoints: 0,
  doublePlays: 0,
  scoringPositionOuts: 0,
  reputationCounts: {
    grandSlams: 0, walkOffs: 0, buntHits: 0, walks: 0, goAheadRuns: 0, tyingRuns: 0,
  },
  ourTeamId: 0,
  opponentTeamId: 1,
  recordIds: [],
  ...overrides,
})

const 띄우기 = (summary: GameSummary = 요약(), onContinue = vi.fn()) =>
  render(
    <GameResultScreen
      summary={summary}
      gamePointReward={120}
      newTitles={[]}
      evaluation={{ popularityChange: 1, reputationChange: 0, moraleChange: 2, commentIndex: 0 }}
      streakNotices={[]}
      career={createCareer('선수')}
      onContinue={onContinue}
    />,
  )

const 그림찾기 = (container: HTMLElement, file: string) =>
  container.querySelector(`img[src$="${file}"]`) as HTMLElement | null

describe('경기 결과 원본 배치', () => {
  it('띠는 (0,40) 240×30 이다', () => {
    const { container } = 띄우기()
    const band = container.querySelector(`div[style*="height: ${BAND.height}px"]`) as HTMLElement

    expect(band.style.top).toBe(`${BAND.y}px`)
    expect(band.style.width).toBe(`${BAND.width}px`)
  })

  it('game_ui 프레임 8 막대를 (34, 35) 에 둔다', () => {
    const { container } = 띄우기()
    const bar = 그림찾기(container, `game_ui/frames/${String(TITLE_BAR.frame).padStart(3, '0')}.png`)

    expect(bar?.style.left).toBe(`${TITLE_BAR.x}px`)
    expect(bar?.style.top).toBe(`${TITLE_BAR.y}px`)
  })

  it('이기면 YOU WIN 그림을 (43, 33) 에 두고 화면을 안 어둡게 한다', () => {
    const { container } = 띄우기()
    const win = screen.getByAltText('YOU WIN')

    expect(win.style.left).toBe(`${RESULT_SPRITES.승.x}px`)
    expect(win.style.top).toBe(`${RESULT_SPRITES.승.y}px`)
    expect(그림찾기(container, 'result/frames/001.png')).toBeNull()
  })

  it('지면 YOU LOSE 그림이고 무승부도 같은 프레임을 쓴다 (전용 그림 없음)', () => {
    띄우기(요약({ result: '패' }))
    expect(screen.getByAltText('YOU LOSE').style.left).toBe(`${RESULT_SPRITES.패.x}px`)

    cleanup()
    띄우기(요약({ result: '무' }))
    expect(screen.getByAltText('YOU LOSE')).toBeTruthy()
  })
})

describe('승·패·세이브 투수 3줄', () => {
  it('세 줄 딱지를 순서대로 보여 준다 — 승리투수·패전투수·세이브', () => {
    띄우기()

    for (const label of PITCHER_LABELS) {
      expect(screen.getByAltText(label.name)).toBeTruthy()
    }
  })

  it('줄은 y = H/2 + 33 부터 16px 간격이다', () => {
    const { container } = 띄우기()
    const plates = container.querySelectorAll(
      `img[src$="game_ui/frames/${String(PITCHER_ROWS.labelPlate.frame).padStart(3, '0')}.png"]`,
    )

    expect(plates.length).toBe(PITCHER_ROWS.count)
    plates.forEach((plate, row) => {
      expect((plate as HTMLElement).style.top).toBe(`${pitcherRowTopOf(row)}px`)
      expect((plate as HTMLElement).style.left).toBe(`${PITCHER_ROW_X}px`)
    })
  })

  it('투수 이름은 아직 비어 있다 — 웹에 마운드 투수 기록이 없다', () => {
    띄우기()

    // 이름 칸은 딱지 칸 바로 오른쪽이다
    const nameBoxLeft = PITCHER_ROW_X + PITCHER_ROWS.labelPlate.width
    for (const label of PITCHER_LABELS) {
      const plate = screen.getByAltText(label.name).parentElement as HTMLElement
      const nameBox = plate.querySelector(`div[style*="left: ${nameBoxLeft}px"]`) as HTMLElement
      expect(nameBox.textContent).toBe('')
    }
  })
})

describe('보상·기록 줄', () => {
  it('기록이 없으면 "기록이 없습니다!" 로 둔다', () => {
    띄우기()
    expect(screen.getByText('기록이 없습니다!')).toBeTruthy()
  })

  it('이겼을 때만 승리 추가 보상을 보여 준다', () => {
    띄우기()
    expect(screen.getByText(/승리 추가 보상/)).toBeTruthy()

    cleanup()
    띄우기(요약({ result: '패' }))
    expect(screen.queryByText(/승리 추가 보상/)).toBeNull()
  })
})

describe('웹 전용 단추', () => {
  it('[확인] 을 누르면 다음으로 넘긴다', () => {
    const onContinue = vi.fn()
    띄우기(요약(), onContinue)

    fireEvent.click(screen.getByRole('button', { name: '확인' }))

    expect(onContinue).toHaveBeenCalledOnce()
  })

  it('[자세히] 는 감독 평가·오늘의 성적 칸을 연다', () => {
    띄우기()

    fireEvent.click(screen.getByRole('button', { name: '자세히' }))

    expect(screen.getByText('감독 평가')).toBeTruthy()
    expect(screen.getByText('오늘의 성적')).toBeTruthy()
  })
})
