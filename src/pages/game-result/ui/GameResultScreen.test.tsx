// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { GameResultScreen } from '@/pages/game-result/ui/GameResultScreen'
import { createCareer } from '@/entities/career/model/playerCareer'
import { EMPTY_SEASON_STATS } from '@/entities/career/model/seasonStats'
import type { GameSummary } from '@/entities/game/model/gameSummary'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { GAME_END_INPUT_LOCK_TICKS, PITCHER_LABELS } from '@/widgets/game-scene/lib/endBoardLayout'
import { resetSkinTickerCounter } from '@/shared/lib/skinTicker/skinTicker'

/**
 * 나리 타자편 경기 결과 — 경기 끝 판 0x18(0x4fe9c) → 정산 0x19(0x4ea0c · 그림 0x4a384 의 4a948 갈래, 키 0x407f0)
 * → 나가기(메시지 0x3f3). 116 평가는 `GameEvaluationScreen.test`.
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


const 프레임 = (count: number) => act(() => {
  vi.advanceTimersByTime(count * millisecondsPerFrame())
})

/** 경기 끝 판을 10틱 기다려 OK — 정산 0x19 로 */
const 끝판넘기기 = () => {
  프레임(GAME_END_INPUT_LOCK_TICKS)
  fireEvent.click(screen.getByRole('button', { name: '확인' }))
  // OK 는 받은 다음 틀의 키 0x498d4 가 처리한다(`sceneKeyLatch`)
  프레임(1)
}

describe('경기 끝 판 (상태 0x18 · 0x4fe9c)', () => {
  it('정산을 지나 왔으면 먼저 경기 끝 판 — 점수판 틀 · 승리/패전/세이브 줄, 배경 · 정산 판은 아직 없다', () => {
    vi.useFakeTimers()
    const { container } = render(
      <GameResultScreen summary={요약({ pitchersOfRecord: { win: '승투', loss: '패투', save: null } })}
        gamePointReward={0} career={createCareer('선수')} onContinue={vi.fn()}
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
    const rand = vi.spyOn(random, 'rand')
    const rand9d = vi.spyOn(random, 'rand9d')
    const { container } = render(
      <GameResultScreen summary={요약({ result: '패', ourScore: 1, opponentScore: 4 })} gamePointReward={0}
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
    expect(rand).not.toHaveBeenCalled()
    expect(rand9d).not.toHaveBeenCalled()
  })

  it('점수는 측 0(선공)이 왼쪽 — 사람 팀이 선공이면 우리 점수가 왼쪽', () => {
    vi.useFakeTimers()
    render(
      <GameResultScreen summary={요약({ ourScore: 7, opponentScore: 2 })} gamePointReward={0}
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
      <GameResultScreen summary={요약({ recordIds: [3, 3] })} gamePointReward={120}
        career={{ ...createCareer('선수'), gamePoint: 4321 }} onContinue={vi.fn()}
        settlement={{ inning: 9, playerSide: 1, random: createSeededRandom(1) }} />,
    )
    끝판넘기기()
    expect(screen.getByTestId('정산-번-G')).toBeTruthy()
    // 정산 키 0x407f0 은 받은 다음 틀에 처리된다(`sceneKeyLatch`)
    fireEvent.keyDown(window, { key: '0' })
    프레임(1)
    expect(screen.getByTestId('정산-기록-3').textContent).toContain('2회')
    expect(screen.getByTestId('정산-획득-G')).toBeTruthy()
    expect(screen.getByTestId('정산-보유-G')).toBeTruthy()
  })

  it('정산 판을 나가면(0x3f3) 곧장 onContinue — 116 평가는 이 화면 밖(나리 장면, `GameEvaluationScreen`)', () => {
    vi.useFakeTimers()
    const onContinue = vi.fn()
    render(
      <GameResultScreen summary={요약()} gamePointReward={30} career={createCareer('선수')}
        onContinue={onContinue} settlement={{ inning: 9, playerSide: 0, random: createSeededRandom(1) }} />,
    )
    끝판넘기기()
    expect(onContinue).not.toHaveBeenCalled()
    // 닫힌 판에서 '0' 이 아닌 키 → 메시지 0x3f3
    fireEvent.keyDown(window, { key: 'Enter' })
    프레임(1)
    expect(onContinue).toHaveBeenCalledOnce()
  })
})

describe('징글 자리', () => {
  it('승패 31 · 32 는 정산 0x19 진입(0x4ea0c 4f41a)에서 한 번 — 경기 끝 판 0x18 에는 없다 (평가 36~38 은 116 을 띄우는 세션 몫)', () => {
    vi.useFakeTimers()
    const onSettlementEnter = vi.fn()
    render(
      <GameResultScreen summary={요약()} gamePointReward={0}
        career={createCareer('선수')} onContinue={vi.fn()} onSettlementEnter={onSettlementEnter}
        settlement={{ inning: 9, playerSide: 1, random: createSeededRandom(1) }} />,
    )
    expect(onSettlementEnter).not.toHaveBeenCalled()
    끝판넘기기()
    expect(onSettlementEnter).toHaveBeenCalledTimes(1)
    프레임(5)
    expect(onSettlementEnter).toHaveBeenCalledTimes(1)
  })
})
