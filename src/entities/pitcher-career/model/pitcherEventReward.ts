import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import {
  gainPitcherMorale,
  gainPitcherPopularity,
  gainPitcherReputation,
  ORIGINAL_MONEY_UNIT,
  pitcherAbilityLimitsOf,
} from '@/entities/pitcher-career/model/pitcherCareer'
import { MAXIMUM_PITCHER_ABILITY, PITCHER_ABILITY_ORDER } from '@/entities/pitcher-career/model/pitcherAbility'
import type { PitcherAbility } from '@/entities/pitcher-career/model/pitcherAbility'
import { openHiddenPitchRow } from '@/entities/pitcher-career/model/pitchTraining'
import { applyPitcherGpItem } from '@/entities/pitcher-career/model/pitcherItems'
import { applySkillReward, MAXIMUM_GAME_POINT } from '@/entities/career/model/playerCareer'
import { applySalaryChange } from '@/entities/career/model/seasonFlow'
import { ILLNESS_NAMES } from '@/entities/career/model/condition'
import { EVENT_REWARD_KIND, ILLNESS_COOLDOWN } from '@/entities/story/model/eventReward'
import type { EventReward } from '@/entities/story/model/eventReward'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { BALANCE } from '@/shared/config/original/balance'

/**
 * 나만의리그 **투수편**(모드 3) 이벤트 보상 — r_event 명령 7, 실행기 `0x8c460` (점프표 0xd4e50).
 *
 * 타자편 `entities/story/model/eventReward.ts` 와 **같은 함수**를 원본이 모드 3·4 공용으로 돈다.
 * 갈림은 아래 셋뿐이다 (0x8c460 직접 재역어셈):
 *   - 종류 6 (0x8c5da): `0x7b985`(투수편인가) 참일 때만 `선수[0x204 + v] = 1` — 히든 변화구 계열 v 오픈.
 *   - 종류 9 (0x8c62e): GP 아이템 `0xa4488(선수, 타자편?, v−1, …)` — 투수편은 둘째 인자 0 → 투수 갈래.
 *   - 종류 13~17 (0x8c758 · 0x8c8e8): 기록 `0x1fc75(전역, 3)` 의 능력치 `+0xc + 2i` 에 +v (999 상한),
 *     한계는 `0xd4d88[(0xb6705 보직 ≠ 0 ? 4 : 0) + i] × 10` (= `0xd80be` 와 같은 값 — 선발 800 · 구원 850/850/850/600).
 *     `0xb6415(기록, i, 0)`(배율만 — 육성 선수 100%)이 한계를 넘으면 한계로 둔다.
 * 그 밖의 종류는 커리어 칸이라 모드를 가르지 않는다:
 *   0 인기도(0~9999) · 1 평판(0~999) · 2 사기(0~100) · 3 소지금(100만 단위, 0~9999) ·
 *   4 스킬(v>0 획득 0xa4bd8 / v<0 해제 0xa4430 — 비트 번호는 투수 비트 그대로) · 7 히든 오픈 |v| ·
 *   10 G(0~99999) · 11 질병(v>0)/치료(v≤0) · 20 연봉(0x8cac0) · 21 엔딩 진입(0x8c460 은 무시 — 세션 몫).
 * 18(목표 타순 경로)·19(타순)는 타자 칸이고 투수편이 볼 수 있는 이벤트(대상 1·3·0)에 쓰이지 않아 두지 않는다.
 */

/** 소지금 보상 한 단위 = 100만원 (웹 소지금은 만원 단위) */
const MAXIMUM_MONEY = BALANCE.limits.moneyUnits * ORIGINAL_MONEY_UNIT
/** 질병 남은 기간 — 표 0xd4d98 = 0,3,3,3,3 */
const ILLNESS_DURATION = 3
/** 종류 13~16 → 능력치 칸 0~3 (제구·구속·변화·체력) */
const FIRST_ABILITY_KIND = 13
const LAST_ABILITY_KIND = 16
const HIDDEN_PITCH_KIND = 6
const HIDDEN_OPEN_KIND = 7

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value))

/** 칸 하나에 +v 하고 999 로, 이어서 보직 한계로 자른다 (0x8c758~0x8c8e4) */
function raisePitcherAbility(career: PitcherCareer, key: keyof PitcherAbility, value: number): PitcherCareer {
  const raised = Math.min(MAXIMUM_PITCHER_ABILITY, career.ability[key] + value)
  const limit = pitcherAbilityLimitsOf(career)[key]
  return { ...career, ability: { ...career.ability, [key]: raised > limit ? Math.min(limit, MAXIMUM_PITCHER_ABILITY) : raised } }
}

function applyReward(career: PitcherCareer, reward: EventReward, random: RandomPort | undefined): PitcherCareer {
  if (reward.kind >= FIRST_ABILITY_KIND && reward.kind <= LAST_ABILITY_KIND) {
    return raisePitcherAbility(career, PITCHER_ABILITY_ORDER[reward.kind - FIRST_ABILITY_KIND], reward.value)
  }
  switch (reward.kind) {
    case EVENT_REWARD_KIND.인기도:
      return gainPitcherPopularity(career, reward.value)
    case EVENT_REWARD_KIND.평판:
      return gainPitcherReputation(career, reward.value)
    case EVENT_REWARD_KIND.사기:
      return gainPitcherMorale(career, reward.value)
    case EVENT_REWARD_KIND.소지금:
      return { ...career, money: clamp(career.money + reward.value * ORIGINAL_MONEY_UNIT, 0, MAXIMUM_MONEY) }
    case EVENT_REWARD_KIND.스킬:
      return reward.value === 0 ? career : applySkillReward(career, reward.value)
    case HIDDEN_PITCH_KIND:
      return openHiddenPitchRow(career, reward.value)
    case HIDDEN_OPEN_KIND: {
      const id = Math.abs(reward.value)
      return career.openedHiddenIds.includes(id) ? career : { ...career, openedHiddenIds: [...career.openedHiddenIds, id] }
    }
    case EVENT_REWARD_KIND.GP아이템:
      return random === undefined ? career : applyPitcherGpItem(career, reward.value - 1, random).career
    case EVENT_REWARD_KIND.G포인트:
      return { ...career, gamePoint: clamp(career.gamePoint + reward.value, 0, MAXIMUM_GAME_POINT) }
    case EVENT_REWARD_KIND.질병:
      if (reward.value < 0) return { ...career, isSick: false, illnessName: null, illnessCooldown: ILLNESS_COOLDOWN }
      // 값 ≥ 0 은 알림 글 만들기(0x8c14e)가 bfa55(0,4)+1 로 다시 써 질병 종류가 된다 — 타자편과 같은 굴림
      return {
        ...career,
        illnessCooldown: ILLNESS_COOLDOWN,
        isSick: true,
        illnessRemaining: ILLNESS_DURATION,
        illnessName: random === undefined ? ILLNESS_NAMES[0] : random.pick(ILLNESS_NAMES),
      }
    case EVENT_REWARD_KIND.모든능력치:
      return PITCHER_ABILITY_ORDER.reduce((current, key) => raisePitcherAbility(current, key, reward.value), career)
    case EVENT_REWARD_KIND.연봉:
      return applySalaryChange(career, reward.value)
    default:
      return career
  }
}

/**
 * 목표 결과 이벤트의 **연차 보정** (0x8d508~0x8d5c4) — 나만의리그 갈래(0x7b999 거짓)는 모드 3·4 공용이다.
 * y = 연차idx(0부터). 393·394·395 → 종류 0 +3y · 1 −2y · 3 +y / 396 → 종류 0 −4y · 1 −3y.
 */
const YEAR_ADJUSTED_EVENTS: Readonly<Record<number, Readonly<Record<number, number>>>> = {
  393: { 0: 3, 1: -2, 3: 1 },
  394: { 0: 3, 1: -2, 3: 1 },
  395: { 0: 3, 1: -2, 3: 1 },
  396: { 0: -4, 1: -3 },
}

export function yearAdjustedPitcherRewards(
  rewards: readonly EventReward[],
  eventId: number | undefined,
  season: number,
): readonly EventReward[] {
  const table = eventId === undefined ? undefined : YEAR_ADJUSTED_EVENTS[eventId]
  const years = Math.max(0, season - 1)
  if (table === undefined || years === 0) return rewards
  return rewards.map((reward) => {
    const perYear = table[reward.kind]
    return perYear === undefined ? reward : { ...reward, value: reward.value + perYear * years }
  })
}

/**
 * 지나온 보상 명령을 차례대로 준다. `eventId` 는 연차 보정(393~396)을 가리는 번호다.
 * 무작위가 드는 종류(9 또또상품권 · 11 질병 이름)는 `random` 이 있을 때만 굴린다.
 */
export function applyPitcherEventRewards(
  career: PitcherCareer,
  rewards: readonly EventReward[],
  random?: RandomPort,
  eventId?: number,
): PitcherCareer {
  const rewarded = yearAdjustedPitcherRewards(rewards, eventId, career.season).reduce(
    (current, reward) => applyReward(current, reward, random),
    career,
  )
  return rewards.length > 0 && isMidSeasonEventId(eventId) ? markMidSeasonEvaluated(rewarded) : rewarded
}

/** 452~454 — 중간평가 이벤트 (0x8cbaa: `0x1c3 < id ≤ 0x1c6`) */
const isMidSeasonEventId = (eventId: number | undefined) =>
  eventId !== undefined && eventId >= MID_SEASON_EVENT_FIRST && eventId <= MID_SEASON_EVENT_LAST
const MID_SEASON_EVENT_FIRST = 452
const MID_SEASON_EVENT_LAST = 454

/**
 * 보상 실행기 끝(0x8cbaa~0x8cbdc) — 이벤트 452~454 의 보상을 마치면 `0xa424c(기록, 타자편?, 연차idx, 1)` 로
 * 그 해 중간평가 비트를 켠다 (모드 3 은 비트 13 + 연차idx).
 */
function markMidSeasonEvaluated(career: PitcherCareer): PitcherCareer {
  const yearIndex = career.season - 1
  if (career.midSeasonEvaluatedYears.includes(yearIndex)) return career
  return { ...career, midSeasonEvaluatedYears: [...career.midSeasonEvaluatedYears, yearIndex] }
}

/** 이벤트를 마친다 — 선택지로 이어 본 이벤트까지 모두 본 것으로 남긴다 (0xacf30 본 표시) */
export function finishPitcherEvent(career: PitcherCareer, viewedEventIds: readonly number[]): PitcherCareer {
  const added = [...new Set(viewedEventIds.map(String))].filter((id) => !career.seenEventIds.includes(id))
  return added.length === 0 ? career : { ...career, seenEventIds: [...career.seenEventIds, ...added] }
}
