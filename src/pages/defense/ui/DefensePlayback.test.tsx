// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { DefensePlayback } from '@/pages/defense/ui/DefensePlayback'
import type { DefenseViewState } from '@/pages/defense/lib/defenseView'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import { registerContact } from '@/entities/batting/model/battedContact'
import { representativePatternOf } from '@/features/defense-play/model/representativePattern'
import { runWalkPlay } from '@/features/defense-play/model/walkPlay'
import {
  acceptsFastForwardKey,
  isDefensePlayFinished,
  runDefensePlay,
  startDefensePlay,
  stepDefensePlay,
} from '@/features/defense-play/model/runDefensePlay'
import type { DefensePlayInput, DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import type { BaseState } from '@/entities/game/model/baseState'
import { basePosition } from '@/entities/fielding/model/fieldGeometry'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { BATTED_BALL_PATTERNS, type BattedBallPattern } from '@/shared/config/original/battedBallPatterns'
import { setActiveSound } from '@/shared/api/audio/soundPort'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { createFractionRandom } from '@/shared/api/random/fractionRandom'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { openPitchArrivalPlay } from '@/features/defense-play/model/pitchArrivalPlay'
import { runStealPlay, stealCallSoundIdOf } from '@/features/defense-play/model/stealPlay'
import {
  GameSceneMarkContext,
  markCommonWindowShown,
  resetCommonWindowShownForTest,
  useMarksGameScene,
} from '@/shared/lib/commonWindow/commonWindow'

/**
 * 수비 한 플레이 재생 (원본 경기 장면 상태 0x17).
 * 이 화면이 없으면 **배트에 맞은 공이 어디로 갔는지 화면에 아예 안 나온다** —
 * 실제로 팀 경기·투수편이 한동안 그런 상태였다.
 */

afterEach(cleanup)

const 틱 = (): DefenseViewState => ({
  ball: { x: 20_000, z: 24_500, height: 0, isFlying: true },
  fielders: [],
  runners: [],
})

describe('수비 재생', () => {
  it('틱이 없으면 아무것도 그리지 않고 곧바로 끝났다고 알린다', () => {
    const onDone = vi.fn()
    const { container } = render(<DefensePlayback ticks={[]} onDone={onDone} />)

    expect(container.firstChild).toBeNull()
    expect(onDone).toHaveBeenCalled()
  })

  /**
   * ⚠️ jsdom 에서는 `useFrameOrigins` 의 JSON 이 안 와서 `FrameSprite` 가 **아무것도 안 그린다** —
   * 그래서 공 그림 자체는 여기서 확인할 수 없다. 화면이 서는 것까지만 본다.
   */
  it('틱이 있으면 수비 화면을 세운다 — 곧바로 끝났다고 하지 않는다', () => {
    const onDone = vi.fn()
    const { container } = render(<DefensePlayback ticks={[틱(), 틱(), 틱()]} onDone={onDone} />)

    expect(container.firstChild).not.toBeNull()
    expect(onDone).not.toHaveBeenCalled()
  })

  it('볼넷 · 사구 밀어내기 판(종류 2)은 키가 오면 그 그림에서 끝난다 — 0x519cc(state[0xb] ∈ {3, 4}) → +0xfe7 → 0x35108', () => {
    const 밀어내기 = runWalkPlay({ bases: 주자1루, outs: 0, pitchJudgement: 3 })
    const 가만히 = vi.fn()
    render(<DefensePlayback ticks={밀어내기.ticks} onDone={가만히} freePassPlay />)
    expect(가만히).not.toHaveBeenCalled()
    cleanup()
    vi.useFakeTimers()
    try {
      const 눌렀다 = vi.fn()
      render(<DefensePlayback ticks={밀어내기.ticks} onDone={눌렀다} freePassPlay />)
      act(() => {
        fireEvent.keyDown(window, { key: '5' })
      })
      // 키는 받은 다음 틀의 키 0x498d4 → 0x53420 → 0x519cc 가 처리한다(`sceneKeyLatch`) — 받은 틀에는 아직 안 끝난다
      expect(눌렀다).not.toHaveBeenCalled()
      for (let i = 0; i < 4 && 눌렀다.mock.calls.length === 0; i += 1) act(() => void vi.advanceTimersByTime(millisecondsPerFrame()))
      expect(눌렀다).toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('밀어내기 판이 아닌 재생(견제 · 도루 · 폭투)은 키를 받지 않는다', () => {
    const onDone = vi.fn()
    render(<DefensePlayback ticks={[틱(), 틱(), 틱()]} onDone={onDone} />)
    act(() => {
      fireEvent.keyDown(window, { key: '5' })
    })
    expect(onDone).not.toHaveBeenCalled()
  })
})

// ── 실시간 갈래 ──

const 뜬공아웃: AtBatOutcome = { kind: '아웃', detail: '뜬공아웃' }
const 단타: AtBatOutcome = { kind: '안타', bases: 1 }
const 주자1루: BaseState = { first: true, second: false, third: false }
const 주자3루: BaseState = { first: false, second: false, third: true }
/** 내야 뒤에 겨우 뜬 공 — 가만 두면 3루 주자가 태그업으로 못 들어온다 */
const 얕은뜬공: BattedBallPattern = [90, 250, 700, 0]

function 타구(
  outcome: AtBatOutcome,
  bases: BaseState,
  pattern: BattedBallPattern = representativePatternOf(outcome),
): DefensePlayInput {
  return { outcome, trajectory: battedBallTrajectory(pattern), bases, outs: 0 }
}

/**
 * 플레이가 끝날 때까지 갱신을 흘린다. `key` 를 주면 **갱신마다 한 번씩** 누른다
 * (원본도 한 갱신에 키 한 개를 본다).
 */
function 끝까지(onDone: ReturnType<typeof vi.fn>, key?: string, 최대갱신 = 400): void {
  for (let i = 0; i < 최대갱신 && onDone.mock.calls.length === 0; i += 1) {
    if (key !== undefined) fireEvent.keyDown(window, { key })
    act(() => void vi.advanceTimersByTime(millisecondsPerFrame()))
  }
}

function 결과(onDone: ReturnType<typeof vi.fn>): DefensePlayResult {
  const [first] = onDone.mock.calls[0] as [DefensePlayResult | undefined]
  expect(first).toBeDefined()
  return first as DefensePlayResult
}

describe('수비 재생 — 타구를 받아 실시간으로 돌리는 갈래 (경기 상태 0x17)', () => {
  it('타구를 주면 스스로 한 갱신에 한 틱씩 돌려 결과를 내준다 — 미리 돌린 것과 같다', () => {
    vi.useFakeTimers()
    try {
      const onDone = vi.fn()
      const input = 타구(단타, 주자1루)
      const { container } = render(<DefensePlayback input={input} onDone={onDone} />)

      // 첫 갱신에 이미 첫 틱을 그린다
      expect(container.firstChild).not.toBeNull()

      끝까지(onDone)

      const 실시간 = 결과(onDone)
      const 미리 = runDefensePlay(input)
      expect(실시간.advance).toEqual(미리.advance)
      expect(실시간.ticks.length).toBe(미리.ticks.length)
      expect(실시간.log).toEqual(미리.log)
    } finally {
      vi.useRealTimers()
    }
  })

  it("사람이 공격을 잡고 '8' 을 누르면 3루 주자가 진루한다 — 가만 두면 안 뛰던 얕은 뜬공이다", () => {
    vi.useFakeTimers()
    try {
      const input = 타구(뜬공아웃, 주자3루, 얕은뜬공)

      const 가만히 = vi.fn()
      render(<DefensePlayback input={input} side="공격" onDone={가만히} />)
      끝까지(가만히)
      cleanup()

      const 눌렀다 = vi.fn()
      render(<DefensePlayback input={input} side="공격" onDone={눌렀다} />)
      끝까지(눌렀다, '8')

      expect(결과(가만히).log.some((line) => line.includes('진루'))).toBe(false)
      expect(결과(눌렀다).log.some((line) => line.includes('진루'))).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it("사람이 수비를 잡고 '2' 를 누르면 2루로 송구한다 (0x533c8 → 메시지 0x588)", () => {
    vi.useFakeTimers()
    try {
      const onDone = vi.fn()
      render(<DefensePlayback input={타구(단타, 주자1루)} side="수비" onDone={onDone} />)
      끝까지(onDone, '2')

      const 결 = 결과(onDone)
      expect(결.throwBase).toBe(2)
      expect(결.log.some((line) => line.includes('사람이 2루로 송구 지시'))).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  /**
   * **펌블 함성 29** — 펌블은 야수 +0xb8 = 6 뿐이고 그 틱의 그리기 0x4381a 가 예약 29 를 낸다
   * (53 의 0xa1e60 은 필살타법 타구에 맞은 야수 몫이라 펌블엔 없다).
   * 굴림은 진행기가 하지만 소리는 **틱을 도는 이 화면**이 낸다 — 플레이 끝에 몰아서 내면
   * 아웃 콜(0x51b36)을 덮기 때문이다.
   */
  it('펌블이 난 그 틱마다 29 를 내고 53 은 안 낸다 (0xb41d0 → +0xb8 = 6 → 0x4381a)', () => {
    vi.useFakeTimers()
    const 울린것: number[] = []
    setActiveSound({
      play: (id) => void 울린것.push(id),
      playBgm: () => {},
      stopBgm: () => {},
      resumeBgm: () => {},
      stop: () => {},
      currentBgm: () => null,
      setVolume: () => {},
      getVolume: () => 100,
    })
    try {
      // 굴림이 늘 0 을 내는 난수 — 펌블 기준(만분율)보다 작아 **반드시** 펌블이 난다
      const 늘0: RandomPort = createFractionRandom(() => 0)
      const onDone = vi.fn()
      render(<DefensePlayback input={{ ...타구(단타, 주자1루), random: 늘0 }} onDone={onDone} />)
      끝까지(onDone)

      const 결 = 결과(onDone)
      expect(결.fumbled).toBe(true)
      // 늘 0 이면 잡을 때마다 펌블이다 — 원본처럼 펌블 6 을 본 그림마다 한 번씩(한 판에 여럿이면 여럿)
      const 펌블그림 = 결.ticks.filter((view) =>
        view.fielders.some((fielder) => (fielder.lockTicks ?? 0) <= 0 && fielder.fumbleTicks === 6),
      ).length
      expect(펌블그림).toBeGreaterThan(0)
      expect(울린것.filter((id) => id === 29)).toHaveLength(펌블그림)
      expect(울린것).not.toContain(53)
    } finally {
      setActiveSound(null)
      vi.useRealTimers()
    }
  })

  /**
   * **실책 +0x2e** — 같은 그리기 0x4381a 가 펌블 6 을 본 야수의 [+0xec]+0x2e 를 올린다. 화면이 그린 틱마다 세어 두었다가
   * `onDone` 바로 앞에 넘긴다(그 뒤 정산이 요약을 만들 수 있게).
   */
  it('펌블이 난 틱의 그림이 실책을 한 번 넘기고, onDone 보다 먼저 부른다 (4381a~43852)', () => {
    vi.useFakeTimers()
    try {
      const 늘0: RandomPort = createFractionRandom(() => 0)
      const onDone = vi.fn()
      const onFieldingErrors = vi.fn()
      render(
        <DefensePlayback
          input={{ ...타구(단타, 주자1루), random: 늘0, defenseTeamIndex: 3 }}
          onDone={onDone}
          onFieldingErrors={onFieldingErrors}
        />,
      )
      끝까지(onDone)

      const 결 = 결과(onDone)
      expect(결.fumbled).toBe(true)
      // 결과 틱에서 펌블 6 을 본 야수(잠금 없음) — 그 그림마다 한 번
      const 기대 = 결.ticks.flatMap((view) =>
        view.fielders
          .filter((fielder) => (fielder.lockTicks ?? 0) <= 0 && fielder.fumbleTicks === 6)
          .map((fielder) => ({ slot: fielder.slot, teamIndex: 3 })),
      )
      expect(기대.length).toBeGreaterThan(0)
      expect(onFieldingErrors).toHaveBeenCalledTimes(1)
      expect(onFieldingErrors.mock.calls[0]?.[0]).toEqual(expect.arrayContaining(기대))
      expect(onFieldingErrors.mock.invocationCallOrder[0]).toBeLessThan(onDone.mock.invocationCallOrder[0] ?? 0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('펌블이 없으면 29 를 내지 않는다 — 난수를 안 주면 굴림 자체가 안 돈다', () => {
    vi.useFakeTimers()
    const 울린것: number[] = []
    setActiveSound({
      play: (id) => void 울린것.push(id),
      playBgm: () => {},
      stopBgm: () => {},
      resumeBgm: () => {},
      stop: () => {},
      currentBgm: () => null,
      setVolume: () => {},
      getVolume: () => 100,
    })
    try {
      const onDone = vi.fn()
      render(<DefensePlayback input={타구(단타, 주자1루)} onDone={onDone} />)
      끝까지(onDone)

      expect(결과(onDone).fumbled).toBe(false)
      expect(울린것).not.toContain(29)
    } finally {
      setActiveSound(null)
      vi.useRealTimers()
    }
  })

  it('side 를 안 주면 키를 눌러도 아무 일도 없다 — 지금처럼 자동이다', () => {
    vi.useFakeTimers()
    try {
      const onDone = vi.fn()
      render(<DefensePlayback input={타구(뜬공아웃, 주자3루, 얕은뜬공)} onDone={onDone} />)
      끝까지(onDone, '8')

      expect(결과(onDone).log.some((line) => line.includes('진루'))).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('슬라이딩 소리 10 (0x5268c · 0x5199c)', () => {
  it('자동 슬라이딩이 걸린 틱마다 10 을 낸다 — 진행기의 slidingSoundThisTick 그대로', () => {
    vi.useFakeTimers()
    const 울린것: number[] = []
    setActiveSound({
      play: (id) => void 울린것.push(id),
      playBgm: () => {},
      stopBgm: () => {},
      resumeBgm: () => {},
      stop: () => {},
      currentBgm: () => null,
      setVolume: () => {},
      getVolume: () => 100,
    })
    try {
      const input: DefensePlayInput = {
        outcome: { kind: '아웃', detail: '땅볼아웃' },
        trajectory: battedBallTrajectory([81, 897, 290, 1]), // 원본 표 패턴(코드 3 땅볼) — 손 패턴 [113,500,300] 은 다리 없이 돌리면 투수가 뜬 채 잡는다
        bases: 주자1루,
        outs: 0,
        runAbility: 500,
        throwMode: '자동',
      }
      const 자동 = runDefensePlay(input).log.filter((line) => line.includes('자동 슬라이딩'))
      expect(자동.length).toBeGreaterThan(0)

      const onDone = vi.fn()
      render(<DefensePlayback input={input} onDone={onDone} />)
      끝까지(onDone)

      expect(울린것.filter((id) => id === 10)).toHaveLength(자동.length)
    } finally {
      setActiveSound(null)
      vi.useRealTimers()
    }
  })
})

describe('수비 장면 득점 점수판 0x41a64 — 실시간 갈래', () => {
  it('3루 주자가 들어오는 틱부터 20번 선다 — 처음 5번은 앞 점수, 그 뒤 새 점수 (메시지 0x13 → 타이머 0x14)', () => {
    vi.useFakeTimers()
    try {
      const onDone = vi.fn()
      const { queryByTestId } = render(
        <DefensePlayback input={타구(단타, 주자3루)} onDone={onDone}
          runScoreBoard={{ sides: [{ team: 1, isComputer: true }, { team: 4, isComputer: false }], scores: [2, 3], battingSide: 1 }} />,
      )
      const shown: string[] = []
      for (let i = 0; i < 400 && onDone.mock.calls.length === 0; i += 1) {
        act(() => void vi.advanceTimersByTime(millisecondsPerFrame()))
        const board = queryByTestId('수비-득점판')
        if (board !== null) {
          shown.push(`${queryByTestId('수비-득점판-점수-0')?.dataset.value}:${queryByTestId('수비-득점판-점수-1')?.dataset.value}`)
        }
      }
      expect(shown.length).toBeGreaterThan(0)
      expect(shown.slice(0, 5)).toEqual(['2:3', '2:3', '2:3', '2:3', '2:3'])
      // 여섯째 갱신부터 새 점수 — 갱신 계수는 시계로 돌아 같은 그림(앞 점수)을 한 번 더 볼 수 있다(아래 21 과 같은 까닭)
      const firstNew = shown.indexOf('2:4')
      expect(firstNew === 5 || (firstNew === 6 && shown[5] === '2:3')).toBe(true)
      expect(shown.slice(firstNew).every((value) => value === '2:4')).toBe(true)
      // 20 번 그린다 — 갱신 계수는 시계로 돌아 한 진행에 갱신이 안 오르면 같은 그림을 한 번 더 볼 수 있다
      expect(shown.length).toBeLessThanOrEqual(21)
    } finally {
      vi.useRealTimers()
    }
  })

  it('runScoreBoard 를 안 주면 그리지 않는다', () => {
    vi.useFakeTimers()
    try {
      const onDone = vi.fn()
      const { queryByTestId } = render(<DefensePlayback input={타구(단타, 주자3루)} onDone={onDone} />)
      끝까지(onDone)
      expect(queryByTestId('수비-득점판')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('수비 장면 득점 점수판 0x41a64 — 판이 끝난 뒤 · 재생 갈래 홈런 갈래', () => {
  const 측 = [{ team: 1, isComputer: true }, { team: 4, isComputer: false }] as const

  it('실시간 갈래 — 관문이 닫힌 뒤 11 번째 갱신(+0x1094 > 10)에 0x35108 로 끝낸다 — 그때까지 득점 점수판은 타이머대로 그린다', () => {
    vi.useFakeTimers()
    try {
      const onDone = vi.fn()
      const input = 타구(단타, 주자3루)
      const 미리 = runDefensePlay(input)
      const { queryByTestId } = render(
        <DefensePlayback input={input} onDone={onDone} runScoreBoard={{ sides: 측, scores: [2, 3], battingSide: 1 }} />,
      )
      const presence: boolean[] = []
      for (let i = 0; i < 400 && onDone.mock.calls.length === 0; i += 1) {
        act(() => void vi.advanceTimersByTime(millisecondsPerFrame()))
        presence.push(queryByTestId('수비-득점판') !== null)
      }
      expect(onDone).toHaveBeenCalled()
      // 갱신마다 한 틱 — 마지막 틱(관문이 닫힌 틱) 뒤 닫힌 갱신 10 번을 그리고 11 번째에 끝난다(예전 웹은 붙든 갱신 8).
      // 갱신 계수는 시계로 돌아 진행 한 번에 갱신이 안 오르거나 둘 오를 수 있어 앞뒤 두 갱신을 둔다
      expect(presence.length).toBeGreaterThanOrEqual(미리.ticks.length + 10 - 2)
      expect(presence.length).toBeLessThanOrEqual(미리.ticks.length + 10 + 2)
      // 3루 주자 홈인부터 20 번 — 닫힌 갱신에서도 0x46e62 가 그대로 그린다(예전 웹은 판이 닫히면 안 그렸다)
      expect(presence.filter(Boolean).length).toBeGreaterThanOrEqual(19)
      expect(presence.slice(-3).some(Boolean)).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('재생 갈래 — 타자주자가 홈을 밟으면 판이 서고 공격 쪽 점수가 1점씩 올라간다 (마지막 틱 = 플레이 끝이면 내린다)', async () => {
    const { homeRunPlaybackOf } = await import('@/features/defense-play/model/homeRunPlayback')
    const 홈런 = homeRunPlaybackOf({ outcome: { kind: '홈런', bases: 4 } as AtBatOutcome, bases: 주자3루 })!
    // 판의 마지막 그림은 타자주자가 홈에 닿은 목록 틱 뒤 그림이다(득점 0xaa0a8 은 그 그림의 슬롯 2) — 원본 0x17 이 홈인 뒤에도
    // 이어지는 경우를 흉내 내 그 그림을 61 장 더 붙인다 — 판의 마지막 장이 홈인 틱, 붙인 마지막 장이 플레이 끝
    const last = 홈런.ticks[홈런.ticks.length - 1]!
    const 홈 = basePosition(0)
    expect(last.runners.find((runner) => runner.index === 0)).toMatchObject({ x: 홈.x, z: 홈.z })
    const ticks = [...홈런.ticks, ...Array.from({ length: 61 }, () => last)]
    vi.useFakeTimers()
    try {
      const onDone = vi.fn()
      const { queryByTestId } = render(
        <DefensePlayback ticks={ticks} onDone={onDone}
          runScoreBoard={{ sides: 측, scores: [0, 0], battingSide: 0 }} />,
      )
      const shown: string[] = []
      for (let i = 0; i < 400 && onDone.mock.calls.length === 0; i += 1) {
        act(() => void vi.advanceTimersByTime(millisecondsPerFrame()))
        const board = queryByTestId('수비-득점판')
        if (board !== null) shown.push(queryByTestId('수비-득점판-점수-0')?.dataset.value ?? '')
      }
      // 두 주자 — 타자주자 홈인에서 n = 2 · 간격 20 · 타이머 40: 0 → 1 → 2 로 오르고, 판은 끝 틱 앞에서 끊긴다
      expect(shown[0]).toBe('0')
      expect(shown).toContain('1')
      expect(shown[shown.length - 1]).toBe('2')
      // 20 + 21 + 19 번 — 두 주자가 같은 그림(판의 마지막 그림)에 홈인해 한 그림에 둘을 받는다(예전 시험은 타자주자만 한 그림
      // 늦게 옮겨 붙여 21 + 20 + 20 이었다). 끝 틱(플레이 끝)은 그리지 않는다
      expect(shown).toHaveLength(60)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('0x17 키 건너뛰기 0x519cc (+0xfe7) — 실시간 갈래', () => {
  /** 원본 코드 24 의 첫 패턴 — 담장을 넘는 홈런(사건 8 이 판 도중에 선다) */
  const 홈런패턴 = (): BattedBallPattern => {
    const pattern = BATTED_BALL_PATTERNS[24]?.[0]
    if (pattern === undefined) throw new Error('홈런 패턴 없음')
    return pattern
  }
  const 홈런 = (): DefensePlayInput => ({
    outcome: { kind: '홈런' }, trajectory: battedBallTrajectory(홈런패턴()), bases: 주자1루, outs: 0,
  })
  /** 사건 8(state[0x1d])이 서는 틱 — 진행기로 미리 센다 */
  const 홈런틱 = (input: DefensePlayInput): number => {
    let state = startDefensePlay(input)
    while (!isDefensePlayFinished(state) && !state.homeRunFlag) state = stepDefensePlay(state, null)
    return state.tick
  }

  it('홈런(state[0x1d])이 선 뒤 키를 누르면 한 그림 안에서 되풀이하다, 공이 멈춘 뒤 타자주자가 홈에 닿는 그림에 카메라 0x3f060 이 풀어(3f17e) 그 뒤는 보통으로 끝낸다 — 결과는 안 누른 판과 같다', () => {
    vi.useFakeTimers()
    try {
      const input = 홈런()
      const 그대로 = runDefensePlay(input)
      const h = 홈런틱(input)
      expect(h).toBeLessThan(그대로.ticks.length)
      const onDone = vi.fn()
      render(<DefensePlayback input={input} side="공격" onDone={onDone} />)
      for (let i = 0; i < h + 1; i += 1) act(() => void vi.advanceTimersByTime(millisecondsPerFrame()))
      expect(onDone).not.toHaveBeenCalled()
      fireEvent.keyDown(window, { key: '5' })
      act(() => void vi.advanceTimersByTime(millisecondsPerFrame()))
      // 3f164 — +0xfe7 && 주자 0 +0x7c == +0x8c == 4 → +0xfe7 = 0 · 메시지 0x13 : 52b36 이 되풀이를 멈추고 그 그림을 그린다
      expect(onDone).not.toHaveBeenCalled()
      // 그 뒤 G3 이 닫히는 그림 하나 · 닫힌 셈 11 갱신
      for (let i = 0; i < 60 && onDone.mock.calls.length === 0; i += 1) {
        act(() => void vi.advanceTimersByTime(millisecondsPerFrame()))
      }
      expect(onDone).toHaveBeenCalledTimes(1)
      const 건너뜀 = 결과(onDone)
      expect(건너뜀.advance).toEqual(그대로.advance)
      expect(건너뜀.log.some((line) => line.includes('키 건너뛰기'))).toBe(true)
      expect(건너뜀.log.some((line) => line.includes('건너뛰기 풀림'))).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('홈런 타구(0x357e0)는 홈런 점수판 [+0x1100] 이 내려갈 때까지 0x35108 을 미룬다 (52a1c) — 결과 코드가 없으면 11 번째 갱신', () => {
    vi.useFakeTimers()
    try {
      const 갱신수 = (input: DefensePlayInput): number => {
        const onDone = vi.fn()
        const { unmount } = render(<DefensePlayback input={input} onDone={onDone} />)
        let count = 0
        for (; count < 600 && onDone.mock.calls.length === 0; count += 1) {
          act(() => void vi.advanceTimersByTime(millisecondsPerFrame()))
        }
        unmount()
        return count
      }
      // 주자 없는 홈런 — 타자주자 홈인(n = 1 · 간격 20 · 타이머 20)이 판을 세운다
      const 맨 = { ...홈런(), bases: { first: false, second: false, third: false } }
      const 코드 = { ...맨, outcome: registerContact(맨.outcome, { pattern: 홈런패턴(), resultCode: 24 }) }
      const 판길이 = runDefensePlay(맨).ticks.length
      // 결과 코드가 없으면 닫힌 뒤 11 번째 갱신 — 앞뒤 두 갱신(시계로 도는 갱신 계수)
      expect(Math.abs(갱신수(맨) - (판길이 + 10))).toBeLessThanOrEqual(2)
      // 홈런 점수판은 21 + 20 번 그린 뒤(n < 0) 내려간다 — 판 끝(타자주자 홈인 = 0xa990c == 0) 뒤 41 번째 닫힌 갱신 무렵
      expect(Math.abs(갱신수(코드) - (판길이 + 41))).toBeLessThanOrEqual(3)

      // 1루 주자 홈런 — 1루 주자와 타자주자가 같은 틱에 홈을 밟는다(둘 다 1루에 섰다가 홈런 +0x111 로 함께 뛴다). 득점 0xaa0a8 은
      // 내림차순이라 1루 주자(칸 1, 판 내림) → 타자주자(칸 0, n = 2 · 간격 20 · 타이머 40) 차례로 메시지 0x13 이 와 판이 선다
      const 일루 = { ...홈런(), outcome: registerContact(홈런().outcome, { pattern: 홈런패턴(), resultCode: 24 }) }
      const 일루판 = runDefensePlay(일루)
      // 둘이 홈에 닿은 목록 틱 다음 그림 — 그 그림의 G2 는 득점 0xaa0a8(G2 뒤) 앞이라 아직 열리고, 그 그림 슬롯 2 의 득점(마지막 판 틱)
      // 뒤 그리기 G3 이 닫는다
      expect(일루판.log.filter((line) => line.includes('주자 홈 —')).map((line) => line.replace(/ — .*/, ''))).toEqual([
        `${일루판.ticks.length - 1}틱 1번 주자 홈`,
        `${일루판.ticks.length - 1}틱 0번 주자 홈`,
      ])
      // 두 점이 g 번마다 오른 뒤 g 번 더 — 판 끝 뒤 약 61 번째 닫힌 갱신 (예전 웹은 타자주자가 먼저라 판이 곧바로 내려 11 번째)
      expect(Math.abs(갱신수(일루) - (일루판.ticks.length + 61))).toBeLessThanOrEqual(3)
    } finally {
      vi.useRealTimers()
    }
  })

  it('홈런이 아닌 판은 키를 눌러도 건너뛰지 않는다 (0x519cc → 0x523aa)', () => {
    const state = startDefensePlay(타구(단타, 주자1루))
    expect(acceptsFastForwardKey(state)).toBe(false)
    expect(acceptsFastForwardKey({ ...state, homeRunFlag: true })).toBe(true)
    expect(acceptsFastForwardKey({ ...state, play: { ...state.play, suppressed: true } })).toBe(true)
    expect(acceptsFastForwardKey({ ...state, lastEventCode: 3 })).toBe(true)
    expect(acceptsFastForwardKey({ ...state, lastEventCode: 4 })).toBe(true)
  })
})

describe('수비 재생 — 사람 수비의 주자 판을 실시간으로 돌리는 갈래 (도루 · 폭투 · 견제, `liveRunnerPlay`)', () => {
  /** 1루 주자가 도루를 건 볼 — 공 도착 판(종류 5)을 판 시작까지 연다 */
  const 도루판 = () => {
    const opened = openPitchArrivalPlay(
      {
        gameMode: 2,
        pitchJudgement: 2,
        stealingFrom: [1],
        bases: { first: true, second: false, third: false },
        outs: 0,
        defenseIsCpu: false,
        offenseIsCpu: true,
      },
      createSeededRandom(3),
    )
    if (opened === null || opened.kind === 2) throw new Error('도루 판이 안 열렸다')
    return { kind: 'arrival' as const, opened }
  }

  it("판 중 '2' 를 누르면 그 틱에 포수가 2루로 던진다 — 키 없으면 공을 든 채 끝난다(수동 송구)", () => {
    vi.useFakeTimers()
    try {
      const 가만히 = vi.fn()
      render(<DefensePlayback runnerPlay={도루판()} onDone={가만히} />)
      끝까지(가만히)
      cleanup()

      const 눌렀다 = vi.fn()
      render(<DefensePlayback runnerPlay={도루판()} onDone={눌렀다} />)
      끝까지(눌렀다, '2')

      expect(결과(가만히).throwBase).toBe(-1)
      expect(결과(눌렀다).throwBase).toBe(2)
      expect(결과(눌렀다).log.some((line) => line.includes('사람이 2루로 송구 지시'))).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('판정 콜은 결과 메시지 0xbba 가 선 틱에 낸다 — 판 끝(onDone)보다 먼저, 한 번', () => {
    vi.useFakeTimers()
    const 울린것: number[] = []
    let 콜때끝났나: boolean | null = null
    setActiveSound({
      play: (id) => {
        울린것.push(id)
        if (id === 17 && 콜때끝났나 === null) 콜때끝났나 = 눌렀다.mock.calls.length > 0
      },
      playBgm: () => {},
      stopBgm: () => {},
      resumeBgm: () => {},
      stop: () => {},
      currentBgm: () => null,
      setVolume: () => {},
      getVolume: () => 100,
    })
    const 눌렀다 = vi.fn()
    try {
      render(<DefensePlayback runnerPlay={도루판()} onDone={눌렀다} />)
      끝까지(눌렀다, '2')
      // 키 2 로 2루에 던져 세이프(결과 9) — 종류 5 는 0x51c14 51c22 에서 곧장 17
      expect((결과(눌렀다) as { readonly resultCode?: number | null }).resultCode).toBe(9)
      expect(울린것.filter((id) => id === 17)).toHaveLength(1)
      expect(콜때끝났나).toBe(false)
    } finally {
      setActiveSound(null)
      vi.useRealTimers()
    }
  })

  it('판이 닫힌 뒤 닫힌 갱신(+0x1094)을 지나야 끝났다고 알린다 — 판 틱 수보다 늦게', () => {
    vi.useFakeTimers()
    try {
      const onDone = vi.fn()
      render(<DefensePlayback runnerPlay={도루판()} onDone={onDone} />)
      let 갱신 = 0
      for (; 갱신 < 400 && onDone.mock.calls.length === 0; 갱신 += 1) {
        act(() => void vi.advanceTimersByTime(millisecondsPerFrame()))
      }
      expect(갱신).toBeGreaterThan(결과(onDone).ticks.length)
    } finally {
      vi.useRealTimers()
    }
  })
})

const 땅볼아웃: AtBatOutcome = { kind: '아웃', detail: '땅볼아웃' }

/** 울린 번호와 그때 판이 끝났다고 알렸는지 적는 소리 포트 */
function 소리기록(onDone: ReturnType<typeof vi.fn>) {
  const 울린것: { readonly id: number; readonly 끝난뒤: boolean }[] = []
  setActiveSound({
    play: (id) => {
      울린것.push({ id, 끝난뒤: onDone.mock.calls.length > 0 })
    },
    playBgm: () => {},
    stopBgm: () => {},
    resumeBgm: () => {},
    stop: () => {},
    currentBgm: () => null,
    setVolume: () => {},
    getVolume: () => 100,
  })
  return 울린것
}

/**
 * 타구 판 · 미리 돌린 판의 판정 콜도 결과 코드가 선 **그 틱**에 난다 — b4562 의 메시지 0xbba → 0xbfbac(곧바로) → 0x509a0 →
 * 0x51a56 → 표 0xd0488. 실시간 갈래는 진행기 칸(`tickSounds`), 재생 갈래는 그림에 실린 칸(`tickSoundIds`)을 그 틱에 낸다.
 */
describe('판정 콜은 판 안의 그 틱 (결과 메시지 0xbba)', () => {
  it('실시간 타구 판 — 주자 없는 땅볼의 포스 아웃 콜 20 을 판 끝(onDone)보다 먼저 한 번 낸다', () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    const 울린것 = 소리기록(onDone)
    try {
      // CPU 수비 — 0xafa60 이 1루로 던져 타자주자를 잡는다
      render(<DefensePlayback input={{ ...타구(땅볼아웃, { first: false, second: false, third: false }), defenseIsCpu: true }} onDone={onDone} />)
      끝까지(onDone)
      expect(결과(onDone).advance.outsAdded).toBe(1)
      const 콜 = 울린것.filter(({ id }) => id === 20)
      expect(콜).toHaveLength(1)
      expect(콜[0]!.끝난뒤).toBe(false)
    } finally {
      setActiveSound(null)
      vi.useRealTimers()
    }
  })

  it('재생 갈래 — 미리 돌린 도루 판은 그림에 실린 판정 콜을 그 틱에 낸다(판을 연 자리가 아니라)', () => {
    vi.useFakeTimers()
    // 판을 열 때 앞 판에서 남은 사람 송구 키 2(+0x160)가 있던 도루 판 — 포수가 2루로 던져 세이프(결과 9 → 17)
    const result = runStealPlay({ bases: { first: true, second: false, third: false }, stealingFrom: [1], outs: 0, runAbility: 500, manualThrowBase: 2 })
    const play = { result, callSoundId: stealCallSoundIdOf(result) }
    expect(play.callSoundId).toBe(17)
    const 콜틱 = play.result.ticks.findIndex((view) => (view.tickSoundIds ?? []).includes(play.callSoundId!))
    expect(콜틱).toBeGreaterThanOrEqual(0)

    const onDone = vi.fn()
    const 울린것 = 소리기록(onDone)
    try {
      render(<DefensePlayback ticks={play.result.ticks} onDone={onDone} />)
      // 콜이 실린 그림 앞까지는 안 난다
      for (let 갱신 = 0; 갱신 < 콜틱; 갱신 += 1) act(() => void vi.advanceTimersByTime(millisecondsPerFrame()))
      expect(울린것.some(({ id }) => id === play.callSoundId)).toBe(false)
      끝까지(onDone)
      const 콜 = 울린것.filter(({ id }) => id === play.callSoundId)
      expect(콜).toHaveLength(1)
      expect(콜[0]!.끝난뒤).toBe(false)
    } finally {
      setActiveSound(null)
      vi.useRealTimers()
    }
  })
})

/**
 * 플레이 객체 +0x160 — 판이 닫힌 뒤(+0x1094 셈) 온 사람 수비 송구 키도 0x53420 → 0x533c8 → 0x588 → vt60 이 적지만, 닫힌 판에서는
 * b4660 이 안 돌고 다음 판 시작 vt18 0xb27ec 가 부르는 vt1c 0xb0edc(b0f66~b0f68)가 −1 로 지워 아무것도 넘어가지 않는다.
 */
describe('판이 닫힌 뒤 온 사람 송구 키는 다음 판으로 안 넘어간다 (+0x160 — vt1c 가 지운다)', () => {
  const 판끝까지 = (input: DefensePlayInput) => runDefensePlay(input).ticks.length + 2

  it('사람 수비 — 닫힌 갱신에 누른 \'4\' 가 있어도 결과 · 장면 칸이 안 누른 판과 같다', () => {
    vi.useFakeTimers()
    try {
      const input = 타구(땅볼아웃, { first: false, second: false, third: false })
      const 안눌렀다 = vi.fn()
      render(<DefensePlayback input={input} side="수비" onDone={안눌렀다} />)
      끝까지(안눌렀다)
      cleanup()

      const 눌렀다 = vi.fn()
      render(<DefensePlayback input={input} side="수비" onDone={눌렀다} />)
      for (let 갱신 = 0; 갱신 < 판끝까지(input); 갱신 += 1) act(() => void vi.advanceTimersByTime(millisecondsPerFrame()))
      expect(눌렀다).not.toHaveBeenCalled()
      fireEvent.keyDown(window, { key: '4' })
      끝까지(눌렀다)
      expect(결과(눌렀다).advance).toEqual(결과(안눌렀다).advance)
      expect(결과(눌렀다).scene).toEqual(결과(안눌렀다).scene)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('득점 메시지 0x13 의 함성 — 0x51fb8 머리 (홈런성이 아니면 60 · 홈런성이면 타자주자만 30)', () => {
  const 소리받기 = (울린것: number[]) => setActiveSound({
    play: (id) => void 울린것.push(id),
    playBgm: () => {},
    stopBgm: () => {},
    resumeBgm: () => {},
    stop: () => {},
    currentBgm: () => null,
    setVolume: () => {},
    getVolume: () => 100,
  })

  it('실시간 갈래 — 단타에 3루 주자가 들어오는 틱에 60 을 낸다(30 은 없다)', () => {
    vi.useFakeTimers()
    const 울린것: number[] = []
    소리받기(울린것)
    try {
      const onDone = vi.fn()
      render(<DefensePlayback input={타구(단타, 주자3루)} onDone={onDone} />)
      for (let i = 0; i < 400 && onDone.mock.calls.length === 0; i += 1) act(() => void vi.advanceTimersByTime(millisecondsPerFrame()))
      expect(결과(onDone).advance.runsScored).toBeGreaterThan(0)
      expect(울린것).toContain(60)
      expect(울린것).not.toContain(30)
    } finally {
      setActiveSound(null)
      vi.useRealTimers()
    }
  })

  it('재생 갈래 홈런 — 3루 주자 홈인은 소리 없고 타자주자(칸 0) 홈인에 30 한 번', async () => {
    const { homeRunPlaybackOf } = await import('@/features/defense-play/model/homeRunPlayback')
    const 홈런 = homeRunPlaybackOf({ outcome: { kind: '홈런', bases: 4 } as AtBatOutcome, bases: 주자3루 })!
    const 머리 = 홈런.ticks[홈런.ticks.length - 1]!
    const 홈 = basePosition(0)
    const last = { ...머리, runners: 머리.runners.map((runner) => ({ ...runner, x: 홈.x, z: 홈.z })) }
    const ticks = [...홈런.ticks, ...Array.from({ length: 62 }, () => last)]
    vi.useFakeTimers()
    const 울린것: number[] = []
    소리받기(울린것)
    try {
      const onDone = vi.fn()
      render(<DefensePlayback ticks={ticks} onDone={onDone} />)
      for (let i = 0; i < 400 && onDone.mock.calls.length === 0; i += 1) act(() => void vi.advanceTimersByTime(millisecondsPerFrame()))
      expect(울린것.filter((id) => id === 30 || id === 60)).toEqual([30])
    } finally {
      setActiveSound(null)
      vi.useRealTimers()
    }
  })
})

describe('수비 재생 — 공용 창이 서면 판이 멈춘다 (경기 장면 0x52c50 의 52cc6)', () => {
  afterEach(() => {
    // 화면을 먼저 내려야 장면 셈이 0 으로 돌아온다(밖의 `cleanup` 은 이 뒤에 돈다)
    cleanup()
    resetCommonWindowShownForTest()
  })

  /** 끝날 때까지 흘린 갱신 수 — `창` 을 주면 `창.at` 번째 갱신 뒤에 창을 세우고 `창.frames` 갱신 동안 둔다 */
  function 끝난갱신(input: DefensePlayInput, 창?: { readonly at: number; readonly frames: number; readonly key?: string }): {
    readonly updates: number
    readonly onDone: ReturnType<typeof vi.fn>
  } {
    const onDone = vi.fn()
    render(<DefensePlayback input={input} side="수비" onDone={onDone} />)
    let updates = 0
    for (let i = 0; i < 400 && onDone.mock.calls.length === 0; i += 1) {
      if (창 !== undefined && i === 창.at) {
        const release = markCommonWindowShown()
        for (let frozen = 0; frozen < 창.frames; frozen += 1) {
          if (창.key !== undefined) fireEvent.keyDown(window, { key: 창.key })
          act(() => void vi.advanceTimersByTime(millisecondsPerFrame()))
        }
        // 창이 떠 있는 동안은 판이 끝나지 않는다
        expect(onDone).not.toHaveBeenCalled()
        act(() => release())
      }
      act(() => void vi.advanceTimersByTime(millisecondsPerFrame()))
      updates += 1
    }
    return { updates, onDone }
  }

  it('창이 떠 있는 동안 진행기 틱이 안 돌고, 닫히면 건너뛴 틱을 따라잡지 않고 이어 돈다', () => {
    vi.useFakeTimers()
    try {
      const input = 타구(단타, 주자1루)
      const 그냥 = 끝난갱신(input)
      cleanup()
      const 멈춤 = 끝난갱신(input, { at: 10, frames: 200 })
      // 창 밖 갱신 수가 같다 — 멈춘 200 갱신은 판에 안 든다
      expect(멈춤.updates).toBe(그냥.updates)
      expect(결과(멈춤.onDone).log).toEqual(결과(그냥.onDone).log)
    } finally {
      vi.useRealTimers()
    }
  })

  it("창이 떠 있는 동안 누른 키는 판이 안 받는다 — 키는 창(0x754f9)이 가져가고 0x498d4 는 안 돈다", () => {
    vi.useFakeTimers()
    try {
      const input = 타구(단타, 주자1루)
      const 멈춤 = 끝난갱신(input, { at: 3, frames: 30, key: '2' })
      expect(결과(멈춤.onDone).log.some((line) => line.includes('사람이 2루로 송구 지시'))).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('수비 판도 경기 장면이라고 센다 — 타석 화면이 내려가고 이 판만 서도 장면 객체가 안 내려간다(0x3874 new 는 장면 전환 때뿐)', async () => {
    let up = 0
    let leaves = 0
    // 앱(`App` 의 markGameScene)처럼 — 한 커밋 안의 내림 · 올림이 끝난 뒤(마이크로태스크)에도 0 일 때만 장면 객체를 내린다
    const mark = (isUp: boolean) => {
      up += isUp ? 1 : -1
      if (!isUp && up === 0) {
        queueMicrotask(() => {
          if (up === 0) leaves += 1
        })
      }
    }
    function 타석(): null {
      useMarksGameScene()
      return null
    }
    const { rerender } = render(
      <GameSceneMarkContext.Provider value={mark}>
        <타석 />
      </GameSceneMarkContext.Provider>,
    )
    expect(up).toBe(1)
    rerender(
      <GameSceneMarkContext.Provider value={mark}>
        <DefensePlayback ticks={[틱(), 틱()]} onDone={() => {}} />
      </GameSceneMarkContext.Provider>,
    )
    await Promise.resolve()
    // 타석 화면이 내려가도 수비 판이 같은 커밋에 서서 장면 객체(+0xfd4 · 파티클 관리자)를 안 내린다
    expect(up).toBe(1)
    expect(leaves).toBe(0)
    cleanup()
    await Promise.resolve()
    expect(up).toBe(0)
    expect(leaves).toBe(1)
  })
})
