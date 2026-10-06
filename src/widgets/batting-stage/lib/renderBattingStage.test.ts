import { describe, expect, it } from 'vitest'
import { pitcherMirrorOf } from '@/widgets/batting-stage/lib/renderBattingStage'
import { pitcherFrameAt } from '@/widgets/batting-stage/lib/stageScenery'
import { pitcherHandOfPitch } from '@/entities/pitching/model/pitcherHand'

describe('타석 화면 일반 투수 — 폼·손 (0x9e0b8 · 0x482c8 · 0x79524)', () => {
  it('좌투(손 1)면 앵커 + 1 을 축으로 뒤집고, 우투는 그대로다', () => {
    expect(pitcherMirrorOf(240, 1)).toEqual({ axisX: 241, isMirrored: true })
    expect(pitcherMirrorOf(240, 0)).toEqual({ axisX: 240, isMirrored: false })
  })

  it('손은 0xb63c0 — 일반 투수는 폼 & 1, 마투수는 표대로', () => {
    expect(pitcherHandOfPitch({ pitcherForm: 3, pitcherMagicNumber: 0 })).toBe(1)
    expect(pitcherHandOfPitch({ pitcherForm: 2, pitcherMagicNumber: 0 })).toBe(0)
  })

  it('투구 단계 표는 폼 >> 1 로 갈린다 — 폼 2·3 은 같은 표, 0 과는 단계 6 에서 다르다', () => {
    const 단계6틱 = 11 // 단계 길이 dur+1 = 2·3·2·2·1·1 → 단계 6 은 틱 11 부터
    expect(pitcherFrameAt(2, 단계6틱)).toBe(pitcherFrameAt(3, 단계6틱))
    expect(pitcherFrameAt(2, 단계6틱)).not.toBe(pitcherFrameAt(0, 단계6틱))
  })
})
