import { describe, expect, it } from 'vitest'
import {
  ACE_PITCHERS,
  derbyAcePitcherOf,
  missionOpponentOf,
  pitcherAbilityOf,
  rollOpponentAceIndex,
} from '@/entities/game/model/aceOpponent'
import type { RandomPort } from '@/shared/api/random/randomPort'

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

describe('홈런더비 마투수 난입 — 표 0xcfce8 = [1,2,3,4] (S13 5절 확정)', () => {
  it('마투수 표의 차례는 원본 파일 줄 차례다 — 0 싸이커부터', () => {
    expect(ACE_PITCHERS.map((ace) => ace.name)).toEqual([
      '싸이커', '레오니', '붕붕머신', '발렌타인', '드래고나',
    ])
  })

  it('단계 1~4 는 레오니·붕붕머신·발렌타인·드래고나이고 싸이커는 안 나온다', () => {
    expect([1, 2, 3, 4].map((stage) => derbyAcePitcherOf(stage)?.name)).toEqual([
      '레오니', '붕붕머신', '발렌타인', '드래고나',
    ])
    // 단계 0 은 마투수가 없다 (0x48d9a 가 s <= 0 이면 건너뛴다)
    expect(derbyAcePitcherOf(0)).toBeNull()
    expect(derbyAcePitcherOf(5)).toBeNull()
    expect([1, 2, 3, 4].every((stage) => derbyAcePitcherOf(stage)?.name !== '싸이커')).toBe(true)
  })
})

describe('AI 팀 마선수 번호 0x66968 · 0x66994', () => {
  /** rand(0,5) 가 낼 값을 정해 주는 난수 */
  const 굴림 = (value: number): RandomPort => ({
    next: () => 0,
    nextInRange: (_minimum, maximum) => Math.min(value, maximum - 1),
    pick: (candidates) => candidates[0] as never,
  })

  it('사람과 다른 번호가 나오면 그대로 쓴다', () => {
    expect(rollOpponentAceIndex(0, 굴림(3))).toBe(3)
  })

  it('사람과 같으면 한 칸 내리고, 0 이면 4 로 올린다 (66980~66988)', () => {
    expect(rollOpponentAceIndex(3, 굴림(3))).toBe(2)
    expect(rollOpponentAceIndex(0, 굴림(0))).toBe(4)
  })

  it('⚠️ 원본 버그: 사람이 "없음"(−1)이어도 AI 는 늘 마선수를 얻는다 (ldrb 라 0xff 와 안 맞는다)', () => {
    for (let value = 0; value <= 4; value += 1) {
      expect(rollOpponentAceIndex(-1, 굴림(value))).toBe(value)
    }
  })
})
