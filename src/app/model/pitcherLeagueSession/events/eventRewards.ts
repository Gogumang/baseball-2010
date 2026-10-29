import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { nariSeasonEndStateOfResumeCode, rewardItemsResumeCodeOf, rewardResumePatchOf } from '@/entities/story/model/storyScene'
import type { EventReward } from '@/entities/story/model/eventReward'
import { hiddenOpenNoticeTextOf } from '@/entities/collection/model/hiddenOpenNotice'
import { withPitcherNationalCupEntered } from '@/app/model/pitcherLeagueSession/nationalCup/nationalCupEntry'

/**
 * 보상 명령 뒤 이어하기 자리 — 0x8c460 끝 8cc2e(나리 갈래, 모드 3 이라 393~396 은 0xd) → 8cd44 저장 (`rewardResumePatchOf`).
 * 464 의 S+0x12c = 0 은 웹이 464 앞에 대회를 세우지 않아 이미 그 값이다.
 * 그 앞, 줄을 도는 동안 보상 20(연봉)은 8cb90 에서 S+0x50 = 0xa 를 쓴다(`rewardItemsResumeCodeOf` — 웹 133).
 */
export function withPitcherRewardResumePatch(career: PitcherCareer, eventId: number, items: readonly EventReward[]): PitcherCareer {
  const itemsCode = rewardItemsResumeCodeOf(items)
  const itemsState = itemsCode === null ? undefined : nariSeasonEndStateOfResumeCode(itemsCode)
  const salaried = itemsState === undefined || career.seasonEndState === itemsState ? career : { ...career, seasonEndState: itemsState }
  const patch = rewardResumePatchOf(eventId, '나리투수')
  if (patch === null) return salaried
  if (patch.nationalCup === true) return withPitcherNationalCupEntered(salaried)
  const state = nariSeasonEndStateOfResumeCode(patch.resumeCode)
  return salaried.seasonEndState === state ? salaried : { ...salaried, seasonEndState: state }
}

/** 보상 종류 7 — 히든 오픈 |v| */
const HIDDEN_OPEN_REWARD_KIND = 7

/**
 * 보상 종류 7 의 히든 k — 0x8c60e 가 `0x62368(…, |v|, 1)` 을 부른다. 셋째 인자 1 이면 이미 열렸는지(0x61f5c)를
 * 보지 않고 **늘** 공용 창(0x74ef5)을 띄운다 — 글은 공용 알림 창의 원문 마크업(`hiddenOpenNoticeTextOf`).
 */
export function hiddenOpenRewardIdsOf(rewards: readonly EventReward[]): number[] {
  return rewards
    .filter((reward) => reward.kind === HIDDEN_OPEN_REWARD_KIND)
    .map((reward) => Math.abs(reward.value))
    .filter((id) => hiddenOpenNoticeTextOf(id) !== null)
}
