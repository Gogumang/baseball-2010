import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { applySkillReward, gainAbility, gainMorale, gainPopularity, gainReputation } from '@/entities/career/model/playerCareer'
import type { EventCommand } from '@/shared/config/original/eventTypes'
import { ILLNESS_NAMES } from '@/entities/career/model/condition'
import { applySalaryChange } from '@/entities/career/model/seasonFlow'
import { battingOrderPathOf } from '@/entities/career/model/battingOrder'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { abilityLimitOf } from '@/entities/career/model/abilityLimit'
import { openHidden } from '@/entities/career/model/equipment'

/**
 * 원작 이벤트 보상 (r_event 명령 7).
 *
 * 종류별 처리는 점프 표 binary.mod 0xd4e50 이다 (누락 탐색·점검 에이전트가 코드로 확인):
 *   0·1·2  인기도·평판·사기 — 경기 후 감독 평가(452~454)가 이 순서로 준다.
 *          설명서 StrHOWTO[11] "감독에게 평가 받고 인기도, 평판, 사기가 변동" 과 같은 순서.
 *          사기는 "영지버섯… 사기가 솟아오른다"(104)에서도 확인된다.
 *   4      스킬 획득(+n → 스킬 n−1)·해제(−n) (0x8c5bc, 누락 탐색 3차)
 *   3      소지금, 100만원 단위 (0x8c556, 상한 9999) — 한국시리즈 우승 +10 = StrMODE[190] "+1000만"
 *   10     G포인트 (0x8c6ac, 상한 99999). 원본은 게임 전체 저장에 쌓지만 웹판은 커리어에 둔다
 *   11     질병 — 값 ≥ 0 이면 질병 1~4 중 무작위(StrMODE[186~189]), 음수면 치료 (0x8c718)
 * 상한은 보상 점프 표(0xd4e50)가 정한다 — 사기 0~100, 평판 999, 인기도 9999 (playerCareer 상한과 같다).
 *   18·19  목표 타순 경로 · 타순 (0xa4c2c) → battingOrder
 *   20     연봉 변동 (0x8cac0) → seasonFlow.applySalaryChange
 *   7      히든 오픈 — |값| = 오픈 id (0x8c60e, 누락 탐색 7차)
 *   13~16  능력치 인덱스 0~3(히트·파워·수비·주루)에 더하고 999, 이어서 타입 한계치로 자른다 (0x8c758)
 * 그 밖의 종류(6 마구, 21 엔딩)는 아직 적용하지 않는다 (21 은 세션이 엔딩 화면으로 넘긴다).
 */
export interface EventReward {
  readonly kind: number
  readonly value: number
}

export const EVENT_REWARD_KIND = {
  인기도: 0,
  스킬: 4,
  평판: 1,
  사기: 2,
  소지금: 3,
  G포인트: 10,
  연봉: 20,
  목표타순: 18,
  타순: 19,
  질병: 11,
} as const

export function rewardsIn(commands: readonly EventCommand[]): EventReward[] {
  return commands.flatMap((command) => (command.op === 'reward' ? command.items : []))
}

/** 소지금 보상 한 단위 = 100만원. 웹판 소지금은 만원 단위라 100 을 곱한다 */
const MONEY_REWARD_UNIT = 100
const MAXIMUM_MONEY = 9999 * MONEY_REWARD_UNIT
const MAXIMUM_GAME_POINT = 99_999
/** 질병·치료 뒤 이벤트 490 을 막는 값 (0x8c718 이 +0x7c 에 20 을 쓴다) */
export const ILLNESS_COOLDOWN = 20
const ILLNESS_DURATION = 3

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value))

const HIDDEN_OPEN_KIND = 7

/** 보상 종류 13~16 → 능력치 인덱스 0~3 */
const ABILITY_REWARD_KINDS: Readonly<Record<number, 'hit' | 'power' | 'defense' | 'run'>> = {
  13: 'hit',
  14: 'power',
  15: 'defense',
  16: 'run',
}

function applyReward(career: PlayerCareer, reward: EventReward, random: RandomPort | undefined): PlayerCareer {
  if (reward.kind === HIDDEN_OPEN_KIND) return openHidden(career, Math.abs(reward.value))
  const ability = ABILITY_REWARD_KINDS[reward.kind]
  if (ability !== undefined) {
    const raised = gainAbility(career, { [ability]: reward.value })
    const limit = abilityLimitOf(career.battingTypeIndex)[ability]
    return { ...raised, ability: { ...raised.ability, [ability]: Math.min(raised.ability[ability], limit) } }
  }
  switch (reward.kind) {
    case EVENT_REWARD_KIND.인기도:
      return gainPopularity(career, reward.value)
    case EVENT_REWARD_KIND.평판:
      return gainReputation(career, reward.value)
    case EVENT_REWARD_KIND.사기:
      return gainMorale(career, reward.value)
    case EVENT_REWARD_KIND.소지금:
      return { ...career, money: clamp(career.money + reward.value * MONEY_REWARD_UNIT, 0, MAXIMUM_MONEY) }
    case EVENT_REWARD_KIND.스킬:
      return applySkillReward(career, reward.value)
    case EVENT_REWARD_KIND.타순:
      return { ...career, battingOrder: reward.value }
    case EVENT_REWARD_KIND.목표타순:
      return { ...career, battingOrderPath: battingOrderPathOf(reward.value) }
    case EVENT_REWARD_KIND.연봉:
      return applySalaryChange(career, reward.value)
    case EVENT_REWARD_KIND.G포인트:
      return { ...career, gamePoint: clamp(career.gamePoint + reward.value, 0, MAXIMUM_GAME_POINT) }
    case EVENT_REWARD_KIND.질병:
      if (reward.value < 0) return { ...career, isSick: false, illnessName: null, illnessCooldown: ILLNESS_COOLDOWN }
      return {
        ...career,
        illnessCooldown: ILLNESS_COOLDOWN,
        isSick: true,
        // 질병 남은 기간 — 표 0xd4d98 = 0,3,3,3,3 (누락 탐색 7차)
        illnessRemaining: ILLNESS_DURATION,
        illnessName: random === undefined ? ILLNESS_NAMES[0] : random.pick(ILLNESS_NAMES),
      }
    default:
      return career
  }
}

export function applyEventRewards(
  career: PlayerCareer,
  rewards: readonly EventReward[],
  random?: RandomPort,
): PlayerCareer {
  return rewards.reduce((current, reward) => applyReward(current, reward, random), career)
}
