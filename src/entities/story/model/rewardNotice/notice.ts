import type { EventReward } from '@/entities/story/model/eventReward'
import { hiddenOpenWindowTextOf } from '@/entities/story/model/rewardNotice/otherSlices'
import { buildRewardText, yearAdjusted } from '@/entities/story/model/rewardNotice/rewardText'
import { REWARD_KIND, type RewardNoticeContext, type RewardNoticeResult } from '@/entities/story/model/rewardNotice/types'

/**
 * 보상 명령 하나의 알림 (0x8d4c4). 이벤트 번호는 연차 보정(393~396)을 가린다 — 보정한 값은 글에만 쓰고
 * 돌려주는 항목에는 담지 않는다(`applyEventRewards` 가 다시 보정한다).
 */
export function rewardNoticeOf(items: readonly EventReward[], eventId: number, ctx: RewardNoticeContext): RewardNoticeResult {
  const first = items[0]?.kind
  if (first === REWARD_KIND.엔딩) return { notice: { kind: '엔딩' }, items }
  const adjusted = yearAdjusted(items, eventId, ctx)
  const built = buildRewardText(adjusted, ctx)
  // 연차 보정은 종류 0 · 1 · 3 만 건드린다 — 질병 굴림만 원래 항목에 옮긴다
  const resolved = items.map((item, index) => (item.kind === REWARD_KIND.질병 && item.value >= 0 ? (built.items[index] ?? item) : item))
  if (first === REWARD_KIND.스킬) {
    return { notice: { kind: '스킬', text: built.text, gained: (adjusted[0]?.value ?? 0) > 0 }, items: resolved }
  }
  if (first === REWARD_KIND.히든오픈) {
    const text = hiddenOpenNoticeTextOf(items)
    return { notice: text === null ? { kind: '없음' } : { kind: '알림', text }, items: resolved }
  }
  return { notice: { kind: '알림', text: built.text }, items: resolved }
}

/**
 * **첫 종류 7 의 창 글** — 0x8c460 이 항목마다 종류 7 이면 0x62368(전역, |값|, 1)을 부른다. 셋째 인자 1 이라 이미 열렸는지
 * (0x61f5c)를 안 보고 **늘** 공용 창을 띄운다(R13 11절). 글은 0x62368 원문 마크업 그대로 — k ≥ 13 이면 StrCOMMON[139]
 * "!C히든 아이템 오픈!!!N[이름]" + "!N!N"(0xd1720 두 번) + 쓰는 곳 줄(13~18 [141] 시즌 · 19~34 [142] 투수편 · 35~50 [143] 타자편,
 * 0x62420~0x62480), k ≤ 12 는 [140] 마선수 · [138] 히든 팀 한 줄 — 모드와 상관없이 k 로 갈린다(투수편 장소 이벤트 304 · 305 의
 * 타자 k 도 타자편 글). 공용 알림 창과 같은 글 함수(`hiddenOpenNoticeTextOf`)를 쓴다.
 * 한 명령에 종류 7 이 여럿이면 0x62368 이 같은 창을 차례로 다시 세워 **마지막 것**이 남는다(유력 — 데이터의 종류 7 명령
 * 304 · 305 · 306 · 307 은 모두 한 항목이라 겉으로 갈리지 않는다). 웹이 글을 못 짓는 k(51 이상)면 null.
 */
function hiddenOpenNoticeTextOf(items: readonly EventReward[]): string | null {
  const opened = items.filter((item) => item.kind === REWARD_KIND.히든오픈)
  const last = opened[opened.length - 1]
  if (last === undefined) return null
  return hiddenOpenWindowTextOf(Math.abs(last.value))
}
