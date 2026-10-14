import { describe, expect, it } from 'vitest'
import { PITCHER_CARD_IMAGE, pitcherCardLookOf, pitcherCardPoseAt } from '@/pages/pitcher-league/lib/pitcherCardFigure'

describe('투수편 카드 그림 (0x15e20 · 틀 0x142b4)', () => {
  it('이미지는 (박스 0.x, 박스 0.y − 0x23) = (11, 18) 에 찍는다', () => {
    expect(PITCHER_CARD_IMAGE).toEqual({ x: 11, y: 18 })
  })

  it('틱 30 전에는 서 있고(애니 0), 30 에 던지기를 시작한다 — 140 의 배수마다 같은 동작을 다시 한다', () => {
    const form = 2
    const standing = pitcherCardPoseAt(form, 0)
    expect(Array.from({ length: 30 }, (_unused, tick) => pitcherCardPoseAt(form, tick))).toEqual(Array(30).fill(standing))
    const pitch = Array.from({ length: 40 }, (_unused, k) => pitcherCardPoseAt(form, 30 + k))
    expect(pitch.some((pose) => pose !== standing)).toBe(true)
    expect(Array.from({ length: 40 }, (_unused, k) => pitcherCardPoseAt(form, 140 + k))).toEqual(pitch)
    expect(Array.from({ length: 40 }, (_unused, k) => pitcherCardPoseAt(form, 280 + k))).toEqual(pitch)
  })

  it('던진 뒤에는 다시 서 있는 자세로 돌아온다 (단계 > 11 에서 다섯 틀 더 머문 뒤 0x9dff9(애니, 0))', () => {
    expect(pitcherCardPoseAt(0, 139)).toBe(pitcherCardPoseAt(0, 0))
  })

  it('폼 = 2 × 타입 + 손 · 팀 = 내 팀 · 니블은 제구 · 구속 · 변화 · 체력 차례', () => {
    expect(pitcherCardLookOf({ typeIndex: 2, handIndex: 1, skinIndex: 1, teamId: 6 },
      { control: 3, velocity: 0, breaking: 11, stamina: 1 })).toEqual({ form: 5, skin: 1, team: 6, equipment: [3, 0, 11, 1] })
  })
})
