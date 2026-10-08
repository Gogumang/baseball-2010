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
import { GAME_END_INPUT_LOCK_TICKS, PITCHER_LABELS } from '@/widgets/game-scene/lib/endBoardLayout'
import { resetSkinTickerCounter } from '@/shared/lib/skinTicker/skinTicker'

/**
 * 나리 타자편 경기 결과 — 경기 끝 판 0x18(0x4fe9c) → 정산 0x19(0x4ea0c · 그림 0x4a384 의 4a948 갈래, 키 0x407f0)
 * → 116 평가(114 내장 이벤트 0x8a6fc). 이어하기 116 은 곧장 평가.
 */

afterEach(() => {
  cleanup()
  resetSkinTickerCounter()
  vi.useRealTimers()
})

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

const 평가 = { popularityChange: 1, reputationChange: 0, moraleChange: 2, commentIndex: 40 } as const

const 프레임 = (count: number) => act(() => {
  vi.advanceTimersByTime(count * millisecondsPerFrame())
})

/** 경기 끝 판을 10틱 기다려 OK — 정산 0x19 로 */
const 끝판넘기기 = () => {
  프레임(GAME_END_INPUT_LOCK_TICKS)
  fireEvent.click(screen.getByRole('button', { name: '확인' }))
}

describe('경기 끝 판 (상태 0x18 · 0x4fe9c)', () => {
  it('정산을 지나 왔으면 먼저 경기 끝 판 — 점수판 틀 · 승리/패전/세이브 줄, 배경 · 정산 판은 아직 없다', () => {
    vi.useFakeTimers()
    const { container } = render(
      <GameResultScreen summary={요약({ pitchersOfRecord: { win: '승투', loss: '패투', save: null } })}
        gamePointReward={0} newTitles={[]} career={createCareer('선수')} onContinue={vi.fn()}
        settlement={{ inning: 9, playerSide: 1, random: createSeededRandom(1) }} />,
    )
    for (const label of PITCHER_LABELS) expect(screen.getByAltText(label.name)).toBeTruthy()
    expect(screen.getByText('승투')).toBeTruthy()
    expect(screen.getByText('패투')).toBeTruthy()
    expect(screen.getByTestId('점수판-틀')).toBeTruthy()
    expect(screen.queryByTestId('정산-판')).toBeNull()
    expect(container.querySelector('canvas')).toBeNull()
    expect(screen.queryByRole('button', { name: '자세히' })).toBeNull()
  })
})

describe('정산 판 (0x4a384 의 4a948 갈래 — 팀경기 SettlementBoard)', () => {
  it('OK 뒤 정산 — 배경 캔버스 위에 정산 판, 효과 층은 판 안(비는 덮개 위 · 파티클은 맨 위), 그리기 전엔 경기 난수를 안 쓴다', () => {
    vi.useFakeTimers()
    const random = createSeededRandom(1)
    const next = vi.spyOn(random, 'next')
    const { container } = render(
      <GameResultScreen summary={요약({ result: '패', ourScore: 1, opponentScore: 4 })} gamePointReward={0} newTitles={[]}
        career={createCareer('선수')} onContinue={vi.fn()} settlement={{ inning: 9, playerSide: 1, random }} />,
    )
    끝판넘기기()
    const board = screen.getByTestId('정산-판')
    const stage = board.parentElement as HTMLElement
    // 0 = 결과 배경(타석 캔버스) 자리, 그다음 정산 판
    expect(stage.children[0]?.querySelector('canvas')).not.toBeNull()
    expect(stage.children[1]).toBe(board)
    const boardCanvases = Array.from(board.children).filter((element) => element.tagName === 'CANVAS')
    expect(board.children[1]).toBe(boardCanvases[0])
    expect(board.children[board.children.length - 1]).toBe(boardCanvases[1])
    expect(container.querySelectorAll('canvas').length).toBe(3)
    // jsdom 은 캔버스 그리기가 없어 rAF 효과 틱이 안 돈다
    expect(next).not.toHaveBeenCalled()
  })

  it('점수는 측 0(선공)이 왼쪽 — 사람 팀이 선공이면 우리 점수가 왼쪽', () => {
    vi.useFakeTimers()
    render(
      <GameResultScreen summary={요약({ ourScore: 7, opponentScore: 2 })} gamePointReward={0} newTitles={[]}
        career={createCareer('선수')} onContinue={vi.fn()}
        settlement={{ inning: 9, playerSide: 0, random: createSeededRandom(1) }} />,
    )
    끝판넘기기()
    expect(screen.getByTestId('정산-점수-0').dataset.value).toBe('7')
    expect(screen.getByTestId('정산-점수-1').dataset.value).toBe('2')
  })

  it("'0' 기록 판 — 기록 줄 · 획득 G · 보유 G(정산이 더한 선수 G)", () => {
    vi.useFakeTimers()
    render(
      <GameResultScreen summary={요약({ recordIds: [3, 3] })} gamePointReward={120} newTitles={[]}
        career={{ ...createCareer('선수'), gamePoint: 4321 }} onContinue={vi.fn()}
        settlement={{ inning: 9, playerSide: 1, random: createSeededRandom(1) }} />,
    )
    끝판넘기기()
    expect(screen.getByTestId('정산-번-G')).toBeTruthy()
    fireEvent.keyDown(window, { key: '0' })
    expect(screen.getByTestId('정산-기록-3').textContent).toContain('2회')
    expect(screen.getByTestId('정산-획득-G')).toBeTruthy()
    expect(screen.getByTestId('정산-보유-G')).toBeTruthy()
  })

  it('국가대항전(116 평가 없음) — 정산 판을 나가면 곧장 다음', () => {
    vi.useFakeTimers()
    const onContinue = vi.fn()
    render(
      <GameResultScreen summary={요약()} gamePointReward={30} newTitles={[]} career={createCareer('선수')}
        onContinue={onContinue} settlement={{ inning: 9, playerSide: 0, random: createSeededRandom(1) }} />,
    )
    끝판넘기기()
    expect(onContinue).not.toHaveBeenCalled()
    // 닫힌 판에서 '0' 이 아닌 키 → 메시지 0x3f3
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onContinue).toHaveBeenCalledOnce()
  })
})

describe('116 평가 (114 내장 이벤트 0x8a6fc)', () => {
  it('정산 판을 나가면 평가 — 대사(기록 줄 + 감독 글) → 변화 창 → 114 끝에 다음, 밑그림은 이 단계에만', () => {
    vi.useFakeTimers()
    const onContinue = vi.fn()
    render(
      <GameResultScreen summary={요약()} gamePointReward={0} newTitles={[]} evaluation={평가}
        recordLine={{ atBats: 4, hits: 2, runsBattedIn: 3, homeRuns: 1 }}
        career={createCareer('선수')} onContinue={onContinue} underlay={<div data-testid="밑그림" />}
        settlement={{ inning: 9, playerSide: 1, random: createSeededRandom(1) }} />,
    )
    끝판넘기기()
    expect(screen.queryByTestId('밑그림')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(screen.getByTestId('밑그림')).toBeTruthy()
    expect(onContinue).not.toHaveBeenCalled()
    프레임(200)
    const 줄 = [...screen.getByTestId('대사-상자').querySelectorAll('[data-part="글줄"]')].map((line) => line.textContent)
    expect(줄[0]).toBe('4타수 2안타 3타점 1홈런')
    expect(screen.getByTestId('대사-상자').getAttribute('data-text')).toContain((ORIGINAL_USER_EVENTS[40] ?? '').replace(/!c[0-9A-Fa-f]{6}|!N/g, '').slice(0, 4))
    for (let page = 0; page < 5 && screen.queryByRole('dialog', { name: '경기 평가 변화' }) === null; page += 1) {
      fireEvent.keyDown(window, { key: 'Enter' })
      프레임(200)
    }
    const 창 = screen.getByRole('dialog', { name: '경기 평가 변화' })
    const 글 = [...창.querySelectorAll('img[data-frame]')].map((img) => Number(img.getAttribute('data-frame')))
    expect(글.slice(0, 4)).toEqual([359, 84, 327, 331])
    fireEvent.keyDown(window, { key: '5' })
    expect(onContinue).toHaveBeenCalledOnce()
  })

  it('연속 기록이 있으면 변화 창 뒤 명령 3 say — 같은 상자에 " / " 로 이은 줄을 찍는다', () => {
    vi.useFakeTimers()
    const onContinue = vi.fn()
    render(
      <GameResultScreen summary={요약()} gamePointReward={0} newTitles={[]} evaluation={평가}
        streakNotices={[
          { labelIndex: 100, count: 5, commentIndex: 108, reputationChange: 10 },
          { labelIndex: 101, count: 5, commentIndex: 108, reputationChange: 10 },
        ]}
        career={createCareer('선수')} onContinue={onContinue} />,
    )
    for (let page = 0; page < 5 && screen.queryByRole('dialog', { name: '경기 평가 변화' }) === null; page += 1) {
      프레임(200)
      fireEvent.keyDown(window, { key: 'Enter' })
    }
    fireEvent.keyDown(window, { key: '5' })
    expect(onContinue).not.toHaveBeenCalled()
    expect(screen.getByTestId('대사-상자').getAttribute('data-text')).toContain(' / 5')
    for (let page = 0; page < 5 && onContinue.mock.calls.length === 0; page += 1) {
      프레임(200)
      fireEvent.keyDown(window, { key: 'Enter' })
    }
    expect(onContinue).toHaveBeenCalledOnce()
  })

  it('이어하기로 다시 띄운 116(정산 재료 없음)은 경기 끝 판 · 정산 판 없이 곧장 평가 — 배경 · 효과도 없다', () => {
    const { container } = render(
      <GameResultScreen summary={요약()} gamePointReward={0} newTitles={[]} evaluation={평가}
        career={createCareer('선수')} onContinue={vi.fn()} underlay={<div data-testid="밑그림" />} />,
    )
    expect(screen.getByTestId('밑그림')).toBeTruthy()
    expect(screen.queryByTestId('정산-판')).toBeNull()
    expect(screen.queryByTestId('점수판-틀')).toBeNull()
    expect(container.querySelector('canvas')).toBeNull()
  })

  it('116 이 준 칭호 39 는 칭호 팝업 0x1274c 로 — 닫으면 평가 이벤트', () => {
    vi.useFakeTimers()
    render(
      <GameResultScreen summary={요약()} gamePointReward={0} newTitles={['다이너마이트 배트']} evaluation={평가}
        career={createCareer('선수')} onContinue={vi.fn()} />,
    )
    expect(screen.queryByTestId('대사-상자')).toBeNull()
    expect(screen.getByText(/다이너마이트 배트/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    프레임(200)
    expect(screen.getByTestId('대사-상자')).toBeTruthy()
  })
})
