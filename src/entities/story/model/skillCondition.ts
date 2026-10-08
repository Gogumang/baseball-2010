import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { hasSkill, seasonTrainingCountOf, yearlyStatsOf } from '@/entities/career/model/playerCareer'
import { equippedAbilityOf } from '@/entities/career/model/condition'
import type { SeasonStats } from '@/entities/career/model/seasonStats'
import type { GameSummary } from '@/entities/game/model/gameSummary'
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
 * ⚠️ **11 번트왕만 아직 옮기지 못했다** — S+0x1f0[5](G+0xf8 번트 수: 스윙 시작 0xa5fac 의 코드 11, state[0x13] 번트일 때)를
 * 웹 경기가 세지 않는다. 지어내지 않고 **불발**로 둔다(이벤트 413 이 뜨지 않는다).
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

/** 0xa4d51 — +0x1ca 비트 0~12 가운데 켜진 수 (0xa4d40 을 i = 0..12 로) */
function mvpSeasonCountOf(bits: number): number {
  let count = 0
  for (let bit = 0; bit <= 12; bit += 1) if ((bits & (1 << bit)) !== 0) count += 1
  return count
}

/** 경기 카운터 S+0x1f0 칸 수 — [0] 사이클 · [1] 전 타수 홈런 · [2] 3연타석 홈런 · [3] 2연타석 홈런 · [4] 끝내기 · [5] 번트 · [6] 만루 홈런 */
const GAME_SKILL_COUNTER_COUNT = 7
const gameCounterOf = (career: PlayerCareer, slot: number) => (career.gameSkillCounters ?? [])[slot] ?? 0

/** 한 경기에 단타·2루타·3루타·홈런을 모두 쳤는가 — G+0xb4 · +0xb8 · +0xbc · +0xc0 이 모두 0 이 아님 (0xa694c) */
function isCycleGame(stats: SeasonStats): boolean {
  const singles = stats.hits - stats.doubles - stats.triples - stats.homeRuns
  return singles > 0 && stats.doubles > 0 && stats.triples > 0 && stats.homeRuns > 0
}

/**
 * **경기 뒤 누적 카운터** — 평가 0xa719c 안 0xa690c 의 모드 4 갈래(0xa6934~0xa6aa0, P7 A2 확정 식). 평가는 정규시즌 경기만이라
 * 포스트시즌 · 대회 경기는 안 센다. G = 이 경기 사람 타자 기록(웹 `GameSummary` 의 `stats` · `reputationCounts`):
 * ```
 * [0] += 1                   ; 단타·2루타·3루타·홈런 모두 (G+0xb4..+0xc0)
 * if G+0xec(타수) == G+0xc0(홈런) && > 0:  [1] += 1
 * else:                                  [2] += G+0xe0 (3연타석 홈런) ; [3] += G+0xdc (2연타석 홈런)
 * [4] += u8 G+0xc4 (끝내기 안타 · 홈런)  ; [5] += G+0xf8 (번트 수) ; [6] += G+0xc8 (만루 홈런)
 * ```
 * 칸은 u16(strh)이라 65536 에서 돈다. [5] 번트 수는 웹 경기가 세지 않아 더하지 않는다(⚠️ 미해결 — 11 번트왕).
 * 같은 값을 +0x1e0 벌에도 더하지만 그 벌을 읽는 곳이 없어 웹은 +0x1f0 벌만 든다.
 */
export function withGameSkillCounters(career: PlayerCareer, summary: Pick<GameSummary, 'stats' | 'reputationCounts'>): PlayerCareer {
  const { stats } = summary
  const counts = summary.reputationCounts
  const counters = Array.from({ length: GAME_SKILL_COUNTER_COUNT }, (_, slot) => gameCounterOf(career, slot))
  const add = (slot: number, value: number) => {
    counters[slot] = (counters[slot] + value) & 0xffff
  }
  if (isCycleGame(stats)) add(0, 1)
  if (stats.atBats === stats.homeRuns && stats.atBats > 0) add(1, 1)
  else {
    add(2, counts.homeRunStreaksOfThree ?? 0)
    add(3, counts.homeRunStreaksOfTwo ?? 0)
  }
  add(4, counts.walkOffs & 0xff)
  add(6, counts.grandSlams)
  return { ...career, gameSkillCounters: counters }
}

/**
 * 타자 통산 `0x9dbc0` — 지난 해 레코드 0x1fa8c(i)(i < 연차idx)와 이번 해 0x1fc20 의 +0x20~+0x2c 를 s32 로 더해 strh 로 남기고,
 * 조건은 ldrsh 로 읽는다(s16 으로 돈다). +0x22 안타 · +0x24 2루타 · +0x26 3루타 · +0x2a 타점 (P3 · P7 A1).
 * 웹은 지난 해 기록(`yearlyStats`)이 연차만큼 있을 때 그것과 이번 시즌을 더하고, 없는 옛 저장은 통산(`careerStats`)으로 읽는다.
 */
function batterCareerTotalOf(career: PlayerCareer): Pick<SeasonStats, 'hits' | 'doubles' | 'triples' | 'runsBattedIn'> {
  const years = yearlyStatsOf(career)
  const rows = years.length >= career.season - 1 ? [...years.slice(0, career.season - 1), career.stats] : [career.careerStats]
  const sum = (key: 'hits' | 'doubles' | 'triples' | 'runsBattedIn') =>
    toInt16(rows.reduce((total, row) => total + toInt16(row[key]), 0))
  return { hits: sum('hits'), doubles: sum('doubles'), triples: sum('triples'), runsBattedIn: sum('runsBattedIn') }
}

/** 0xb63c0(내 타자 레코드 0x1fc20) — 마선수가 아니면 폼 & 1 = 좌타(웹 `battingSide` 1) */
const isLeftHanded = (career: PlayerCareer) => career.battingSide === 1

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
  // 7 전설 — s8 +0x7a(정규시즌 1위 횟수) ≥ 8 이고 0xa4d51(+0x1ca MVP 비트 수) > 6 (0xad474, 모드 갈림 없음)
  7: (career) => toInt8(career.regularSeasonFirstCount) >= 8 && mvpSeasonCountOf(career.mvpSeasonBits) > 6,
  // 10 해결사 — u16 +0x1f0[6](만루 홈런 수) > 5 (0xad494 모드 4)
  10: (career) => gameCounterOf(career, 6) > 5,
  // 12 찬스 — 통산 +0x24(2루타) ≥ 80 이고 +0x2a(타점) ≥ 200 (0xad514 모드 4)
  12: (career) => {
    const total = batterCareerTotalOf(career)
    return total.doubles >= 80 && total.runsBattedIn >= 200
  },
  // 13 좌완UP — 0xb63c0(내 레코드) 거짓(우타)이고 통산 +0x22(안타) ≥ 600 (0xad598 → 0xad650)
  13: (career) => !isLeftHanded(career) && batterCareerTotalOf(career).hits >= 600,
  // 14 우완UP — 0xb63c0 참(좌타)이고 통산 +0x22 ≥ 600 (0xad622 → 0xad650)
  14: (career) => isLeftHanded(career) && batterCareerTotalOf(career).hits >= 600,
  // 15 제압 — 통산 +0x24(2루타) ≥ 120 이고 +0x26(3루타) ≥ 10 (0xad794 모드 4)
  15: (career) => {
    const total = batterCareerTotalOf(career)
    return total.doubles >= 120 && total.triples >= 10
  },
  // 16 상승세 — u16 +0x1f0[1] + [2] + [3] > 9 (0xad7cc 모드 4 — ldrh 셋을 32비트로 더한다)
  16: (career) => gameCounterOf(career, 1) + gameCounterOf(career, 2) + gameCounterOf(career, 3) > 9,
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

/**
 * 해제 쪽에서 곧바로 통과(0xadc34)인 스킬 — 하위 표 0xd8454 의 칸 6~13 · 15 · 16 · 17 이 0xadc34 이고, 14 는 0xada22 인데
 * 모드 4 면 곧 0xadc34 다(투수 갈래만 식이 있다). 표 밖(2~20 밖)도 통과(0xad9c4)
 */
const RELEASE_ALWAYS: ReadonlySet<number> = new Set([6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17])

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
  // 하위 표 0xd8408 은 스킬 2~20 — 밖이면 통과 (0xad298 `v − 3 > 18`)
  if (skillId < 2 || skillId > 20) return true
  // 그 해 해제한 마이너스 스킬(+0x1d0)은 하위 조건마다 맨 앞에서 본다(`wasRemoved`) — 17 하락세는 안 본다
  return ACQUIRE_RULES[skillId]?.(career, random) ?? false
}

/** 조건 21 — 스킬을 가졌고 하위 조건을 통과하면 해제 이벤트가 뜬다 */
export function meetsSkillReleaseCondition(career: PlayerCareer, value: number): boolean {
  const skillId = value - 1
  if (!hasSkill(career, skillId)) return false
  if (skillId < 2 || skillId > 20 || RELEASE_ALWAYS.has(skillId)) return true
  return RELEASE_RULES[skillId]?.(career) ?? false
}
