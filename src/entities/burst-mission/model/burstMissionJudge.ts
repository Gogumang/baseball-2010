import { BURST_RESULT_BIT, hasBit } from '@/entities/burst-mission/model/burstResultBits'

/**
 * 돌발미션 성공 판정 0x8f414(obj, 결과비트) — 목표 종류는 b8, 점프표 0xd525c(11칸).
 * (K-bursts-special.md 4절 1-4, 표는 확정)
 *
 * 결과 상태는 원본 obj+0x21c 에 들어간다: **2 성공 · 1 실패 · 3 무효**.
 * 성공이면 대사 줄 1 + "돌발미션 성공!!"(효과음 0x24), 실패면 줄 2 + "돌발미션 실패!!"(0x20),
 * 무효면 줄 3 에 보상·페널티가 없다(0x25).
 *
 * 현재 돌발이 없거나 **결과비트가 0 이면 아무것도 하지 않는다** (타석이 아직 안 끝난 것으로 본다).
 */
export type BurstJudgement = '성공' | '실패' | '무효'

/** 원본 결과 상태 값 (obj+0x21c) — 결선에서 대사 줄·효과음을 고를 때 쓴다 */
export const BURST_RESULT_STATE: Readonly<Record<BurstJudgement, number>> = {
  실패: 1,
  성공: 2,
  무효: 3,
}

/** 결과별 대사 줄 번호 (_TEXT 행의 4줄 중) — 0 제안 · 1 성공 · 2 실패 · 3 무효 */
export const BURST_TEXT_LINE: Readonly<Record<BurstJudgement, number>> = {
  성공: 1,
  실패: 2,
  무효: 3,
}

/** 결과별 효과음 번호 (0x8e5b8) */
export const BURST_SOUND: Readonly<Record<BurstJudgement, number>> = {
  성공: 0x24,
  실패: 0x20,
  무효: 0x25,
}

/**
 * b8 목표 번호. 이름은 대사로 확인한 것이고(K 4절 1-4), 5 와 10 은 세 표 140행 어디에도 안 쓰인다.
 *
 * 기존 미션 모드(`entities/mission/model/missionGoal.ts`)의 목표 이름과 겹치는 것은
 * **안타·홈런·타점·번트·아웃**이고 뜻도 같다. 다른 점 둘:
 *   - 돌발 7번은 `삼진`, 미션 모드 투수편 목표는 `탈삼진` 이다 — 원본 표가 서로 다른 이름을 쓴다.
 *   - `장타`·`병살`·`고의사구` 는 돌발미션에만 있다.
 */
export const BURST_GOAL = {
  안타: 0,
  장타: 1,
  홈런: 2,
  타점: 3,
  번트: 4,
  /** 5 — 점프표에 칸은 있으나 아무 판정도 하지 않는다. 세 표에 쓰인 행도 없다 */
  없음: 5,
  아웃: 6,
  삼진: 7,
  병살: 8,
  고의사구: 9,
  /** 10 — 세 표에 쓰인 행이 없어 이름을 모른다. 판정은 B6(번트 진루)만 본다 */
  미상10: 10,
} as const

export const BURST_GOAL_NAMES: Readonly<Record<number, string>> = {
  [BURST_GOAL.안타]: '안타',
  [BURST_GOAL.장타]: '장타',
  [BURST_GOAL.홈런]: '홈런',
  [BURST_GOAL.타점]: '타점',
  [BURST_GOAL.번트]: '번트',
  [BURST_GOAL.아웃]: '아웃',
  [BURST_GOAL.삼진]: '삼진',
  [BURST_GOAL.병살]: '병살',
  [BURST_GOAL.고의사구]: '고의사구',
}

const B = BURST_RESULT_BIT

/** 아웃 계열 목표(6~9)가 "공격이 잘 됐다" 로 보고 실패로 떨어뜨리는 비트들 */
const OFFENSE_BITS = B.홈런 | B['2루타'] | B['3루타'] | B.단타 | B.출루 | B.번트진루

/**
 * 아웃 계열 목표 (6 아웃 · 7 삼진 · 8 병살 · 9 고의사구).
 * **B4(타점)가 켜져 있으면 성공 비트보다 먼저 실패**로 떨어진다. 그 다음 성공 비트를 보고,
 * 공격 비트가 켜져 있으면 실패, 아무것도 아니면 무효다.
 *
 * 성공 비트와 공격 비트가 함께 켜졌을 때의 우선순위는 원본 판정표의 칸 순서를 따랐다(유력).
 */
function judgeDefensiveGoal(successBits: number, bits: number): BurstJudgement {
  if (hasBit(bits, B.타점)) return '실패'
  if (hasBit(bits, successBits)) return '성공'
  if (hasBit(bits, OFFENSE_BITS)) return '실패'
  return '무효'
}

/**
 * 목표 b8 과 타석 결과비트로 성공·실패·무효를 가린다.
 * 판정할 것이 없으면(b8 = 5, 또는 결과비트가 0) `null` 을 돌려준다 — 돌발은 그대로 살아 있다.
 */
export function judgeBurstGoal(goal: number, bits: number): BurstJudgement | null {
  if (bits === 0) return null

  switch (goal) {
    // 안타 — ⚠️ 성공 비트에 B3(단타)이 **없다**. 그래도 단타면 B5(출루·이닝 안 끝남)가 함께 켜져
    // 성공이다 (CORRECTIONS.md "K: 안타 목표에서 단타는 실패" 정정, P7 → K).
    // ⚠️ 원본 버그 그대로: 단타로 3아웃째가 나면 B5 가 안 켜져 **B3 만 남아 실패**로 떨어진다.
    case BURST_GOAL.안타:
      if (hasBit(bits, B.홈런 | B['2루타'] | B['3루타'] | B.타점 | B.출루)) return '성공'
      if (hasBit(bits, B.번트진루)) return '무효'
      return '실패'

    case BURST_GOAL.장타:
      if (hasBit(bits, B.홈런 | B['2루타'] | B['3루타'])) return '성공'
      if (hasBit(bits, B.단타 | B.타점 | B.출루)) return '무효'
      return '실패'

    case BURST_GOAL.홈런:
      if (hasBit(bits, B.홈런)) return '성공'
      if (hasBit(bits, B['2루타'] | B['3루타'] | B.단타 | B.타점 | B.출루 | B.번트진루)) return '무효'
      return '실패'

    case BURST_GOAL.타점:
      if (hasBit(bits, B.홈런 | B.타점)) return '성공'
      if (hasBit(bits, B['2루타'] | B['3루타'] | B.단타 | B.출루 | B.번트진루)) return '무효'
      return '실패'

    case BURST_GOAL.번트:
      if (hasBit(bits, B.번트진루 | B.번트득점권)) return '성공'
      if (hasBit(bits, B.홈런 | B['2루타'] | B['3루타'] | B.단타 | B.타점 | B.출루)) return '무효'
      return '실패'

    // 5 — 점프표에 칸은 있으나 판정하지 않는다
    case BURST_GOAL.없음:
      return null

    case BURST_GOAL.아웃:
      return judgeDefensiveGoal(B.아웃 | B.삼진 | B.병살, bits)
    case BURST_GOAL.삼진:
      return judgeDefensiveGoal(B.삼진, bits)
    case BURST_GOAL.병살:
      return judgeDefensiveGoal(B.병살, bits)
    // 고의사구 — ⚠️ 원본 그대로 **아무 볼넷이나** 성공이다 (B11 은 고의사구를 가리지 않는다)
    case BURST_GOAL.고의사구:
      return judgeDefensiveGoal(B.볼넷, bits)

    case BURST_GOAL.미상10:
      if (hasBit(bits, B.번트진루)) return '성공'
      if (hasBit(bits, B.홈런 | B['2루타'] | B['3루타'] | B.단타 | B.타점 | B.출루)) return '무효'
      return '실패'

    default:
      // 점프표 밖의 b8 — 세 표에는 없다. 원본은 점프표를 벗어나므로 웹은 판정하지 않는다
      return null
  }
}
