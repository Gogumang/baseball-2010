// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StageScene } from '@/widgets/batting-stage/lib/renderBattingStage'
import type { Pitch } from '@/entities/pitching/model/pitch'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { resetCommonWindowShownForTest } from '@/shared/lib/commonWindow/commonWindow'
import { resetSceneParticlesForTest } from '@/widgets/particles/model/sceneParticles'
import { resetSceneCloudClock } from '@/widgets/batting-stage/model/sceneCloudClock'
import type { PitcherHitScene } from '@/widgets/batting-stage/lib/pitcherSideStage'
import { HUMAN_PITCH_RELEASE_STATE_TICK } from '@/widgets/batting-stage/lib/pitcherSideStage'
import { PITCHER_RELEASE_TICKS } from '@/widgets/batting-stage/lib/stageScenery'
import { HIT_STOP_TICKS } from '@/widgets/batting-stage/lib/hitPause'

/**
 * **사람 투구 장면(`PitcherSideStage`)의 0x11 · 0x13 연출** — 타자편 타석(`useStageAnimation`)과 같은 그리기 부품을 같은 재료로 탄다:
 * 마구 공 파티클(0x3b2f4 3b496) · 필살 스윙 그림 · 파티클(0x49aec) · 큰 타구 0x13 꼬리(0x4cb1c) · 투수 홈런 갈래(0x3908a).
 */
const 그린장면: StageScene[] = []
vi.mock('@/widgets/batting-stage/lib/renderBattingStage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/widgets/batting-stage/lib/renderBattingStage')>()
  return { ...actual, renderBattingStage: (_context: CanvasRenderingContext2D, scene: StageScene) => void 그린장면.push(scene) }
})
const catalog = JSON.parse(readFileSync('public/sprites/ptcimg/particles.json', 'utf8')) as {
  emitters: { callId: number; callable: boolean }[]
}
vi.mock('@/widgets/particles/lib/particleCatalog', () => ({
  particleConfigOf: (callId: number) => catalog.emitters.find((entry) => entry.callId === callId && entry.callable) ?? null,
}))
const 쏜것: { callId: number; img: number; y: number }[] = []
vi.mock('@/entities/particle/model/particleScene', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/entities/particle/model/particleScene')>()
  return {
    ...actual,
    emitParticles: (...args: Parameters<typeof actual.emitParticles>) => {
      const config = args[1] as { callId?: number } | null
      쏜것.push({ callId: config?.callId ?? -1, img: args[4], y: args[3] })
      return actual.emitParticles(...args)
    },
  }
})

const { PitcherSideStage } = await import('@/widgets/batting-stage/ui/PitcherSideStage')

let frames = new Map<number, FrameRequestCallback>()
let nextHandle = 1
let clock = 0
beforeEach(() => {
  frames = new Map()
  clock = 0
  그린장면.length = 0
  쏜것.length = 0
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

const 간격 = millisecondsPerFrame() / 4 + 0.37
let 그림번호 = 0
const 그림 = () =>
  act(() => {
    그림번호 += 1
    clock = 그림번호 * 간격
    const pending = [...frames.values()]
    frames = new Map()
    for (const callback of pending) callback(clock)
  })

const 공: Pitch = {
  type: '마구',
  plate: { x: 0, y: 0 },
  breakOffset: { x: 0, y: 0 },
  flightDurationMilliseconds: 600,
  frameCount: 20,
  controlTier: -1,
  worldPath: null,
  stageSide: 0,
  isMagicPitch: true,
  pitcherMagicNumber: 2,
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
  isPaused: false,
} as const

/** 큰 타구(감상 플래그) 홈런성 코드 24 · 필살 번호 1 (파워 스윙) — 판정 공 틱 16 */
const 맞은장면: PitcherHitScene = {
  judgeBallTick: 16,
  ticks: 20,
  skipTick: null,
  watchesBigHit: true,
  particleId: 5,
  contactFrame: 15,
  resultCode: 24,
  specialSwing: { number: 1, isAceBatter: false },
}

describe('사람 투구 장면의 0x11 · 0x13 연출 (타자편과 같은 부품)', () => {
  it('마구 번호 2 — 놓은 틱부터 0x11 그림마다 id 0x15 · img 15 를 한 번씩, 0x12 에서는 안 쏜다', () => {
    const { rerender } = render(<PitcherSideStage {...기본} pitch={null} resolution={null} />)
    그림()
    rerender(<PitcherSideStage {...기본} pitch={공} resolution={{ kind: '볼' }} />)
    for (let index = 0; index < 300; index += 1) 그림()
    const 마구 = 쏜것.filter((call) => call.callId === 0x15)
    expect(마구.every((call) => call.img === 15)).toBe(true)
    // 놓은 틱(0x11 틱 10)부터 공 틱 N + 1 까지가 0x11 — 그림(장면 틱) 하나에 한 번
    const 투구틱 = new Set(그린장면.filter((scene) => scene.stagePhase?.kind === '투구중').map((scene) => scene.tick))
    expect(마구.length).toBe(투구틱.size)
    expect(마구.length).toBe(PITCHER_RELEASE_TICKS - HUMAN_PITCH_RELEASE_STATE_TICK + 공.frameCount + 2)
  })

  it('CPU 필살 스윙으로 맞은 공 — 판정 틀에 보통 불꽃 대신 필살 파티클 · 그림, 0x13 은 큰 타구 꼬리 · 투수 홈런 갈래 재료', () => {
    const 직구: Pitch = { ...공, type: '직구', isMagicPitch: false, pitcherMagicNumber: 0 }
    const { rerender } = render(<PitcherSideStage {...기본} pitch={null} resolution={null} />)
    그림()
    const onHitSceneEnd = vi.fn()
    rerender(
      <PitcherSideStage
        {...기본}
        pitch={직구}
        resolution={{ kind: '타구', outcome: { kind: '홈런' } } as never}
        cpuSwing={{ frame: 15, buntKind: 0 }}
        hitScene={맞은장면}
        onHitSceneEnd={onHitSceneEnd}
      />,
    )
    for (let index = 0; index < 400; index += 1) 그림()
    // 파워 스윙 — 002.ptc(id 1, img 6) 한 번 · 보통 불꽃(id 5)은 없다
    expect(쏜것.filter((call) => call.callId === 1)).toEqual([expect.objectContaining({ img: 6 })])
    expect(쏜것.some((call) => call.callId === 5)).toBe(false)
    // 필살 그림 — 판정 틀(0x11)에 첫 부름, 0x13 틱 d 는 d + 2 번째
    const 판정틀 = 그린장면.find((scene) => scene.specialSwingEffect?.drawCall === 1)
    expect(판정틀?.stagePhase?.kind).toBe('투구중')
    const 타격 = 그린장면.filter((scene) => scene.stagePhase?.kind === '타격')
    expect(타격.length).toBeGreaterThan(0)
    for (const scene of 타격) {
      const tick = scene.stagePhase?.kind === '타격' ? scene.stagePhase.tick : -1
      expect(scene.specialSwingEffect?.drawCall).toBe(tick + 2)
      // 0x4cb1c 꼬리 — 틱 0~7 멈춤 갈래, 그 뒤 뒤 갈래
      expect(scene.bigHitScreen?.kind).toBe(tick <= HIT_STOP_TICKS ? '멈춤' : '뒤')
      // 0x3908a — 판정 0x6aa 가 쓴 코드 24 · 감상 플래그
      expect(scene.pitcherHitMark).toEqual({
        codeBeforePitch: 0,
        judgedTick: PITCHER_RELEASE_TICKS + 맞은장면.judgeBallTick,
        judgedCode: 24,
        isBigHit: true,
      })
    }
    expect(onHitSceneEnd).toHaveBeenCalledTimes(1)
  })
})
