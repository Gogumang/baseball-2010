import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { EVENT_REWARD_KIND, type EventReward } from '@/entities/story/model/eventReward'
import { applyBattingOrderRewards } from '@/entities/career/model/nariTeamRecord'
import { BATTER_LEAGUE_MODE, type AnnalsStatEvent } from '@/entities/collection/model/annalsStats'
import { hiddenOpenNoticeTextOf } from '@/entities/collection/model/hiddenOpenNotice'

/**
 * 보상 19(0x8ca7e)는 타순 칸이 아니라 레코드를 고친다 — `0xb5d09(내 팀, 내 칸, 값 − 1)` 로 셋이 돈다. 레코드는 보상 앞
 * 커리어(`before`) 로 고르고 보상 뒤 커리어(`rewarded`)에 얹는다
 */
export function withBattingOrderRewards(before: PlayerCareer, rewarded: PlayerCareer, items: readonly EventReward[]): PlayerCareer {
  const orderMoves = applyBattingOrderRewards(
    before,
    items.filter((reward) => reward.kind === EVENT_REWARD_KIND.타순).map((reward) => reward.value),
  )
  return orderMoves === null ? rewarded : { ...rewarded, ...orderMoves }
}

/** 이벤트 G 보상 0x8c6ac 는 한 줄마다 0x8c6e2 `0x22c7d(값, 전역 모드)` 로 적는다 (G 보상에는 연차 보정이 없다) */
export function recordEventGamePoints(recordStat: (event: AnnalsStatEvent) => void, items: readonly EventReward[]): void {
  items
    .filter((reward) => reward.kind === EVENT_REWARD_KIND.G포인트)
    .forEach((reward) => recordStat({ kind: 'G획득', mode: BATTER_LEAGUE_MODE, amount: reward.value }))
}

/** 보상 종류 7 — 0x8c60e `0x62368(전역, |v|, 1)`: 셋째 인자 1 이라 이미 열렸어도 늘 공용 창(떠 있으면 대기 칸) */
export function announcedHiddenIdsOf(items: readonly EventReward[]): readonly number[] {
  return items
    .filter((reward) => reward.kind === EVENT_REWARD_KIND.히든오픈)
    .map((reward) => Math.abs(reward.value))
    .filter((id) => hiddenOpenNoticeTextOf(id) !== null)
}
