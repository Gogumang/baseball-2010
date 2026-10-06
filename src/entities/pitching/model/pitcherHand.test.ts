import { describe, expect, it } from 'vitest'
import { pitcherHandOf, pitcherHandOfPitch } from '@/entities/pitching/model/pitcherHand'
import { ACE_PITCHER_REPERTOIRES, ROSTER_PITCHER_REPERTOIRES } from '@/shared/config/original/pitcherRepertoires'

describe('pitcherHandOf — 0xb63c0 의 투수 갈래 (0 우투 · 1 좌투)', () => {
  it('일반 투수는 폼의 낮은 비트다 (b63d4 → b6400)', () => {
    expect([0, 1, 2, 3, 4, 5].map((form) => pitcherHandOf(form, false))).toEqual([0, 1, 0, 1, 0, 1])
    // 봉은중 폼 1 → 좌투 · 심수찬 폼 0 → 우투
    expect(pitcherHandOf(ROSTER_PITCHER_REPERTOIRES[0].form, false)).toBe(1)
    expect(pitcherHandOf(ROSTER_PITCHER_REPERTOIRES[1].form, false)).toBe(0)
  })

  it('마투수는 폼 7·9·10 이면 0, 그 밖 1 이다 — 폼 비트와 다르다 (b63dc~b6408)', () => {
    expect(ACE_PITCHER_REPERTOIRES.map((ace) => [ace.name, pitcherHandOf(ace.form, true)])).toEqual([
      ['싸이커', 1],
      ['레오니', 0],
      ['붕붕머신', 1],
      ['발렌타인', 0],
      ['드래고나', 0],
    ])
  })

  it('공에 실린 폼·+0x18 로 — +0x18 이 5~9 면 마투수다', () => {
    expect(pitcherHandOfPitch({ pitcherForm: 8, pitcherMagicNumber: 7 })).toBe(1)
    expect(pitcherHandOfPitch({ pitcherForm: 8, pitcherMagicNumber: 0 })).toBe(0)
    // 육성·명전 투수의 마구 번호 1~4 는 마선수가 아니다
    expect(pitcherHandOfPitch({ pitcherForm: 3, pitcherMagicNumber: 2 })).toBe(1)
    expect(pitcherHandOfPitch({})).toBe(0)
  })
})
