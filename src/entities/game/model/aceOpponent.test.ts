import { describe, expect, it } from 'vitest'
import {
  ACE_PITCHERS,
  missionOpponentOf,
  pitcherAbilityOf,
} from '@/entities/game/model/aceOpponent'

describe('ACE_PITCHERS', () => {
  it('원작 마선수 투수 5명이다', () => {
    expect(ACE_PITCHERS).toHaveLength(5)
    expect(ACE_PITCHERS.map((ace) => ace.name)).toEqual(
      expect.arrayContaining(['싸이커', '레오니', '붕붕머신', '발렌타인', '드래고나']),
    )
  })
})

describe('pitcherAbilityOf', () => {
  it('원본 능력치(0~999)를 아직 0~100 눈금인 투구 엔진 값으로 옮긴다', () => {
    const psyker = ACE_PITCHERS.find((ace) => ace.name === '싸이커')!

    expect(pitcherAbilityOf(psyker)).toEqual({
      control: 67,
      velocity: 55,
      breaking: 82,
      // 싸이커 레코드: 폼 6 · 마구 5 · 구질 마스크 0x410b (1·2·4·9·15)
      repertoire: { form: 6, pitchMask: 0x410b, magicId: 5 },
    })
  })

  it('마선수는 일반 투수보다 강하다', () => {
    for (const ace of ACE_PITCHERS) {
      const ability = pitcherAbilityOf(ace)
      expect(ability.control + ability.velocity, ace.name).toBeGreaterThan(100)
    }
  })
})

describe('missionOpponentOf — 미션 레코드의 마선수 순번', () => {
  it('미션 이름과 같은 마선수를 돌려준다', () => {
    expect(missionOpponentOf('투수', 2)?.name).toBe('레오니')
    expect(missionOpponentOf('투수', 4)?.name).toBe('발렌타인')
    expect(missionOpponentOf('타자', 3)?.name).toBe('로제')
    expect(missionOpponentOf('타자', 5)?.name).toBe('킹타이거')
  })

  it('0 은 일반 선수라 마선수가 없다', () => {
    expect(missionOpponentOf('투수', 0)).toBeNull()
  })
})
