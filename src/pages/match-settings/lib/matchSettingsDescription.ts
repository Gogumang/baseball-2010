import { MATCH_SETTING_KIND } from '@/features/play-team-game/model/matchSettings'
import { DETAIL_ROW, SETTINGS_STAGE } from '@/pages/match-settings/lib/matchSettingsMenu'
import type { MatchSettingsWindowState } from '@/pages/match-settings/lib/matchSettingsMenu'
import { CHANCE_DESCRIPTIONS, DETAIL_ROW_DESCRIPTIONS, INNING_DESCRIPTIONS, KIND_DESCRIPTIONS } from '@/pages/match-settings/lib/matchSettingsText'

/** 상세 칸 이름 — 타순 1~9번 · 1~8회와 9회 이후 전부 · 1·2·3루 (R4 4절) */
export function cellLabelOf(row: number, cell: number): string {
  if (row === DETAIL_ROW.타자조작) return `${cell + 1}번`
  // 칸 8 은 9회 하나가 아니라 **9회 이후 전부**(연장 포함)다
  if (row === DETAIL_ROW.투수조작) return cell < 8 ? `${cell + 1}회` : '9회~'
  return `${cell + 1}루`
}

/**
 * 설명 칸의 글 — 종류 0xd1c7c[종류] · 찬스 0xd1c88[값] · 이닝 0xd1c9c[값] · 상세 StrMAINMENU[121 + 줄].
 * 상세의 확인 줄(4)은 글을 안 그린다(61b18 `cmp 줄,#4 · beq`).
 */
export function descriptionOf(state: MatchSettingsWindowState): string {
  const { kind, value } = state.settings
  if (state.stage === SETTINGS_STAGE.종류) return KIND_DESCRIPTIONS[kind] ?? ''
  if (kind === MATCH_SETTING_KIND.찬스) return CHANCE_DESCRIPTIONS[value] ?? ''
  if (kind === MATCH_SETTING_KIND.이닝) return INNING_DESCRIPTIONS[value] ?? ''
  return DETAIL_ROW_DESCRIPTIONS[state.detailRow] ?? ''
}
