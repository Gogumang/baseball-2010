import { BALANCE } from '@/shared/config/original/balance'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { gainPitcherMorale, spendPitcherCycleAction } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'

/**
 * 투수편 [휴식] 커맨드 — 관리 화면 105 칸 2 → 팝업 0x2a → 상태 **127**(휴식 연출 0x85230) →
 * 결과 **0x18e3c** (R9 3절 "127 휴식 실행" · G 2절).
 *
 * 값은 타자편 `entities/career/model/outing.ts` 와 같다. 원본이 모드 3·4 를 **한 코드로** 돌리기
 * 때문이다 (R9 2절: 관리 장면 0x106 은 두 편 공용). 커리어 타입만 달라 같은 함수를 부르지 못해
 * 여기에 다시 적는다 — 투수편 `entities` 에 휴식이 생기면 그리로 옮기면 된다.
 *
 * ⚠️ **못 옮긴 것**: 원본은 결과 창을 닫을 때 회복 판정 0x1b308(질병 60% · 부상 30%)을 한 번 더
 * 굴린다. 그 굴림(`rollRecovery`)은 타자 커리어(`PlayerCareer`) 전용이라 투수편에는 아직 없다 —
 * 투수용이 생기면 `runPitcherRest` 결과에 이어 붙일 자리다.
 */

/** 사기 회복 `bfa55(10, 16)` = 10~15 (0x18e3c) */
const REST_MORALE_RANGE = { minimum: 10, maximumExclusive: 16 }
const MAXIMUM_MORALE = BALANCE.limits.morale

export type PitcherRestBlockReason = '이미행동함' | '사기최고'

/**
 * 휴식 가드 (0x12682).
 *
 * ⚠️ **원본 그대로**: 사기가 최고면 **아프거나 다쳤어도** StrMODE[91] 로 거절한다 — 회복 판정을
 * 굴릴 기회 자체가 없다 (G 2절 "아파도 거절"). 고치지 않는다.
 *
 * 주기 검사(한 주기에 한 가지)는 원본 105 키에는 없고 r_event_txt[176] 규칙 쪽이라
 * 타자편 `restBlockReasonOf` 와 같은 차례로 먼저 본다.
 */
export function pitcherRestBlockReasonOf(career: PitcherCareer): PitcherRestBlockReason | null {
  if (career.hasActedThisCycle) return '이미행동함'
  return career.morale >= MAXIMUM_MORALE ? '사기최고' : null
}

export interface PitcherRestOutcome {
  readonly career: PitcherCareer
  readonly moraleGain: number
}

/** 휴식 한 번 (0x18e3c) — 사기만 오른다. 주기 행동 한 칸을 쓴다 */
export function runPitcherRest(career: PitcherCareer, random: RandomPort): PitcherRestOutcome {
  const blockReason = pitcherRestBlockReasonOf(career)
  if (blockReason !== null) throw new Error(`휴식할 수 없습니다 (${blockReason})`)
  const moraleGain = randomIntegerBelow(random, REST_MORALE_RANGE.minimum, REST_MORALE_RANGE.maximumExclusive)
  return { career: gainPitcherMorale(spendPitcherCycleAction(career), moraleGain), moraleGain }
}
