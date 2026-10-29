import type { RandomPort } from '@/shared/api/random/randomPort'
import { ILLNESS_NAMES, salaryOfferOf, type SalaryHolder } from '@/entities/story/model/rewardNotice/otherSlices'
import { SEASON_MODE, type RewardNoticeContext, type RewardNoticeMode } from '@/entities/story/model/rewardNotice/types'

/** 알림 글이 읽는 선수 칸 — 나리 타자편 `PlayerCareer` · 투수편 `PitcherCareer` 가 같은 이름으로 든다 */
export interface RewardNoticeCareer extends SalaryHolder {
  /** 1 기준 연차 — 연차 보정 y = 연차 − 1 (`applyEventRewards` 와 같은 잣대) */
  readonly season: number
  readonly isSick: boolean
  readonly illnessName: string | null
}

/** 나리 두 편의 알림 맥락 — 모드 4 타자편 · 3 투수편 */
export function rewardNoticeContextOf(career: RewardNoticeCareer, mode: RewardNoticeMode, random: RandomPort): RewardNoticeContext {
  const illnessIndex = career.isSick && career.illnessName !== null ? ILLNESS_NAMES.indexOf(career.illnessName) + 1 : 0
  return {
    mode,
    years: Math.max(0, career.season - 1),
    illness: Math.max(0, illnessIndex),
    salaryBase: salaryOfferOf(career).salary,
    random,
  }
}

/** 시즌모드 알림 글이 읽는 기록 칸 — `SeasonRecord` 가 같은 이름으로 든다 */
export interface SeasonRewardNoticeRecord {
  /** 연차 idx SR+0xb3 (0부터) — 연차 보정 y */
  readonly yearIndex: number
  /** 지금 질병 SR+5 — 0 없음 · 1~4 */
  readonly illness: number
}

/**
 * 시즌모드(모드 2)의 알림 맥락 — 0x8beb8 은 모드 2 에서도 같은 함수다: 13~16 이름 +9 · GP 이름 StrITEM 119 + 값 − 1 ·
 * 연차 보정(0x8d508) 모드 2 갈래. 선수 칸은 시즌 기록(SR)이다.
 * 연봉(종류 20)의 0xa39fc(선수) 는 s_event 에 그 종류가 없어(seasonEvents.json 종류 0 · 1 · 3 · 10 · 11 · 21 뿐 — r126 전수) 값을 두지 않는다 — 0(쓰이지 않는다).
 */
export function seasonRewardNoticeContextOf(record: SeasonRewardNoticeRecord, random: RandomPort): RewardNoticeContext {
  return { mode: SEASON_MODE, years: record.yearIndex, illness: record.illness, salaryBase: 0, random }
}
