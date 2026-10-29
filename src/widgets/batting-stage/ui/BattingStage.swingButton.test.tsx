// @vitest-environment happy-dom
import { readFileSync } from 'node:fs'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { markGameSceneUp, resetCommonWindowShownForTest } from '@/shared/lib/commonWindow/commonWindow'
import { resetTouchKeyOffersForTest, touchKeyOffersNow } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import { DEFAULT_PITCHER_ABILITY } from '@/entities/pitching/model/pitch'
import type { Pitch } from '@/entities/pitching/model/pitch'
import { ROOKIE_BATTER_ABILITY } from '@/entities/batting/model/batter'
import { resetSceneParticlesForTest } from '@/widgets/particles/model/sceneParticles'
import { resetSceneResultCode } from '@/widgets/batting-stage/model/sceneResultCodeStore'
import { resetSceneCloudClock } from '@/widgets/batting-stage/model/sceneCloudClock'
import { TouchControls } from '@/widgets/touch-controls/ui/TouchControls'

/**
 * **터치 스윙 버튼 '5'** (10-29 사용자 결정 — 아이폰 Safari 에서 타석 화면 탭이 안 먹는다는 신고).
 * 타석이 키를 받는 동안만 뜨고, 버튼으로 친 스윙은 **화면 탭과 같은 판정 틱**이다 — 둘 다 손가락이 닿은 시각에 보이던 그림의 틱으로 센다
 * (`shownSceneTicks` · 버튼은 `TouchControls` 가 누른 시각을 키에 붙인다).
 */
const drawn: { frame: number; pitch: Pitch | null }[] = []
vi.mock('@/widgets/batting-stage/lib/renderBattingStage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/widgets/batting-stage/lib/renderBattingStage')>()
  return {
    ...actual,
    renderBattingStage: (_context: CanvasRenderingContext2D, scene: { frame: number; pitch: Pitch | null }) =>
      void drawn.push({ frame: scene.frame, pitch: scene.pitch }),
    renderSettlementLayer: () => {},
  }
})
const catalog = JSON.parse(readFileSync('public/sprites/ptcimg/particles.json', 'utf8')) as {
  emitters: { callId: number; callable: boolean }[]
}
vi.mock('@/widgets/particles/lib/particleCatalog', () => ({
  particleConfigOf: (callId: number) => catalog.emitters.find((entry) => entry.callId === callId && entry.callable) ?? null,
}))
const judged: { frame: number }[] = []
vi.mock('@/features/play-at-bat/model/resolvePitch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/play-at-bat/model/resolvePitch')>()
  return {
    ...actual,
    resolvePitch: (...args: Parameters<typeof actual.resolvePitch>) => {
      const [, swing] = args
      if (swing !== null) judged.push({ frame: swing.frame })
      return actual.resolvePitch(...args)
    },
  }
})

const { BattingStage } = await import('@/widgets/batting-stage/ui/BattingStage')

let frames = new Map<number, FrameRequestCallback>()
let nextHandle = 1
let clock = 0
/** 판 · 시계 · 기록을 처음으로 — 한 시험에서 두 번 띄울 때도 쓴다 */
const 새판 = () => {
  frames = new Map()
  clock = 0
  drawn.length = 0
  judged.length = 0
  resetSceneParticlesForTest()
  resetSceneResultCode()
  resetCommonWindowShownForTest()
  resetSceneCloudClock()
  resetTouchKeyOffersForTest()
}
beforeEach(() => {
  새판()
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
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const 타석 = (props: { isPaused?: boolean; isResultBackdrop?: boolean } = {}, seed = 20101027) => (
  <>
    <BattingStage
      batterAbility={ROOKIE_BATTER_ABILITY}
      pitcherAbility={DEFAULT_PITCHER_ABILITY}
      isEagleEyeEnabled={false}
      hud={null}
      acePitcher={null}
      isPaused={props.isPaused ?? false}
      {...(props.isResultBackdrop === true ? { isResultBackdrop: true } : {})}
      skyRow={2}
      random={createSeededRandom(seed)}
      onPitchResolved={vi.fn()}
    />
    <TouchControls layout="below" />
  </>
)
const 뜬키 = () => touchKeyOffersNow().map((offer) => `${offer.key}:${offer.label}`)

describe('터치 스윙 버튼 — 타석이 키를 받는 동안만', () => {
  it('타석에서 뜨고(맨 앞) · 쉬는 동안 · 결과 창 배경 · 타석이 내려가면 거둔다', () => {
    const view = render(타석())
    expect(뜬키()[0]).toBe('5:스윙')
    view.rerender(타석({ isPaused: true }))
    expect(뜬키()).not.toContain('5:스윙')
    view.rerender(타석())
    expect(뜬키()).toContain('5:스윙')
    view.rerender(타석({ isPaused: true, isResultBackdrop: true }))
    expect(뜬키()).not.toContain('5:스윙')
    view.unmount()
    expect(뜬키()).toEqual([])
  })
})

const 그림 = (at: number) =>
  act(() => {
    clock = at
    const pending = [...frames.values()]
    frames = new Map()
    for (const callback of pending) callback(at)
  })

/** 손가락 사건 — 사건 시각(`timeStamp`)을 `pressedAt` 으로. 시험 DOM 에는 PointerEvent 가 없어 MouseEvent 로 흉내 낸다 */
const 누름 = (target: Element, pressedAt: number) => {
  const event = new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 })
  Object.defineProperty(event, 'timeStamp', { value: pressedAt })
  act(() => void target.dispatchEvent(event))
}

/**
 * 공 끝 3 틱 앞 그림을 본 뒤 누르는데, 사건 손잡이가 다음 그림보다 늦게 돈다(주 스레드 막힘 — r211 의 어려운 경우).
 * `어디` 가 고른 곳(화면 · 스윙 버튼)을 눌러 판정에 들어간 키 틱 F 를 낸다
 */
const 판정틱 = (어디: (view: ReturnType<typeof render>) => Element) => {
  const 장면내림 = markGameSceneUp()
  const view = render(타석())
  const 틱 = millisecondsPerFrame()
  const 틀간격 = 틱 / 2 + 0.37
  let 본: { at: number; frame: number } | null = null
  for (let index = 1; index < 2000 && 본 === null; index += 1) {
    그림(index * 틀간격)
    const last = drawn.at(-1)
    if (last?.pitch && last.frame >= 0 && last.frame === last.pitch.frameCount - 3) 본 = { at: index * 틀간격, frame: last.frame }
  }
  if (본 === null) throw new Error('공이 안 섰다')
  const 누른때 = 본.at + 1
  그림(본.at + 틱 + 0.5)
  clock = 본.at + 틱 + 3
  누름(어디(view), 누른때)
  for (let index = 1; index < 200 && judged.length === 0; index += 1) 그림(clock + index * 틀간격)
  장면내림()
  return { 본틱: 본.frame, 판정: judged.map(({ frame }) => frame) }
}

describe('터치 스윙 버튼 — 화면 탭과 같은 판정 틱', () => {
  it('같은 때 누르면 버튼 · 화면 모두 F = 누를 때 보이던 공 틱 + 1', () => {
    const 화면 = 판정틱((view) => view.container.querySelector('canvas') as Element)
    cleanup()
    새판()
    const 버튼 = 판정틱((view) => view.container.querySelector('[data-touch-key="5"]') as Element)
    expect(화면.판정).toEqual([화면.본틱 + 1])
    expect(버튼).toEqual(화면)
  })
})
