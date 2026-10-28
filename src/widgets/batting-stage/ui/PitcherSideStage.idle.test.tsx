// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StageScene } from '@/widgets/batting-stage/lib/renderBattingStage'
import type { PitchInputOverlay } from '@/widgets/batting-stage/lib/pitchInputOverlay'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { resetCommonWindowShownForTest } from '@/shared/lib/commonWindow/commonWindow'
import { resetSceneParticlesForTest } from '@/widgets/particles/model/sceneParticles'
import { resetSceneCloudClock } from '@/widgets/batting-stage/model/sceneCloudClock'
import { pitcherAnimationAt } from '@/widgets/batting-stage/lib/stageScenery'

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

const 구질목록 = (pitcherIdlePress: number): PitchInputOverlay => ({
  kind: '구질',
  typeNumbers: [1, 0, 0, 0, 0, 0],
  magicRemaining: 0,
  tick: 0,
  pitcherIdlePress,
})

/** 마지막 그림의 투수 그림 객체 상태 (0x9e0b8 이 보는 +0x14 · +0x1c) */
const 투수 = () => {
  const scene = 그린장면[그린장면.length - 1]
  return pitcherAnimationAt({
    pitchTick: scene.pitcherTick,
    pitchEndTick: scene.pitcherTickEnd ?? null,
    idleTick: scene.pitcherIdleTick ?? null,
    idleEndTick: scene.pitcherIdleTickEnd ?? null,
  })
}

describe("'#' 교체 길의 투수 대기 동작 (0xf → 0xb → 0xe → 0xf)", () => {
  it('0xb · 0xe 동안 그 단계에 굳고, 다음 0xf 진입에 상태 0 — 그 0xf 의 첫 빈 칸 키는 다시 한 바퀴다', () => {
    const inputOverlayRef: { current: PitchInputOverlay | null } = { current: 구질목록(0) }
    const { rerender } = render(<PitcherSideStage {...기본} isPaused={false} inputOverlayRef={inputOverlayRef} sceneDEntryMark={1} />)
    그림(2)
    // 0xf — 빈 칸 키 한 번(0x50de8 → 상태 2)
    inputOverlayRef.current = 구질목록(1)
    그림(3)
    expect(투수().state).toBe(2)
    const 굳은단계 = 투수().step

    // '#' → 0xb 교체 창: 구질 목록 부품이 내려가고 장면은 쉰다 — 0x9e004 가 안 불려 그 단계에 굳는다
    inputOverlayRef.current = null
    rerender(<PitcherSideStage {...기본} isPaused isSubstitutionWindowOpen inputOverlayRef={inputOverlayRef} sceneDEntryMark={1} />)
    그림(20)
    expect(투수()).toEqual({ state: 2, step: 굳은단계 })
    // '#' · CLR → 곧장 0xe(0x4984a) — 0xd 가 없어 표지가 그대로라 계속 굳어 있다
    rerender(<PitcherSideStage {...기본} isPaused inputOverlayRef={inputOverlayRef} sceneDEntryMark={1} />)
    그림(20)
    expect(투수()).toEqual({ state: 2, step: 굳은단계 })

    // OK → 0xf 진입 0x3d954 — 상태 0. 새 구질 목록 부품의 누름 표지는 0 부터다
    inputOverlayRef.current = 구질목록(0)
    rerender(<PitcherSideStage {...기본} isPaused={false} inputOverlayRef={inputOverlayRef} sceneDEntryMark={1} />)
    그림(2)
    expect(투수()).toEqual({ state: 0, step: 0 })
    // 이 0xf 의 첫 빈 칸 키(표지 1 — 앞 0xf 의 표지와 같은 수)도 대기 동작을 건다
    inputOverlayRef.current = 구질목록(1)
    그림(2)
    expect(투수().state).toBe(2)
  })
})
