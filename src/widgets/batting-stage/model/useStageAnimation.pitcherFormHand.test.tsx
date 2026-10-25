// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StageScene } from '@/widgets/batting-stage/lib/renderBattingStage'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { resetCommonWindowShownForTest } from '@/shared/lib/commonWindow/commonWindow'
import { ACE_PITCHER_REPERTOIRES, ROSTER_PITCHER_REPERTOIRES } from '@/shared/config/original/pitcherRepertoires'
import { DEFAULT_PITCHER_ABILITY } from '@/entities/pitching/model/pitch'
import type { PitcherAbility } from '@/entities/pitching/model/pitch'
import { ROOKIE_BATTER_ABILITY } from '@/entities/batting/model/batter'
import { resetSceneParticlesForTest } from '@/widgets/particles/model/sceneParticles'
import { resetSceneResultCode } from '@/widgets/batting-stage/model/sceneResultCodeStore'
import { resetSceneCloudClock } from '@/widgets/batting-stage/model/sceneCloudClock'

/**
 * **타자 쪽 타석 화면이 마운드 투수의 폼 · 손으로 그리는가** — 원본 근거:
 * ```
 * 48f34   [게임+0xf98]+0xc = 0xb6e24(현재 투수 0xae83d) = rec[0xb] >> 4     ; 투구 단계 표를 고르는 폼 (0x9e0b8 9e0e0~9e118)
 * 482c8   그림[게임+0xf1c].vt8(팀, 0xb6e24, 피부, [sp] = 0xb63c0(투수), [sp+4] = 0xb63a0(투수))   ; 손 → 그림 +0x3c (0x793b0 793de · 7947e)
 * 79544   +0x3c ≠ 0 → 효과 0x11 (좌우 뒤집기). 마투수는 79568 갈래 — bbmachine 말고는 같은 +0x3c 를 본다(795b4)
 * ```
 * 부르는 화면은 모두(나리 타자편 · 일반 · 시즌 · 미션 · 홈런더비) `pitcherAbility.repertoire`(그 투수 레코드 +0xb · +0x18)를 넘긴다.
 * 그리기 함수(`renderBattingStage`)에 들어가는 장면의 `pitcherForm` · `pitcherHand` 를 뜬다.
 */
const 그린장면: StageScene[] = []
vi.mock('@/widgets/batting-stage/lib/renderBattingStage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/widgets/batting-stage/lib/renderBattingStage')>()
  return {
    ...actual,
    renderBattingStage: (_context: CanvasRenderingContext2D, scene: StageScene) => void 그린장면.push(scene),
    renderSettlementLayer: () => {},
  }
})

const { BattingStage } = await import('@/widgets/batting-stage/ui/BattingStage')
const { acePitcherMirrorsOf } = await import('@/widgets/batting-stage/lib/renderBattingStage')

let frames = new Map<number, FrameRequestCallback>()
let nextHandle = 1
let clock = 0
beforeEach(() => {
  frames = new Map()
  clock = 0
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
  resetSceneResultCode()
  resetCommonWindowShownForTest()
  resetSceneCloudClock()
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const 틀수 = 400

/** 타석을 `틀수` 틀 돌려 그리기에 들어간 장면들 — 공도 몇 개 날아간다 */
function 장면들(pitcherAbility: PitcherAbility): readonly StageScene[] {
  render(
    <BattingStage
      batterAbility={ROOKIE_BATTER_ABILITY}
      pitcherAbility={pitcherAbility}
      isEagleEyeEnabled={false}
      hud={null}
      acePitcher={null}
      isPaused={false}
      skyRow={2}
      random={createSeededRandom(20101016)}
      onPitchResolved={() => {}}
    />,
  )
  for (let index = 1; index <= 틀수; index += 1) {
    act(() => {
      clock = index * millisecondsPerFrame()
      const pending = [...frames.values()]
      frames = new Map()
      for (const callback of pending) callback(clock)
    })
  }
  return [...그린장면]
}

function 레퍼토리능력(repertoire: { readonly form: number; readonly pitchMask: number; readonly magicId: number }): PitcherAbility {
  return { ...DEFAULT_PITCHER_ABILITY, repertoire: { form: repertoire.form, pitchMask: repertoire.pitchMask, magicId: repertoire.magicId } }
}

const 폼으로 = (form: number) => {
  const found = ROSTER_PITCHER_REPERTOIRES.find((repertoire) => repertoire.form === form)
  if (found === undefined) throw new Error(`폼 ${form} 투수가 없다`)
  return found
}

describe('타자 쪽 타석 — 마운드 투수의 폼 · 손 (0x9e0b8 · 0xb63c0 → 0x79524)', () => {
  it('폼 4(우투) 투수는 단계 표 폼 4 · 손 0 으로 그린다 — 던진 공도 그 폼을 싣는다', () => {
    const scenes = 장면들(레퍼토리능력(폼으로(4)))
    expect(scenes.length).toBeGreaterThan(0)
    expect(scenes.every((scene) => scene.pitcherForm === 4 && scene.pitcherHand === 0)).toBe(true)
    expect(scenes.some((scene) => scene.pitch !== null && scene.pitch.pitcherForm === 4)).toBe(true)
  })

  it('폼 3(좌투 — 폼 & 1) 투수는 손 1 로 뒤집어 그린다', () => {
    const scenes = 장면들(레퍼토리능력(폼으로(3)))
    expect(scenes.every((scene) => scene.pitcherForm === 3 && scene.pitcherHand === 1)).toBe(true)
  })

  it('왼손 마투수 싸이커(폼 6 · +0x18 5)는 손 1 — 마투수 그림도 뒤집는다(795b4), 오른손 레오니(폼 7)는 안 뒤집는다', () => {
    const [psyker, leony] = ACE_PITCHER_REPERTOIRES
    const psykerScenes = 장면들(레퍼토리능력(psyker))
    expect(psykerScenes.every((scene) => scene.pitcherForm === 6 && scene.pitcherHand === 1)).toBe(true)
    expect(acePitcherMirrorsOf(0, psykerScenes[0].pitcherHand === 1, 0)).toBe(true)
    cleanup()
    그린장면.length = 0
    const leonyScenes = 장면들(레퍼토리능력(leony))
    expect(leonyScenes.every((scene) => scene.pitcherForm === 7 && scene.pitcherHand === 0)).toBe(true)
    expect(acePitcherMirrorsOf(1, leonyScenes[0].pitcherHand === 1, 0)).toBe(false)
  })
})
