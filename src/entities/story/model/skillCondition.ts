import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { hasSkill, seasonTrainingCountOf } from '@/entities/career/model/playerCareer'
import { equippedAbilityOf } from '@/entities/career/model/condition'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * 이벤트 조건 20(스킬 획득) · 21(스킬 해제) — 0xad1ba 의 하위 switch (A-3·A-4 확정).
 *
 * ```
 * 20: 스킬 v−1 을 **안 가졌을 때**만, 이어서 하위 조건 0xd8408[v−3] 를 본다
 * 21: 스킬 v−1 을 **가졌을 때**만, 이어서 하위 조건 0xd8454[v−3] 를 본다
 * ```
 * 표는 19칸(스킬 2~20)이고, 표에 없는 스킬은 그냥 통과다.
 *
 * ⚠️ **아직 다 옮기지 못했다.** 원본 조건 가운데 아래 것들은 웹에 없는 값을 본다:
 *   - 7 전설: 우승 횟수(+0x7a) · 그 해 MVP 비트(+0x1ca)
 *   - 10~16: 연도·통산 세부 기록 칸(+0x20~+0x2c, +0x1f0[])
 * 그 조건들은 **아직 통과시키지 않는다**(= 이벤트가 뜨지 않는다).
 * 해제 기록(`removedMinusSkillIds`)은 연초 115 의 0xa4ee8 이 +0x1d0 을 지워 "그 해" 것만 남는다 — 두 편 모두 105 진입이
 * 115 를 열 때 비운다(useCareerSession · usePitcherLeagueSession).
 */

/** 훈련 칸 — 원본 s = 0 히트 · 1 파워 · 2 수비 · 3 주루 · 4 필살타법 */
const TRAINING = { 히트: '히트', 파워: '파워', 수비: '수비' } as const

/** 능력치 네 칸의 실효값 평균 (A-4 의 `평균실효`) */
const averageEquipped = (career: PlayerCareer) => {
  const ability = equippedAbilityOf(career)
  return Math.trunc((ability.hit + ability.power + ability.defense + ability.run) / 4)
}

/** 0-기준 연차 */
const yearIndexOf = (career: PlayerCareer) => career.season - 1

/**
 * `0xa4f31(S, k)` — 표 0xd7e10 = [2,3,4,5,17,18,19,20] 에서 k 의 칸을 찾아 u8 S+0x1d0+칸(그 해 해제함)을 돌려준다(표에 없으면 0).
 * 획득 하위 조건 가운데 **2 · 3 · 4 · 5 · 18 · 19 · 20** 만 맨 앞에서 이 값을 보고 불발한다(0xad2a6 · 0xad2ea · 0xad3b0 · 0xad43e ·
 * 0xad846 · 0xad8cc · 0xad93e — `0xa4f31` 부르는 곳 전수). **17 하락세는 0xad9a2(추가 조건 없음)라 안 본다** — 그 해 풀었어도
 * 다시 얻는다(원본 그대로).
 */
const wasRemoved = (career: PlayerCareer, skillId: number) => career.removedMinusSkillIds.includes(skillId)

/** 칸 값 읽기 — +0x4b+i 는 u8(ldrb), +0x6b+i 사본은 s8(ldrb → lsl/asr 24) */
const toUint8 = (value: number) => value & 0xff
const toInt8 = (value: number) => ((value & 0xff) << 24) >> 24
/** s16 칸 읽기(ldrsh) — 넘치면 음수로 돈다 */
const toInt16 = (value: number) => ((value & 0xffff) << 16) >> 16

/**
 * 몹쓸몸·유리몸의 T — 0xad334~0xad34c: `Σ i=0..4 (u8 S+0x4b+i − s8 S+0x6b+i)` (통산 훈련 수 − 시즌 시작 사본).
 * 칸이 u8 이라 256 회째에 0 으로 돌고, 사본은 128 을 넘으면 음수로 읽힌다 — 원본 그대로(투수편 `seasonPitcherTrainingTotalOf` 와 같은 식).
 */
function seasonTrainingByteTotalOf(career: PlayerCareer): number {
  const menuIds = new Set([...Object.keys(career.trainingCounts), ...Object.keys(career.seasonStartTrainingCounts)])
  let total = 0
  for (const menuId of menuIds) {
    total += toUint8(career.trainingCounts[menuId] ?? 0) - toInt8(career.seasonStartTrainingCounts[menuId] ?? 0)
  }
  return total
}

/** 조건표를 옮긴 스킬 — 나머지는 아직 판정하지 않는다 */
const ACQUIRE_RULES: Readonly<Record<number, (career: PlayerCareer, random: RandomPort | undefined) => boolean>> = {
  // 3 몹쓸몸 — 0xa4f31 불발 → 평균실효 ≤ 700 이고 (g==12 && T==0 | g==28 && T≤1 | g==42 && T≤2) (0xad2e6)
  3: (career) => {
    if (wasRemoved(career, 3) || averageEquipped(career) > 700) return false
    const g = career.gamesPlayed
    const t = seasonTrainingByteTotalOf(career)
    return (g === 12 && t === 0) || (g === 28 && t <= 1) || (g === 42 && t <= 2)
  },
  // 4 유리몸 — 0xa4f31 불발 → 연차 ≥ 1, 평균실효 ≤ 700, (g==18 && T≤2 | g==38 && T≤4) (0xad3ac)
  4: (career) => {
    if (wasRemoved(career, 4) || yearIndexOf(career) < 1 || averageEquipped(career) > 700) return false
    const g = career.gamesPlayed
    const t = seasonTrainingByteTotalOf(career)
    return (g === 18 && t <= 2) || (g === 38 && t <= 4)
  },
  // 2 먹튀 — 0xa4f31 불발 → 연차 ≥ 2 이고 (g==14 && 이번 시즌 인기도 합 ≤ 15 | g==32 && ≤ 35) (0xad2a2)
  // 합은 s16 +0x1c2 를 ldrsh 로 읽는다(0xad2c0 — 116 의 12c26~12c30 도 ldrsh · strh 로 쌓는다) — 32767 을 넘기면 음수로 돈다(원본 그대로).
  // 투수편 `acquiresPitcherSkill` 과 같은 읽기다
  2: (career) => {
    if (wasRemoved(career, 2) || yearIndexOf(career) < 2) return false
    const g = career.gamesPlayed
    const gain = toInt16(career.seasonPopularityGain)
    return (g === 14 && gain <= 15) || (g === 32 && gain <= 35)
  },
  // 5 무력감 — 0xa4f31 불발 → 사기 ≤ 20, 연차 ≥ 3, rand(0,100) > 69 (30%, 0xad46c `cmp r0, #0x45 ; ble`) (0xad43a — 앞이 막히면 안 굴린다)
  5: (career, random) =>
    !wasRemoved(career, 5) &&
    career.morale <= 20 && yearIndexOf(career) >= 3 && random !== undefined && random.rand(0, 100) > 69,
  // 추가 조건이 없는 것들 (0xad9a2)
  6: () => true, // 행운
  8: () => true, // 의외성
  9: () => true, // 베테랑
  17: () => true, // 하락세
  // 18 헛스윙 — 0xa4f31 불발 → 히트 실효 ≤ 600, g==40, 이번 시즌 히트 훈련 ≤ 1 (0xad842)
  18: (career) =>
    !wasRemoved(career, 18) &&
    equippedAbilityOf(career).hit <= 600 &&
    career.gamesPlayed === 40 &&
    seasonTrainingCountOf(career, TRAINING.히트) <= 1,
  // 19 똑딱이 — 0xa4f31 불발 → 파워 실효 ≤ 600, g==20, 이번 시즌 파워 훈련 0 (0xad8c8)
  19: (career) =>
    !wasRemoved(career, 19) &&
    equippedAbilityOf(career).power <= 600 &&
    career.gamesPlayed === 20 &&
    seasonTrainingCountOf(career, TRAINING.파워) === 0,
  // 20 에러왕 — 0xa4f31 불발 → 연차 ≥ 3, 수비 실효 ≤ 400, g==30, 이번 시즌 수비 훈련 0 (0xad93a)
  20: (career) =>
    !wasRemoved(career, 20) &&
    yearIndexOf(career) >= 3 &&
    equippedAbilityOf(career).defense <= 400 &&
    career.gamesPlayed === 30 &&
    seasonTrainingCountOf(career, TRAINING.수비) === 0,
}

/** 해제 쪽에서 "표에 없음(통과)" 인 스킬 */
const RELEASE_ALWAYS: ReadonlySet<number> = new Set([6, 8, 9, 16, 17])

/** 같은 칸을 이만큼 넘게 **연속** 훈련하면 해당 마이너스 스킬이 풀린다 (+0x70+s > 7) */
const CONSECUTIVE_TRAINING_LIMIT = 7

/** 해제 조건을 옮긴 스킬 */
const RELEASE_RULES: Readonly<Record<number, (career: PlayerCareer) => boolean>> = {
  // 2 먹튀 — 먹튀를 가진 뒤 5경기 이상이고, 경기당 인기도 변화 평균 > 3 (0xad9ce)
  2: (career) =>
    career.moneyGrubberGames >= 5 &&
    Math.trunc(career.moneyGrubberPopularityGain / career.moneyGrubberGames) > 3,
  // 5 무력감 — 경기 뒤 사기 ≥ 90 인 경기가 연속 6회 (+0x1c7 > 5)
  5: (career) => career.highMoraleStreak > 5,
  // 3 몹쓸몸 — 몹쓸몸을 가진 채로 훈련 6회 (+0x75 > 5)
  3: (career) => career.badBodyTrainings > 5,
  // 4 유리몸 — 유리몸을 가진 채로 훈련 8회 (+0x76 > 7)
  4: (career) => career.fragileTrainings > 7,
  // 18·19·20 — 각 칸을 연속 8회 (+0x70·+0x71·+0x72 > 7)
  18: (career) => (career.consecutiveTrainingCounts[TRAINING.히트] ?? 0) > CONSECUTIVE_TRAINING_LIMIT,
  19: (career) => (career.consecutiveTrainingCounts[TRAINING.파워] ?? 0) > CONSECUTIVE_TRAINING_LIMIT,
  20: (career) => (career.consecutiveTrainingCounts[TRAINING.수비] ?? 0) > CONSECUTIVE_TRAINING_LIMIT,
}

/** 조건 20 — 스킬을 아직 안 가졌고 하위 조건을 통과하면 획득 이벤트가 뜬다 */
export function meetsSkillAcquireCondition(
  career: PlayerCareer,
  value: number,
  random: RandomPort | undefined,
): boolean {
  const skillId = value - 1
  if (hasSkill(career, skillId)) return false
  // 그 해 해제한 마이너스 스킬(+0x1d0)은 하위 조건마다 맨 앞에서 본다(`wasRemoved`) — 17 하락세는 안 본다
  return ACQUIRE_RULES[skillId]?.(career, random) ?? false
}

/** 조건 21 — 스킬을 가졌고 하위 조건을 통과하면 해제 이벤트가 뜬다 */
export function meetsSkillReleaseCondition(career: PlayerCareer, value: number): boolean {
  const skillId = value - 1
  if (!hasSkill(career, skillId)) return false
  if (RELEASE_ALWAYS.has(skillId)) return true
  return RELEASE_RULES[skillId]?.(career) ?? false
}
