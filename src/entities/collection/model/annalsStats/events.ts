import { addGamePointEarned, addGamePointUsage, leagueUsageOf } from '@/entities/collection/model/annalsStats/gamePoints'
import { countItemPurchase } from '@/entities/collection/model/annalsStats/itemPurchases'
import { addPlayTime, countLeagueFirst } from '@/entities/collection/model/annalsStats/playTime'
import { addRecordCounts, markAchievement } from '@/entities/collection/model/annalsStats/records'
import { markSkillEquipped } from '@/entities/collection/model/annalsStats/skills'
import type { AnnalsStats } from '@/entities/collection/model/annalsStats/types'

/** 기록연감에 쌓는 통계 한 건 — 세션이 원본 호출 자리에서 낸다 */
export type AnnalsStatEvent =
  /** `0x22e35` + `0x22c29` — 나리 상점 GP 아이템 구매 확정 (0x14ffe · 0x1501e) */
  | { readonly kind: 'GP아이템구매'; readonly mode: number; readonly index: number; readonly price: number }
  /**
   * `0x22e35` 단독 — 시즌 GP 상점은 `0x22c29(3, 값)` → 효과 0xa310c → `0x22e35(2, 칸)` 으로 두 칸을 따로 적는다
   * (0x8058 · 0x8086, 0xe8 십전대보탕 0x7cd8 · 0x7ce8). 나리 차례(`GP아이템구매`)와 사용처가 달라 나눴다
   */
  | { readonly kind: 'GP아이템수'; readonly mode: number; readonly index: number }
  /** `0x22c29` 단독 */
  | { readonly kind: 'G사용'; readonly usage: number; readonly amount: number }
  /** `0xb663c` 가 새로 켤 때 */
  | { readonly kind: '스킬장착'; readonly mode: number; readonly skillId: number }
  /** `0x22c7d` — G 를 얻은 자리 */
  | { readonly kind: 'G획득'; readonly mode: number; readonly amount: number }
  /** `0x22e10` — 경기 끝(0x4ec8a) 이번 경기 기록달성 횟수를 누계에 더한다. 번호를 난 횟수만큼 */
  | { readonly kind: '기록달성'; readonly recordIds: readonly number[] }
  /** `0x22dd4` — 달성 표시 k (리그 1위 1·5·10회 = 0·1·2, 전부 수집 = 3~7) */
  | { readonly kind: '달성표시'; readonly index: number }
  /** `0x4e8b0` — 장면 시작(또는 지난 누계)부터 지난 밀리초를 그 모드 칸에 (`playClock.lapPlayClock`) */
  | { readonly kind: '플레이시간'; readonly mode: number; readonly elapsed: number }
  /** `0xb818c` 정규시즌 1위 — `+0xfc + 2·칸` (`countLeagueFirst`) */
  | { readonly kind: '리그1위'; readonly mode: number }

/**
 * 장착 목록이 바뀐 사이에 **새로 켜진** 스킬마다 `스킬장착` 한 건 — `0xb663c` 는 이미 켜진 스킬엔 들어오지 않으니
 * 앞뒤 장착 목록을 견줘 새로 생긴 번호만 낸다. 켜는 길(창 0x147b0 · 획득 0xa4bd8)이 어디든 같은 칸이다.
 */
export function skillEquipStatEventsOf(mode: number, before: readonly number[], after: readonly number[]): AnnalsStatEvent[] {
  return after
    .filter((skillId, index) => !before.includes(skillId) && after.indexOf(skillId) === index)
    .map((skillId) => ({ kind: '스킬장착', mode, skillId }))
}

type EventOfKind<K extends AnnalsStatEvent['kind']> = Extract<AnnalsStatEvent, { readonly kind: K }>
type ApplyByKind = { readonly [K in AnnalsStatEvent['kind']]: (stats: AnnalsStats, event: EventOfKind<K>) => AnnalsStats }

/** 사건 종류 → 통계 칸 적기 */
const APPLY_BY_KIND: ApplyByKind = {
  // 0x14ffe 0x22e35(모드, 칸) → 0x1501e 0x22c29(모드 4 ? 1 : 2, 값) 순서
  GP아이템구매: (stats, event) => addGamePointUsage(countItemPurchase(stats, event.mode, event.index), leagueUsageOf(event.mode), event.price),
  GP아이템수: (stats, event) => countItemPurchase(stats, event.mode, event.index),
  G사용: (stats, event) => addGamePointUsage(stats, event.usage, event.amount),
  G획득: (stats, event) => addGamePointEarned(stats, event.amount, event.mode),
  달성표시: (stats, event) => markAchievement(stats, event.index),
  기록달성: (stats, event) => addRecordCounts(stats, event.recordIds),
  플레이시간: (stats, event) => addPlayTime(stats, event.mode, event.elapsed),
  리그1위: (stats, event) => countLeagueFirst(stats, event.mode),
  스킬장착: (stats, event) => markSkillEquipped(stats, event.mode, event.skillId),
}

export function applyAnnalsStat(stats: AnnalsStats, event: AnnalsStatEvent): AnnalsStats {
  const apply = APPLY_BY_KIND[event.kind] as (stats: AnnalsStats, event: AnnalsStatEvent) => AnnalsStats
  return apply(stats, event)
}
