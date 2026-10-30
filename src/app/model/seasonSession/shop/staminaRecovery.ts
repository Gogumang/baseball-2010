import type { AnnalsStatEvent } from '@/entities/collection/model/annalsStats'
import { SEASON_STAMINA_ITEM, seasonGpItemPriceOf, FULL_PITCHER_STAMINA } from '@/entities/season-mode/model/seasonItemShop'
import { recordAceSeatOf, SEASON_RECORD_ACE_PITCHER_SLOT, type SeasonRecordAces } from '@/entities/season-mode/model/seasonEntry'
import { SEASON_STAT_MODE } from '@/app/model/seasonSession/constants/seasonConstants'
import { recordPitcherIndexOf } from '@/app/model/seasonSession/roster/roster'
import type { SeasonSave } from '@/app/model/seasonSession/save/seasonSave'

/** 0xe8 스태미나 목록 칸이 가리키는 것 — 레코드 마투수 줄, 또는 명단 투수 첨자 */
type StaminaTarget = { readonly kind: '마투수'; readonly aces: SeasonRecordAces } | { readonly kind: '명단'; readonly rosterIndex: number }

/**
 * 0x5870 목록은 레코드 그대로라 남은 마투수가 8번 칸에 있고 옛 8번은 맨 끝이다(`SeasonRecordAces`) — 목록 칸을 레코드 줄로.
 * 대상 팀은 0x7c38 `0x1f9a9(저장, 모드, SR[1])` → 0x1f570 — 대회 중(S+0x12c)이면 상대국 칸 +0x934 를 돌려줄 꼴이지만,
 * 0xe8 에 들어오는 길이 GP 상점 0x7d90(8014) 하나 · 0xdc ← 0xd0 ← 관리 메뉴 0xc9 뿐이고 대회 중 진입 0x4b50(4bc2~4bd2)은 0xf3 으로,
 * 대회 고리(0xf3 0xe6f8 → 0xf4 0x4a18 → 0xdd ⇄ 0xe0 → 경기)에는 0xc9 를 세우는 곳이 없어 대회 중엔 닿지 않는다 — 늘 리그 칸(R9 19-2)
 */
export function staminaTargetOf(current: SeasonSave, recordIndex: number): StaminaTarget {
  const myTeamId = current.state.record.teamId
  const aces = current.recordAces?.[myTeamId]
  const seat = recordAceSeatOf(current.roster.pitchers.length, aces === undefined ? -1 : aces.pitcher, SEASON_RECORD_ACE_PITCHER_SLOT)[recordIndex]
  if (seat === 'ace' && aces !== undefined) return { kind: '마투수', aces }
  return {
    kind: '명단',
    rosterIndex: recordPitcherIndexOf(current, myTeamId, current.roster, seat === undefined || seat === 'ace' ? recordIndex : seat),
  }
}

/** 7c5c~7c64 — 마투수 레코드 +0x2c 도 같은 검사 · 같은 값(마선수 거름 없음) */
export function isAceStaminaFull(aces: SeasonRecordAces): boolean {
  return (aces.pitcherStamina ?? FULL_PITCHER_STAMINA) === FULL_PITCHER_STAMINA
}

/** 마투수 줄 +0x2c = 10000 — 다음 0xdd · CPU 경기 넣기가 줄을 통째 덮는다 */
export function withAceStaminaFull(current: SeasonSave, aces: SeasonRecordAces): SeasonSave {
  const myTeamId = current.state.record.teamId
  return { ...current, recordAces: { ...current.recordAces, [myTeamId]: { ...aces, pitcherStamina: FULL_PITCHER_STAMINA } } }
}

/** 명단 투수 +0x2c = 10000 */
export function withPitcherStaminaFull(current: SeasonSave, rosterIndex: number): SeasonSave {
  const pitchers = current.roster.pitchers.map((player, index) => (index === rosterIndex ? { ...player, stamina: FULL_PITCHER_STAMINA } : player))
  return { ...current, roster: { ...current.roster, pitchers } }
}

/** 0x7ca2~0x7cc0 — G −= 0xcbbe3[3] × 100 · 0x22c29(3, 값) · 0x22e35(2, 3) */
export function payStaminaItem(spendGamePoint: (cost: number) => void, recordStat: ((event: AnnalsStatEvent) => void) | undefined): void {
  spendGamePoint(seasonGpItemPriceOf(SEASON_STAMINA_ITEM))
  recordStat?.({ kind: 'GP아이템수', mode: SEASON_STAT_MODE, index: SEASON_STAMINA_ITEM })
}
