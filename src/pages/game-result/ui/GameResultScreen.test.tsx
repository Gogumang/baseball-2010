// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { ORIGINAL_USER_EVENTS } from '@/shared/config/original/userEvents'
import { GameResultScreen } from '@/pages/game-result/ui/GameResultScreen'
import { createCareer } from '@/entities/career/model/playerCareer'
import { EMPTY_SEASON_STATS } from '@/entities/career/model/seasonStats'
import type { GameSummary } from '@/entities/game/model/gameSummary'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
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
  it('정산 0x4ea0c 를 지나 왔으면 배경 · 효과 층을 원본 0x4a384 차례로 — 배경 → 덮개 → 비 층 → 띠 … → 파티클 층(맨 위)', () => {
    const random = createSeededRandom(1)
    const next = vi.spyOn(random, 'next')
    const { container } = render(
      <GameResultScreen summary={요약({ result: '패', ourScore: 1, opponentScore: 4 })} gamePointReward={0} newTitles={[]}
        career={createCareer('선수')} onContinue={vi.fn()} settlement={{ inning: 9, random }} />,
    )
    const stage = container.firstElementChild?.firstElementChild as HTMLElement
    const layers = Array.from(stage.children)
    const canvases = layers.filter((element) => element.tagName === 'CANVAS')
    // 배경 캔버스는 첫 칸(감싼 div) 안 · 비 층은 덮개 바로 뒤 · 파티클 층은 맨 끝
    expect(layers[0]?.querySelector('canvas')).not.toBeNull()
    expect(layers[2]).toBe(canvases[0])
    expect(layers[layers.length - 1]).toBe(canvases[1])
    // jsdom 은 캔버스 그리기가 없어 rAF 효과 틱이 안 돈다 — 그려지기 전에는 경기 난수를 안 쓴다
    expect(next).not.toHaveBeenCalled()
  })

  it('이어하기로 다시 띄운 116 앞 판(정산 재료 없음)은 배경 · 효과 없이 판만', () => {
    const { container } = 띄우기()
    expect(container.querySelector('canvas')).toBeNull()
  })

  it('밑그림(116 평가 대화의 상태판)은 결과 판이 아니라 [확인] 뒤 평가 단계에 깐다', () => {
    render(
      <GameResultScreen summary={요약()} gamePointReward={0} newTitles={[]} career={createCareer('선수')} onContinue={vi.fn()}
        evaluation={{ popularityChange: 1, reputationChange: 0, moraleChange: 2, commentIndex: 40 }}
        underlay={<div data-testid="밑그림" />} />,
    )
    expect(screen.queryByTestId('밑그림')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(screen.getByTestId('밑그림')).toBeTruthy()
  })

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

  it('이름을 안 넘기면 세 칸이 비어 있다 — 타자편에 마운드 투수 기록이 없다', () => {
    띄우기()

    // 이름 칸은 딱지 칸 바로 오른쪽이다
    const nameBoxLeft = PITCHER_ROW_X + PITCHER_ROWS.labelPlate.width
    for (const label of PITCHER_LABELS) {
      const plate = screen.getByAltText(label.name).parentElement as HTMLElement
      const nameBox = plate.querySelector(`div[style*="left: ${nameBoxLeft}px"]`) as HTMLElement
      expect(nameBox.textContent).toBe('')
    }
  })

  it('이름을 넘기면 승·패·세 차례로 채운다 (state+0x44 · +0x50 · +0x5c)', () => {
    const nameBoxLeft = PITCHER_ROW_X + PITCHER_ROWS.labelPlate.width
    render(
      <GameResultScreen
        summary={요약()}
        pitcherNames={{ win: '김승리', loss: '박패전', save: null }}
        gamePointReward={0}
        newTitles={[]}
        evaluation={{ popularityChange: 0, reputationChange: 0, moraleChange: 0, commentIndex: 0 }}
        streakNotices={[]}
        career={createCareer('선수')}
        onContinue={vi.fn()}
      />,
    )

    const 이름 = (labelName: string) => {
      const plate = screen.getByAltText(labelName).parentElement as HTMLElement
      return (plate.querySelector(`div[style*="left: ${nameBoxLeft}px"]`) as HTMLElement).textContent
    }
    expect(이름('승리투수')).toBe('김승리')
    expect(이름('패전투수')).toBe('박패전')
    // 세이브는 "없음"(측 2) 이라 빈 칸이다
    expect(이름('세이브')).toBe('')
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
  it('[확인] 은 116 평가 이벤트를 튼다 — 대사 → 변화 창(system sub 2 · 0x86c90, 글 [75] 아님) → 114 끝에 다음으로', () => {
    vi.useFakeTimers()
    const onContinue = vi.fn()
    render(
      <GameResultScreen summary={요약()} gamePointReward={0} newTitles={[]}
        evaluation={{ popularityChange: 1, reputationChange: 0, moraleChange: 2, commentIndex: 40 }}
        recordLine={{ atBats: 4, hits: 2, runsBattedIn: 3, homeRuns: 1 }}
        career={createCareer('선수')} onContinue={onContinue} />,
    )
    const 다찍기 = () => act(() => {
      vi.advanceTimersByTime(200 * millisecondsPerFrame())
    })
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(onContinue).not.toHaveBeenCalled()
    다찍기()
    // 0x8bab8 — 기록 줄(…홈런!N) 뒤 감독 글, 첫 줄은 기록 줄 하나
    const 줄 = [...screen.getByTestId('대사-상자').querySelectorAll('[data-part="글줄"]')].map((line) => line.textContent)
    expect(줄[0]).toBe('4타수 2안타 3타점 1홈런')
    expect(screen.getByTestId('대사-상자').getAttribute('data-text')).toContain((ORIGINAL_USER_EVENTS[40] ?? '').replace(/!c[0-9A-Fa-f]{6}|!N/g, '').slice(0, 4))
    for (let page = 0; page < 5 && screen.queryByRole('dialog', { name: '경기 평가 변화' }) === null; page += 1) {
      fireEvent.keyDown(window, { key: 'Enter' })
      다찍기()
    }
    const 창 = screen.getByRole('dialog', { name: '경기 평가 변화' })
    const 글 = [...창.querySelectorAll('img[data-frame]')].map((img) => Number(img.getAttribute('data-frame')))
    expect(글.slice(0, 4)).toEqual([359, 84, 327, 331])
    expect(screen.queryByRole('dialog', { name: '알림' })).toBeNull()
    fireEvent.keyDown(window, { key: '5' })
    // 연속 기록 알림이 없으면 명령 3 이 없다 — 114 끝
    expect(onContinue).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it('연속 기록이 있으면 변화 창 뒤 명령 3 say — 같은 상자에 " / " 로 이은 줄을 찍는다', () => {
    vi.useFakeTimers()
    const onContinue = vi.fn()
    render(
      <GameResultScreen summary={요약()} gamePointReward={0} newTitles={[]}
        evaluation={{ popularityChange: 1, reputationChange: 0, moraleChange: 2, commentIndex: 40 }}
        streakNotices={[
          { labelIndex: 100, count: 5, commentIndex: 108, reputationChange: 10 },
          { labelIndex: 101, count: 5, commentIndex: 108, reputationChange: 10 },
        ]}
        career={createCareer('선수')} onContinue={onContinue} />,
    )
    const 다찍기 = () => act(() => {
      vi.advanceTimersByTime(200 * millisecondsPerFrame())
    })
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    for (let page = 0; page < 5 && screen.queryByRole('dialog', { name: '경기 평가 변화' }) === null; page += 1) {
      다찍기()
      fireEvent.keyDown(window, { key: 'Enter' })
    }
    fireEvent.keyDown(window, { key: '5' })
    expect(onContinue).not.toHaveBeenCalled()
    expect(screen.getByTestId('대사-상자').getAttribute('data-text')).toContain(' / 5')
    for (let page = 0; page < 5 && onContinue.mock.calls.length === 0; page += 1) {
      다찍기()
      fireEvent.keyDown(window, { key: 'Enter' })
    }
    expect(onContinue).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it('[자세히] 는 오늘의 성적 칸을 연다 — 감독 평가는 평가 이벤트 몫이라 없다', () => {
    띄우기()

    fireEvent.click(screen.getByRole('button', { name: '자세히' }))

    expect(screen.queryByText('감독 평가')).toBeNull()
    expect(screen.getByText('오늘의 성적')).toBeTruthy()
  })

  it('국가대항전 경기(116 평가 없음)는 같은 결과 판에 평가 칸이 없다', () => {
    const onContinue = vi.fn()
    render(
      <GameResultScreen summary={요약()} gamePointReward={30} newTitles={[]} career={createCareer('선수')} onContinue={onContinue} />,
    )
    expect(screen.getByText('30 G포인트')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '자세히' }))
    expect(screen.queryByText('감독 평가')).toBeNull()
    expect(screen.getByText('오늘의 성적')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(onContinue).toHaveBeenCalledOnce()
  })
})

describe('승·패·세 이름', () => {
  it('요약에 실린 이름(gameFlow.pitchersOfRecordOf)을 세 줄에 적는다', () => {
    띄우기(요약({ pitchersOfRecord: { win: '승투', loss: '패투', save: null } }))

    expect(screen.getByText('승투')).toBeTruthy()
    expect(screen.getByText('패투')).toBeTruthy()
  })
})
