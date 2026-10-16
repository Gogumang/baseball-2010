import { describe, expect, it } from 'vitest'
import {
  aceMagicAnimationDrawOf,
  aceMagicScaledDrawOf,
  aceMagicScaledOriginOf,
  effectPitcherFrameAt,
  halfTowardZero,
  oneShotAnimationFrameAt,
  showsEffectPitcher,
  type AcePitcherEffectInput,
} from '@/widgets/batting-stage/lib/acePitcherEffect'

/** effect_pitcher 애니 0 — 8칸 · 지연 0 */
const EFFECT_PITCHER_ENTRIES = Array.from({ length: 8 }, (_, frame) => ({ frame, delay: 0 }))
/** bbmachine_effect 애니 0 — 지연 2 · 2 · … · 0 · 0 · 2 · 2 */
const BBMACHINE_ENTRIES = [2, 2, 2, 2, 2, 2, 0, 0, 2, 2].map((delay, frame) => ({ frame, delay }))

const input = (overrides: Partial<AcePitcherEffectInput> = {}): AcePitcherEffectInput => ({
  aceOrder: 0,
  pitch: { isMagicPitch: true, pitcherMagicNumber: 5, magicNumber: 5 },
  pitchStateDraw: 0,
  ...overrides,
})

describe('마투수 effect_pitcher (0x39192)', () => {
  it('마선수 투수 · 0x11 · 마구면 0x11 그림 k 번째에 칸 k 를, 마지막 칸(7)은 안 그린다', () => {
    expect(effectPitcherFrameAt(input({ pitchStateDraw: 0 }), EFFECT_PITCHER_ENTRIES)).toBe(0)
    expect(effectPitcherFrameAt(input({ pitchStateDraw: 6 }), EFFECT_PITCHER_ENTRIES)).toBe(6)
    expect(effectPitcherFrameAt(input({ pitchStateDraw: 7 }), EFFECT_PITCHER_ENTRIES)).toBeNull()
  })

  it('원본 그대로: 마구가 아니어도 공+0x10 이 남아 있으면 뜬다', () => {
    const pitch = { isMagicPitch: false, pitcherMagicNumber: 5, magicNumber: 5 }
    expect(showsEffectPitcher(input({ pitch }))).toBe(true)
    expect(showsEffectPitcher(input({ pitch: { ...pitch, magicNumber: 0 } }))).toBe(false)
  })

  it('마선수 투수가 아니면(그림이 안 실린다) · 0x11 이 아니면 안 그린다', () => {
    expect(showsEffectPitcher(input({ aceOrder: null }))).toBe(false)
    expect(showsEffectPitcher(input({ pitchStateDraw: null }))).toBe(false)
  })
})

describe('마선수 마구 이펙트 0x46fa8', () => {
  const entriesOf = (folder: string) => (folder.includes('bbmachine') || folder.includes('ballantine') ? BBMACHINE_ENTRIES : null)

  it('붕붕머신(7) — 애니 0 을 그림마다 지연대로, 마지막 칸 전까지', () => {
    const at = (draw: number) =>
      aceMagicAnimationDrawOf(input({ aceOrder: 2, pitch: { isMagicPitch: true, pitcherMagicNumber: 7 }, pitchStateDraw: draw }), entriesOf)
    expect(at(0)).toEqual({ framesFolder: './sprites/bbmachine_effect/frames', frame: 0 })
    expect(at(1)?.frame).toBe(0)
    expect(at(2)?.frame).toBe(1)
    // 칸 6 · 7 은 지연 0 → 한 그림씩 (0x93d90 max(1, 지연))
    expect(at(12)?.frame).toBe(6)
    expect(at(13)?.frame).toBe(7)
    expect(at(14)?.frame).toBe(8)
    expect(at(16)).toBeNull()
  })

  it('구질이 마구가 아니면 0x46fc2 에서 끝난다', () => {
    expect(
      aceMagicAnimationDrawOf(input({ aceOrder: 2, pitch: { isMagicPitch: false, pitcherMagicNumber: 7, magicNumber: 7 } }), entriesOf),
    ).toBeNull()
  })

  it('싸이커(5) 는 자세 7 · 8 에서 1 · 2 배, 드래고나(9) 는 자세 8 · 9 에서 1 · 2 배', () => {
    const psyker = input({ aceOrder: 0, pitch: { isMagicPitch: true, pitcherMagicNumber: 5 } })
    expect(aceMagicScaledDrawOf(psyker, 6)).toBeNull()
    expect(aceMagicScaledDrawOf(psyker, 7)).toEqual({ imageUrl: './sprites/psyker_effect/000.png', scale: 1 })
    expect(aceMagicScaledDrawOf(psyker, 8)?.scale).toBe(2)
    expect(aceMagicScaledDrawOf(psyker, 9)).toBeNull()
    const dragona = input({ aceOrder: 4, pitch: { isMagicPitch: true, pitcherMagicNumber: 9 } })
    expect(aceMagicScaledDrawOf(dragona, 7)).toBeNull()
    expect(aceMagicScaledDrawOf(dragona, 8)).toEqual({ imageUrl: './sprites/dragona_effect/000.png', scale: 1 })
    expect(aceMagicScaledDrawOf(dragona, 9)?.scale).toBe(2)
  })

  it('레오니(6) 는 목록 비우기 뒤에 넣어 0x53044 가 버리므로 아무것도 안 그린다', () => {
    const leony = input({ aceOrder: 1, pitch: { isMagicPitch: true, pitcherMagicNumber: 6 } })
    expect(aceMagicScaledDrawOf(leony, 8)).toBeNull()
    expect(aceMagicAnimationDrawOf(leony, () => BBMACHINE_ENTRIES)).toBeNull()
  })

  it('키운 그림의 왼쪽 위 — (x − s·w/2, y − s·h/2), 반은 0 쪽 자름', () => {
    expect(aceMagicScaledOriginOf({ x: 120, y: 200 }, 1, 82, 82)).toEqual({ x: 79, y: 159 })
    expect(aceMagicScaledOriginOf({ x: 120, y: 200 }, 1, 76, 77)).toEqual({ x: 82, y: 162 })
    expect(halfTowardZero(-3)).toBe(-1)
  })
})

describe('oneShotAnimationFrameAt', () => {
  it('음수 그림은 없다', () => {
    expect(oneShotAnimationFrameAt(EFFECT_PITCHER_ENTRIES, -1)).toBeNull()
  })
})
