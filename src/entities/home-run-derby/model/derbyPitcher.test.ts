import { describe, expect, it } from 'vitest'
import { derbyPitcherOf } from '@/entities/home-run-derby/model/derbyPitcher'
import { DERBY_MAGIC_PITCH_TYPE, DERBY_ORDINARY_PITCH_TYPE } from '@/entities/home-run-derby/model/derbyRules'
import { pitchListOf } from '@/entities/pitching/model/pitchIntelligence'

describe('홈런더비 상대 투수 (S13 5절 확정)', () => {
  it('단계 0 은 마투수가 없다', () => {
    expect(derbyPitcherOf(0).ace).toBeNull()
  })

  it('단계 0 은 구질 1 고정이다 — 구질 목록에 1 만 들어간다', () => {
    const { ability, pitchType } = derbyPitcherOf(0)
    expect(pitchType).toBe(DERBY_ORDINARY_PITCH_TYPE)
    const list = pitchListOf(ability.repertoire!.pitchMask, false)
    expect(new Set(list.filter((type) => type !== 0))).toEqual(new Set([1]))
  })

  it('단계 1~4 는 레오니 · 붕붕머신 · 발렌타인 · 드래고나 차례다', () => {
    expect([1, 2, 3, 4].map((stage) => derbyPitcherOf(stage).ace?.name)).toEqual([
      '레오니',
      '붕붕머신',
      '발렌타인',
      '드래고나',
    ])
  })

  it('싸이커는 안 나온다', () => {
    const 나오는이름 = [0, 1, 2, 3, 4, 5].map((stage) => derbyPitcherOf(stage).ace?.name)
    expect(나오는이름).not.toContain('싸이커')
  })

  it('단계 ≥ 1 이 던지는 구질 번호는 22(마구)다', () => {
    expect(derbyPitcherOf(1).pitchType).toBe(DERBY_MAGIC_PITCH_TYPE)
  })

  it('표 밖(5 이상)이면 마투수가 없다', () => {
    expect(derbyPitcherOf(5).ace).toBeNull()
  })
})
