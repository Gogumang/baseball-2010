import type { PlayerDetailSource } from '@/entities/season-mode/model/entryEditor'
import { ACE_PLAYERS } from '@/shared/config/original/acePlayers'
import {
  ACE_BATTER_TYPE_TEXT,
  BATTER_TYPE_TEXT,
  DETAIL_NONE_TEXT,
  type DetailRowValue,
  HAND_TEXT,
  type PlayerDetail,
  skillNamesOf,
  specialSwingTextOf,
  textValue,
  tickerOrNone,
} from '@/widgets/player-detail-window/lib/playerDetailWindow/detailTexts'

/**
 * 타자 갈래(종류 2, 0x5b81e~) — 29 타입 · 30 손 · 33 스킬 · 35 필살 · 86 연봉.
 * 손 0xb63c0 타자 갈래(마타자는 표 0xd88b0, 그 밖은 +0xb 비트 4)는 부르는 쪽이 셈해 넘긴다(`batterHand`).
 */
export function batterDetailOf(source: PlayerDetailSource, salary: DetailRowValue, batterHand: number): PlayerDetail {
  const battingType = source.profile >> 5
  return {
    kind: '타자',
    abilities: source.abilities,
    values: [
      textValue(batterTypeTextOf(battingType, source.aceIndex)),
      textValue(HAND_TEXT.batter[batterHand] ?? ''),
      tickerOrNone(skillNamesOf(source.skillBits, false)),
      specialValueOf(source, battingType),
      salary,
    ],
  }
}

/** 타입 — 마타자는 StrCOMMON[0x69 + 순번], 그 밖은 +0xb >> 5 (타격형 · 장타형) */
function batterTypeTextOf(battingType: number, aceIndex: number): string {
  if (aceIndex >= 0) return ACE_BATTER_TYPE_TEXT[aceIndex] ?? ''
  return BATTER_TYPE_TEXT[battingType] ?? ''
}

/** 필살 — 마타자는 그 버스트 이름, 레코드 +0x18 이 있으면 그 이름(5bd90~5be0e), 없으면 "-" */
function specialValueOf(source: PlayerDetailSource, battingType: number): DetailRowValue {
  if (source.aceIndex >= 0) return { kind: 'ticker' as const, text: ACE_PLAYERS[source.aceIndex]?.burst ?? '' }
  if ((source.specialNumber ?? 0) > 0) return { kind: 'ticker' as const, text: specialSwingTextOf(source.specialNumber ?? 0, battingType) }
  return textValue(DETAIL_NONE_TEXT)
}
