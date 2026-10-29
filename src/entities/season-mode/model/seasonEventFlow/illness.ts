import type { RandomPort } from '@/shared/api/random/randomPort'
import { isBugFixed } from '@/shared/config/bugfixes'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'

/** 질병 종류 수 (1~4, StrMODE[186+r]) — 보상 글 0x8beb8 의 `rand(0,4) + 1` */
export const ILLNESS_KIND_COUNT = 4
/** 질병이 걸리거나 나을 때 SR+0x7c 에 넣는 쿨다운 (0x8c738 · 0x8c74a) */
export const ILLNESS_COOLDOWN = 20
/** `0xd4d98[종류]` — SR+6 (0 = 건강 · 1~4 = 3) */
export const ILLNESS_SLACK_TABLE: readonly number[] = [0, 3, 3, 3, 3]
/** 질병에 걸릴 때 들어가는 SR+6 (`0xd4d98[1~4]` = 3) */
export const ILLNESS_SLACK_ON_CATCH = 3

/** 입원 치료 확률의 경계 — `r = rand(0,101)` 이 89 이하면 낫는다 (90/101) */
export const HOSPITAL_CURE_THRESHOLD = 89

export interface IllnessCureResult {
  readonly record: SeasonRecord
  readonly cured: boolean
}

/**
 * 외출 "입원" 의 치료 굴림 (`0xcc6a`).
 * `r ≤ 89` 이거나 남은 여유 칸이 0 이면 낫고, 아니면 여유 칸이 하나 준다(0 바닥).
 * 낫지 못해도 여유 칸이 0 이 되면 다음엔 반드시 낫는다.
 */
export function cureIllnessAtHospital(record: SeasonRecord, random: RandomPort): IllnessCureResult {
  const roll = random.rand(0, 101)
  if (roll <= HOSPITAL_CURE_THRESHOLD || record.illnessSlack === 0) {
    return {
      record: { ...record, illness: 0, illnessSlack: 0, illnessCooldown: ILLNESS_COOLDOWN },
      cured: true,
    }
  }
  return { record: { ...record, illnessSlack: Math.max(record.illnessSlack - 1, 0) }, cured: false }
}

/** GP 아이템 칸 2 는 무조건 낫는다 (StrMODE[123]) */
export function cureIllnessByItem(record: SeasonRecord): SeasonRecord {
  return { ...record, illness: 0, illnessSlack: 0, illnessCooldown: ILLNESS_COOLDOWN }
}

/**
 * 질병 중에는 내 팀 선수 전원의 경기용 능력치가 30% 깎인다 (`0xb5824`).
 * ⚠️ 원본이 보는 칸은 질병 종류 SR+5 가 아니라 **s8 SR+6 > 0** 이다 (b5824 `movs r3,#6 ; ldrsb`) —
 * 입원에 실패해 SR+6 이 0 까지 내려가면 아직 앓고 있어도(SR+5 ≠ 0) 깎이지 않는다. 원본 그대로.
 */
export const ILLNESS_ABILITY_PENALTY_PERCENT = 30

/**
 * 경기 능력치 보정이 보는 질병 칸 — SR+6 (`0xb5824`).
 * ⚠️ 원본 버그(B-80): 상세 글 0x897e8(89df6 `ldrb [SR,#5]`)은 질병 종류 SR+5 로 "질병 30% 감소" 줄을 띄우는데 실제 −30% 는 SR+6 을 봐서,
 * 입원에 세 번 실패해 SR+6 이 0 이 되면 앓고 있어도 줄만 뜨고 깎이지 않는다.
 * **고침(bugfixes.json B-80, 기본 켬)**: 실제 −30% 도 질병 종류 SR+5 를 본다 — 앓는 동안 늘 깎인다(글과 같다). 굴림 없음
 * (그 드문 판에서 내 팀 능력치가 30% 깎여 경기 결과가 바뀔 수 있다).
 */
export function illnessPenaltyFieldOf(record: Pick<SeasonRecord, 'illness' | 'illnessSlack'>): number {
  return isBugFixed('B-80') ? record.illness : record.illnessSlack
}

/** 팀 능력치 정액 감소의 사기 구간 — 사기가 경계보다 크면 그 감소 (J-4). 가장 낮은 구간 아래는 200 */
const MORALE_PENALTY_BY_MORALE: readonly (readonly [moraleAbove: number, penalty: number])[] = [
  [50, 0],
  [30, 50],
  [10, 100],
]
const MORALE_PENALTY_LOWEST = 200

/** 팀 능력치 정액 감소 — 사기 구간별 (J-4). 질병은 여기가 아니라 별도로 −30% 다 */
export function moralePenaltyOf(teamMorale: number): number {
  const band = MORALE_PENALTY_BY_MORALE.find(([moraleAbove]) => teamMorale > moraleAbove)
  return band === undefined ? MORALE_PENALTY_LOWEST : band[1]
}
