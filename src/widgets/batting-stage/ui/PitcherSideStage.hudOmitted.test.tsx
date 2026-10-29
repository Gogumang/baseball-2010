// @vitest-environment happy-dom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StageScene } from '@/widgets/batting-stage/lib/renderBattingStage'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { resetCommonWindowShownForTest } from '@/shared/lib/commonWindow/commonWindow'
import { resetSceneParticlesForTest } from '@/widgets/particles/model/sceneParticles'
import { resetSceneCloudClock } from '@/widgets/batting-stage/model/sceneCloudClock'

/**
 * **'#' 교체 길(0xf → 0xb → 0xe → 0xf)의 투수 대기 동작** — 원본 투수 그림 갱신 0x9e004 는 0xf 갱신 0x39c1c · 0x11 갱신 0x4e060 만
 * 부른다. 0xf 에서 빈 칸 키(0x50de8 → 9dff8(…, 2))로 대기 동작 중 '#'(0x499f4)를 누르면 0xb(갱신 칸 없음) → '#' · CLR(0x4984a) →
 * 곧장 0xe 동안 그 단계에 굳고(0xd 진입 0x48d50 이 없어 상태 0 으로 안 돌아간다), OK 뒤 0xf 진입 0x3d954 → 0x35650 → 0x340c0 이
 * 상태 0 으로 되돌린다. 다음 빈 칸 키는 다시 한 바퀴다.
 */
const 그린장면: StageScene[] = []
vi.mock('@/widgets/batting-stage/lib/renderBattingStage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/widgets/batting-stage/lib/renderBattingStage')>()
  return { ...actual, renderBattingStage: (_context: CanvasRenderingContext2D, scene: StageScene) => void 그린장면.push(scene) }
})

const { PitcherSideStage } = await import('@/widgets/batting-stage/ui/PitcherSideStage')
const { renderBattingStage: 진짜그리기 } = await vi.importActual<typeof import('@/widgets/batting-stage/lib/renderBattingStage')>(
  '@/widgets/batting-stage/lib/renderBattingStage',
)

let frames = new Map<number, FrameRequestCallback>()
let nextHandle = 1
let clock = 0
let 그림번호 = 0
beforeEach(() => {
  frames = new Map()
  clock = 0
  그림번호 = 0
  그린장면.length = 0
  vi.spyOn(performance, 'now').mockImplementation(() => clock)
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    const handle = nextHandle
    nextHandle += 1
    frames.set(handle, callback)
    return handle
  })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((handle) => void frames.delete(handle))
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    return new Proxy({ canvas: this } as object, {
      get: (target, key) => (key in target ? (target as Record<string | symbol, unknown>)[key] : () => undefined),
      set: () => true,
    }) as never
  })
  resetSceneParticlesForTest()
  resetCommonWindowShownForTest()
  resetSceneCloudClock()
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const 간격 = millisecondsPerFrame() + 0.37
const 그림 = (count = 1) => {
  for (let index = 0; index < count; index += 1) {
    act(() => {
      그림번호 += 1
      clock = 그림번호 * 간격
      const pending = [...frames.values()]
      frames = new Map()
      for (const callback of pending) callback(clock)
    })
  }
}

const 기본 = {
  resultTicks: 15,
  hud: null,
  batterForm: 0,
  batterSkinIndex: 0,
  batterTeamIndex: 0,
  batterSide: 0,
  pitcherForm: 0,
  pitcherHand: 0,
  stadium: 0,
  fieldPalette: null,
  skyRow: 0,
  gameMode: 3,
  pitch: null,
  resolution: null,
} as const

const HUD = {
  inning: 3,
  half: '초',
  ourScore: 1,
  opponentScore: 2,
  balls: 1,
  strikes: 2,
  outs: 1,
  bases: { first: true, second: false, third: false },
  ourLogoUrl: '',
  opponentLogoUrl: '',
  ourTeamId: 3,
  opponentTeamId: 7,
} as const

/** 그라디언트 · 글자 재기 따위가 돌려주는 값 — 무엇을 물어도 받아 준다 */
const 아무것: unknown = new Proxy(() => undefined, {
  get: (_target, key) => (key === 'width' || key === 'height' ? 1 : key === 'data' ? new Uint8ClampedArray(4) : 아무것),
  apply: () => 아무것,
})

/** 진짜 그리기를 기록하는 맥락으로 돌려 부른 그리기 함수 이름들 */
const 부른그리기 = (scene: StageScene): string[] => {
  const calls: string[] = []
  const context = new Proxy({ canvas: { width: 240, height: 320 } } as object, {
    get: (target, key) => {
      if (key in target) return (target as Record<string | symbol, unknown>)[key]
      return (...args: unknown[]) => {
        calls.push(`${String(key)}:${args.slice(0, 4).join(',')}`)
        return 아무것
      }
    },
    set: () => true,
  }) as unknown as CanvasRenderingContext2D
  진짜그리기(context, scene)
  return calls
}

describe('HUD 를 안 그리는 상태 0x1b · 0x23 (0x4a198 · 0x50828)', () => {
  it('isHudOmitted 가 장면 omitsHud 로 가고, 그 그림은 HUD 몫만 빠진다', () => {
    const { rerender } = render(<PitcherSideStage {...기본} hud={HUD} isPaused={false} sceneDEntryMark={1} />)
    그림(3)
    const 보통 = 그린장면[그린장면.length - 1]
    expect(보통.omitsHud).toBe(false)
    rerender(<PitcherSideStage {...기본} hud={HUD} isPaused={false} isHudOmitted sceneDEntryMark={1} />)
    그림(1)
    const 창 = 그린장면[그린장면.length - 1]
    expect(창.omitsHud).toBe(true)
    // 같은 그림을 HUD 만 바꿔 그려 본다 — 빠지는 몫이 있고, 남는 몫(구장 · 투수 · 타자 · 주자)은 그대로 앞부분이다
    const 다그림 = 부른그리기({ ...보통, omitsHud: false })
    const 뺀그림 = 부른그리기({ ...보통, omitsHud: true })
    expect(뺀그림.length).toBeLessThan(다그림.length)
    expect(다그림.slice(0, 뺀그림.length - 1)).toEqual(뺀그림.slice(0, 뺀그림.length - 1))
  })
})
