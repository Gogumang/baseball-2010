// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { HomeRunDerbyScreen } from '@/pages/home-run-derby/ui/HomeRunDerbyScreen'
import { TeamGameScreen } from '@/pages/team-game/ui/TeamGameScreen'
import { BattingStage } from '@/widgets/batting-stage/ui/BattingStage'
import { ROOKIE_BATTER_ABILITY } from '@/entities/batting/model/batter'
import { DEFAULT_PITCHER_ABILITY } from '@/entities/pitching/model/pitch'
import { SCENE_EFFECT_INIT_ROLL_COUNT } from '@/entities/batting/model/battedBallOutcome'
import { PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * **경기 장면 진입 굴림 차례 — 화면째로** (r232). 세션 시험은 장면 시작 굴림 함수만 보므로, 화면 안의 자식(타석 그림
 * `useStageAnimation`)이 부모 세션의 장면 시작 효과보다 **먼저** 도는 굴림을 못 잡는다(r231 — 홈런더비 첫 장면의 대체 하늘 줄
 * rand(0, 6) 이 로딩 팁 앞에 끼었다). 원본 차례(R10 · 0x39f88 · 0x3e340 · 0x3f584 · 0x48658):
 * ```
 * (7 진입 0x39f88 → 0x53dbc)  팁 rand(0, 73)
 * (7 갱신 0x3e340)            3ed76 덱 0xb08e8 1275 → 3ef6e 효과 0x90190 1202 (첫 굴림 rand(1, 3))
 * (9 갱신 0x3f584)            [더비 3a454 rand(0, 9) · 3a476/3a496 구장(내 팀 > 9 면 rand(0, 10) 둘)] → 3fa0e 0xc0dac rand(0, 2)
 * (8 갱신 0x48658)            48774 → 0x352e8(354d2) → 0x783b0 — 모드 5 · 6 · 7 만 rand(0, 6), 그 밖(0→1 · 1 · 2 · 3 · 4 · 8 · 9)은 굴림 없음
 *                             (0x783b0 만 보면 모드 0 도 rand 갈래지만, 장면 9 의 0x39fdc 3a066~3a072 가 앞서 모드 0 을 1 로 바꾼다)
 * ```
 */

/** 0xb08e8 덱 섞기 — 코드 0~26 의 패턴 수 합(21~23 은 0장) */
const DECK_ROLLS = 1275

interface Roll {
  readonly lo: number
  readonly hi: number
}

/** 시드 난수를 그대로 굴리며 부른 차례를 남긴다 */
const recordingRandom = (seed: number): { random: RandomPort; rolls: Roll[] } => {
  const base = createSeededRandom(seed)
  const rolls: Roll[] = []
  return {
    rolls,
    random: {
      rand: (lo, hi) => {
        rolls.push({ lo, hi })
        return base.rand(lo, hi)
      },
      rand9d: (n) => {
        if (n > 0) rolls.push({ lo: -9, hi: n })
        return base.rand9d(n)
      },
    },
  }
}

// 로딩 판은 그리자마자 끝낸다(상태 7 · 9 · 8 적재를 다 그린 꼴) — 굴림 차례와 무관하다
vi.mock('@/widgets/loading-tip/ui/LoadingTip', async () => {
  const { useEffect, useRef } = await import('react')
  return {
    LoadingTip: ({ onDone }: { onDone: () => void }) => {
      // 올릴 때 한 번만
      const done = useRef(false)
      useEffect(() => {
        if (done.current) return
        done.current = true
        onDone()
      }, [onDone])
      return null
    },
  }
})

// 그리기는 막는다 — 타석 그림 효과는 컨텍스트가 있어야 끝까지 서므로 아무 일도 안 하는 붓을 준다
vi.mock('@/widgets/batting-stage/lib/renderBattingStage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/widgets/batting-stage/lib/renderBattingStage')>()
  return { ...actual, renderBattingStage: () => {}, renderSettlementLayer: () => {} }
})

beforeEach(() => {
  // 그림 콜백은 걸기만 하고 돌리지 않는다 — 진입(붙는 그림)의 굴림만 본다
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1)
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
  // 그라디언트 같은 돌려받는 붓 객체도 아무 일도 안 하는 붓이다
  const noopBrush = (target: object): object =>
    new Proxy(target, {
      get: (held, key) => (key in held ? (held as Record<string | symbol, unknown>)[key] : () => noopBrush({})),
      set: () => true,
    })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    return noopBrush({ canvas: this }) as never
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

/** 팁 · 덱 · 효과 — 모든 모드의 장면 시작 머리 (1 + 1275 + 1202 굴림) */
const expectSceneHead = (rolls: readonly Roll[]) => {
  expect(rolls[0]).toEqual({ lo: 0, hi: 73 })
  // 덱 섞기는 늘 rand(0, n) 이다
  expect(rolls.slice(1, 1 + DECK_ROLLS).every((roll) => roll.lo === 0 && roll.hi > 0)).toBe(true)
  expect(rolls[1 + DECK_ROLLS]).toEqual({ lo: 1, hi: 3 })
}
const HEAD = 1 + DECK_ROLLS + SCENE_EFFECT_INIT_ROLL_COUNT

describe('경기 장면 진입 굴림 차례 — 화면째로 (r232)', () => {
  it('홈런더비(모드 7): 팁 → 덱 1275 → 효과 1202 → 상대 팀 rand(0, 9) → rand(0, 2) → 하늘 줄 rand(0, 6), 그 앞에 다른 굴림이 없다', () => {
    const { random, rolls } = recordingRandom(1)
    render(<HomeRunDerbyScreen ability={ROOKIE_BATTER_ABILITY} random={random} bestDistance={0} gamePoint={0} onExit={vi.fn()} />)
    expectSceneHead(rolls)
    // 내 팀(저장 없음 0)은 9 이하라 구장 굴림이 없다
    expect(rolls.slice(HEAD, HEAD + 3)).toEqual([
      { lo: 0, hi: 9 },
      { lo: 0, hi: 2 },
      { lo: 0, hi: 6 },
    ])
    // 첫 공 앞(0xe 대기) — 붙는 그림이 더 굴리지 않는다
    expect(rolls).toHaveLength(HEAD + 3)
  })

  // 일반모드는 상태 22 진입(0x30f20 — 마선수 둘 · 선발 둘)이 경기정보에서 이미 굴려 넘긴다(`rollTeamSetup` → `teamSetupRolls`).
  // 시즌은 마선수를 경기 전 창이 굴리고 선발은 날짜로 정한다 — 둘 다 장면에 들어와서는 안 굴린다
  it.each([
    { mode: 1, label: '일반모드', setup: { opponentAces: { pitcher: -1, batter: -1 }, startingPitcherSlots: { opponent: 0, ours: 0 } } },
    { mode: 2, label: '시즌', setup: {} },
  ])('팀 경기 $label(모드 $mode): 팁 → 덱 → 효과 → rand(0, 2) — 하늘 줄 굴림이 없다', ({ mode, setup }) => {
    vi.useFakeTimers()
    const { random, rolls } = recordingRandom(20100901)
    render(
      <TeamGameScreen
        options={{
          mode,
          ourTeamId: 0,
          opponentTeamId: 1,
          playerSide: PLAYER_SIDE_LAST_BAT,
          season: { illness: 0, morale: 100, coach: -1 },
          ...setup,
        }}
        random={random}
        onFinish={vi.fn()}
        onQuit={vi.fn()}
      />,
    )
    act(() => {})
    expectSceneHead(rolls)
    expect(rolls[HEAD]).toEqual({ lo: 0, hi: 2 })
    expect(rolls.slice(HEAD + 1).some((roll) => roll.lo === 0 && roll.hi === 6)).toBe(false)
  })

  it('타석 그림은 하늘 줄을 못 받아도 붙을 때 굴리지 않는다 (0x783b0 의 rand(0, 6) 은 장면 적재에서만)', () => {
    const { random, rolls } = recordingRandom(7)
    render(
      <BattingStage
        batterAbility={ROOKIE_BATTER_ABILITY}
        pitcherAbility={DEFAULT_PITCHER_ABILITY}
        isEagleEyeEnabled={false}
        hud={null}
        acePitcher={null}
        isPaused
        random={random}
        onPitchResolved={vi.fn()}
      />,
    )
    expect(rolls).toEqual([])
  })
})
