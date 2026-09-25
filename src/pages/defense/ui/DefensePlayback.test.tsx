// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { DefensePlayback } from '@/pages/defense/ui/DefensePlayback'
import type { DefenseViewState } from '@/pages/defense/lib/defenseView'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import { representativePatternOf } from '@/features/defense-play/model/representativePattern'
import { runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import type { DefensePlayInput, DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import type { BaseState } from '@/entities/game/model/baseState'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'
import { setActiveSound } from '@/shared/api/audio/soundPort'
import type { RandomPort } from '@/shared/api/random/randomPort'

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
   * **펌블 소리 53** (야수 동작 0xd 를 거는 0xa1e60).
   * 굴림은 진행기가 하지만 소리는 **틱을 도는 이 화면**이 낸다 — 플레이 끝에 몰아서 내면
   * 아웃 콜(0x51b36)을 덮기 때문이다.
   */
  it('펌블이 난 그 틱에 53 을 한 번만 낸다 (0xb41d0 → 동작 0xd, 0xa1e60)', () => {
    vi.useFakeTimers()
    const 울린것: number[] = []
    setActiveSound({
      play: (id) => void 울린것.push(id),
      playBgm: () => {},
      stopBgm: () => {},
      resumeBgm: () => {},
      currentBgm: () => null,
      setVolume: () => {},
      getVolume: () => 100,
    })
    try {
      // 굴림이 늘 0 을 내는 난수 — 펌블 기준(만분율)보다 작아 **반드시** 펌블이 난다
      const 늘0: RandomPort = { next: () => 0, nextInRange: (minimum) => minimum, pick: (c) => c[0] }
      const onDone = vi.fn()
      render(<DefensePlayback input={{ ...타구(단타, 주자1루), random: 늘0 }} onDone={onDone} />)
      끝까지(onDone)

      expect(결과(onDone).fumbled).toBe(true)
      expect(울린것.filter((id) => id === 53)).toEqual([53])
    } finally {
      setActiveSound(null)
      vi.useRealTimers()
    }
  })

  it('펌블이 없으면 53 을 내지 않는다 — 난수를 안 주면 굴림 자체가 안 돈다', () => {
    vi.useFakeTimers()
    const 울린것: number[] = []
    setActiveSound({
      play: (id) => void 울린것.push(id),
      playBgm: () => {},
      stopBgm: () => {},
      resumeBgm: () => {},
      currentBgm: () => null,
      setVolume: () => {},
      getVolume: () => 100,
    })
    try {
      const onDone = vi.fn()
      render(<DefensePlayback input={타구(단타, 주자1루)} onDone={onDone} />)
      끝까지(onDone)

      expect(결과(onDone).fumbled).toBe(false)
      expect(울린것).not.toContain(53)
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
