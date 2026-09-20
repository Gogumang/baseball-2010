import { describe, expect, it } from 'vitest'
import {
  BURST_GOAL,
  BURST_GOAL_NAMES,
  BURST_RESULT_STATE,
  BURST_SOUND,
  BURST_TEXT_LINE,
  judgeBurstGoal,
} from '@/entities/burst-mission/model/burstMissionJudge'
import {
  BURST_RESULT_BIT as B,
  HUMAN_WIN_END_BITS,
  burstResultBitsOf,
} from '@/entities/burst-mission/model/burstResultBits'
import { goalNamesFor, pitcherGoalNamesFor } from '@/entities/mission/model/missionGoal'

const 단타 = { kind: '안타', bases: 1 } as const
const 홈런 = { kind: '홈런' } as const
const 삼진 = { kind: '삼진' } as const
const 땅볼아웃 = { kind: '아웃', detail: '땅볼아웃' } as const

describe('안타 목표 (b8 = 0) — 단타도 성공이다', () => {
  // CORRECTIONS.md 1절: "K: 돌발미션 '안타' 목표에서 단타는 실패" 는 **틀렸다**.
  // B5 = "타자 출루이고 이닝이 안 끝남" 이라 단타면 함께 켜진다 (P7 K1 → K 정정).
  it('무사에 친 단타는 B3|B5 라 성공이다', () => {
    const bits = burstResultBitsOf({ outcome: 단타, runsBattedIn: 0, outsBefore: 0, outsAdded: 0 })

    expect(bits & B.단타).toBeTruthy()
    expect(bits & B.출루).toBeTruthy()
    expect(judgeBurstGoal(BURST_GOAL.안타, bits)).toBe('성공')
  })

  it('2아웃에 친 단타도 이닝이 안 끝나므로 성공이다', () => {
    const bits = burstResultBitsOf({ outcome: 단타, runsBattedIn: 0, outsBefore: 2, outsAdded: 0 })

    expect(judgeBurstGoal(BURST_GOAL.안타, bits)).toBe('성공')
  })

  it('⚠️ 원본 그대로 — 단타를 쳤어도 그 플레이로 3아웃이 되면 B5 가 안 켜져 실패다', () => {
    // 앞 주자가 잡혀 이닝이 끝난 경우. 성공 비트에 B3(단타)이 없어서 B3 만 남고 실패로 떨어진다.
    const bits = burstResultBitsOf({ outcome: 단타, runsBattedIn: 0, outsBefore: 2, outsAdded: 1 })

    expect(bits & B.출루).toBeFalsy()
    expect(judgeBurstGoal(BURST_GOAL.안타, bits)).toBe('실패')
  })

  it('2루타·3루타·홈런·타점도 성공이고, 번트 희생은 무효, 삼진은 실패다', () => {
    expect(judgeBurstGoal(BURST_GOAL.안타, B['2루타'])).toBe('성공')
    expect(judgeBurstGoal(BURST_GOAL.안타, B['3루타'])).toBe('성공')
    expect(judgeBurstGoal(BURST_GOAL.안타, B.홈런)).toBe('성공')
    expect(judgeBurstGoal(BURST_GOAL.안타, B.타점)).toBe('성공')
    expect(judgeBurstGoal(BURST_GOAL.안타, B.번트진루)).toBe('무효')
    expect(judgeBurstGoal(BURST_GOAL.안타, B.삼진 | B.아웃)).toBe('실패')
  })
})

describe('공격 목표 판정표 (0x8f414, 점프표 0xd525c)', () => {
  it('장타 — 2·3루타와 홈런만 성공, 단타·타점·출루는 무효', () => {
    expect(judgeBurstGoal(BURST_GOAL.장타, B['2루타'] | B.출루)).toBe('성공')
    expect(judgeBurstGoal(BURST_GOAL.장타, B.홈런)).toBe('성공')
    expect(judgeBurstGoal(BURST_GOAL.장타, B.단타 | B.출루)).toBe('무효')
    expect(judgeBurstGoal(BURST_GOAL.장타, B.아웃)).toBe('실패')
  })

  it('홈런 — 홈런만 성공, 다른 타격 결과는 모두 무효', () => {
    expect(judgeBurstGoal(BURST_GOAL.홈런, B.홈런 | B.타점 | B.출루)).toBe('성공')
    expect(judgeBurstGoal(BURST_GOAL.홈런, B['3루타'] | B.출루)).toBe('무효')
    expect(judgeBurstGoal(BURST_GOAL.홈런, B.번트진루)).toBe('무효')
    expect(judgeBurstGoal(BURST_GOAL.홈런, B.삼진 | B.아웃)).toBe('실패')
  })

  it('타점 — 점수가 나거나 홈런이면 성공, 점수 없는 출루는 무효', () => {
    expect(judgeBurstGoal(BURST_GOAL.타점, B.단타 | B.출루 | B.타점)).toBe('성공')
    expect(judgeBurstGoal(BURST_GOAL.타점, B.단타 | B.출루)).toBe('무효')
    expect(judgeBurstGoal(BURST_GOAL.타점, B.아웃)).toBe('실패')
  })

  it('번트 — 번트 진루·득점권 진루가 성공, 안타로 나가면 무효', () => {
    expect(judgeBurstGoal(BURST_GOAL.번트, B.번트진루)).toBe('성공')
    expect(judgeBurstGoal(BURST_GOAL.번트, B.번트득점권)).toBe('성공')
    expect(judgeBurstGoal(BURST_GOAL.번트, B.단타 | B.출루)).toBe('무효')
    expect(judgeBurstGoal(BURST_GOAL.번트, B.아웃)).toBe('실패')
  })
})

describe('수비 목표 판정표 — B4(타점)가 성공보다 먼저다', () => {
  it('아웃 — 아웃·삼진·병살이 성공, 점수를 주면 아웃을 잡아도 실패', () => {
    expect(judgeBurstGoal(BURST_GOAL.아웃, B.아웃)).toBe('성공')
    expect(judgeBurstGoal(BURST_GOAL.아웃, B.아웃 | B.타점)).toBe('실패')
    expect(judgeBurstGoal(BURST_GOAL.아웃, B.단타 | B.출루)).toBe('실패')
    // 볼넷만 나면 성공도 실패도 아니다 → 무효
    expect(judgeBurstGoal(BURST_GOAL.아웃, B.볼넷)).toBe('무효')
  })

  it('삼진 — 삼진 비트만 성공. 땅볼 아웃은 무효다', () => {
    expect(judgeBurstGoal(BURST_GOAL.삼진, B.삼진 | B.아웃)).toBe('성공')
    expect(judgeBurstGoal(BURST_GOAL.삼진, B.아웃)).toBe('무효')
    expect(judgeBurstGoal(BURST_GOAL.삼진, B.삼진 | B.타점)).toBe('실패')
  })

  it('병살 — 한 플레이에 아웃 둘(B10)이어야 성공', () => {
    expect(judgeBurstGoal(BURST_GOAL.병살, B.아웃 | B.병살)).toBe('성공')
    expect(judgeBurstGoal(BURST_GOAL.병살, B.아웃)).toBe('무효')
  })

  it('⚠️ 원본 그대로 — 고의사구 목표는 아무 볼넷이나 성공이다 (B11 이 볼넷 전부)', () => {
    expect(judgeBurstGoal(BURST_GOAL.고의사구, B.볼넷)).toBe('성공')
    expect(judgeBurstGoal(BURST_GOAL.고의사구, B.삼진 | B.아웃)).toBe('무효')
  })
})

describe('판정하지 않는 경우', () => {
  it('결과비트가 0 이면 아무 판정도 하지 않는다 (0x8f414 앞머리)', () => {
    expect(judgeBurstGoal(BURST_GOAL.안타, 0)).toBeNull()
    expect(judgeBurstGoal(BURST_GOAL.아웃, 0)).toBeNull()
  })

  it('목표 5 는 점프표에 칸만 있고 판정이 없다', () => {
    expect(judgeBurstGoal(BURST_GOAL.없음, B.홈런)).toBeNull()
  })

  it('목표 10 은 세 표에 쓰이지 않았지만 B6 만 성공으로 본다', () => {
    expect(judgeBurstGoal(BURST_GOAL.미상10, B.번트진루)).toBe('성공')
    expect(judgeBurstGoal(BURST_GOAL.미상10, B.단타)).toBe('무효')
    expect(judgeBurstGoal(BURST_GOAL.미상10, B.삼진)).toBe('실패')
  })

  it('점프표 밖의 목표 번호는 판정하지 않는다', () => {
    expect(judgeBurstGoal(11, B.홈런)).toBeNull()
  })
})

describe('⚠️ 원본 그대로 — 사람 팀 승리로 경기가 끝나면 공격 목표가 성공으로 뒤집힌다', () => {
  it('0x801 은 홈런 + 볼넷 비트다 (0xa89f0)', () => {
    expect(HUMAN_WIN_END_BITS).toBe(0x801)
  })

  it('삼진을 당해도 끝내기 승리면 안타·장타·홈런·타점·고의사구가 성공이 된다', () => {
    const bits = burstResultBitsOf({
      outcome: 삼진,
      runsBattedIn: 0,
      outsBefore: 2,
      outsAdded: 1,
      humanTeamWalkOff: true,
    })

    expect(judgeBurstGoal(BURST_GOAL.안타, bits)).toBe('성공')
    expect(judgeBurstGoal(BURST_GOAL.장타, bits)).toBe('성공')
    expect(judgeBurstGoal(BURST_GOAL.홈런, bits)).toBe('성공')
    expect(judgeBurstGoal(BURST_GOAL.고의사구, bits)).toBe('성공')
  })
})

describe('결과 상태·대사 줄·효과음', () => {
  it('원본 obj+0x21c 값은 실패 1 · 성공 2 · 무효 3 이다', () => {
    expect(BURST_RESULT_STATE).toEqual({ 실패: 1, 성공: 2, 무효: 3 })
  })

  it('대사 줄은 성공 1 · 실패 2 · 무효 3, 효과음은 0x24 · 0x20 · 0x25 다', () => {
    expect(BURST_TEXT_LINE).toEqual({ 성공: 1, 실패: 2, 무효: 3 })
    expect(BURST_SOUND).toEqual({ 성공: 0x24, 실패: 0x20, 무효: 0x25 })
  })
})

describe('미션 모드 목표 이름과 어긋나지 않는다', () => {
  it('안타·홈런·타점은 미션 모드가 같은 이름으로 세는 것과 같다', () => {
    expect(goalNamesFor(단타, 0)).toContain(BURST_GOAL_NAMES[BURST_GOAL.안타])
    expect(goalNamesFor(홈런, 1)).toContain(BURST_GOAL_NAMES[BURST_GOAL.홈런])
    expect(goalNamesFor(단타, 1)).toContain(BURST_GOAL_NAMES[BURST_GOAL.타점])
  })

  it('번트·아웃도 이름이 같다', () => {
    expect(goalNamesFor(땅볼아웃, 0, true)).toContain(BURST_GOAL_NAMES[BURST_GOAL.번트])
    expect(pitcherGoalNamesFor(땅볼아웃, '')).toContain(BURST_GOAL_NAMES[BURST_GOAL.아웃])
  })

  it('돌발은 `삼진`, 미션 모드 투수편은 `탈삼진` — 원본 표가 쓰는 이름이 서로 다르다', () => {
    expect(BURST_GOAL_NAMES[BURST_GOAL.삼진]).toBe('삼진')
    expect(pitcherGoalNamesFor(삼진, '')).toContain('탈삼진')
    expect(pitcherGoalNamesFor(삼진, '')).not.toContain('삼진')
  })

  it('장타·병살·고의사구는 돌발미션에만 있는 목표다', () => {
    const 미션모드목표 = [...goalNamesFor(홈런, 4), ...pitcherGoalNamesFor(삼진, '')]

    for (const goal of [BURST_GOAL.장타, BURST_GOAL.병살, BURST_GOAL.고의사구]) {
      expect(미션모드목표).not.toContain(BURST_GOAL_NAMES[goal])
    }
  })
})
