import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { hiddenTeamUnlockIdOf, isUnlocked } from '@/shared/config/unlocks'

/** 히든 팀 첫 칸 — 힌트 글은 StrMODE[226 + (칸 − 10)] */
const FIRST_HIDDEN_TEAM = 10

/**
 * 히든 팀 힌트 팝업 글 — 0x8e18~0x8ec2 (직접 떴다). 칸은 메뉴 +0xc(열)로 고르고 해금은 전역 +0x70 + 칸:
 * ```
 * 열렸으면   sprintf("%s!N%s!N!N%s",      [225], [226 + 열], [1])
 * 아니면     sprintf("%s!N%s!N!N%s!N%s",  [225], [226 + 열], [0], [1])   → 팝업 (1, 1, 1)
 * ```
 * [225] "<히든 팀 오픈 힌트>" · [226~230] 팀별 힌트 · [0] "선택 할 수 없는 팀입니다" · [1] "일반모드에서 사용 할 수 있습니다".
 * 트레이드 팀 고르기 0xe4(0x82c2~0x8374)도 같은 글이다.
 */
export function hiddenTeamHintOf(teamId: number, openedHiddenIds: readonly number[]): string {
  const title = ORIGINAL_MODE_TEXT[225] ?? ''
  const hint = ORIGINAL_MODE_TEXT[226 + teamId - FIRST_HIDDEN_TEAM] ?? ''
  const cannotPick = ORIGINAL_MODE_TEXT[0] ?? ''
  const generalModeOnly = ORIGINAL_MODE_TEXT[1] ?? ''
  // 해금 표(`unlocks.json`)가 풀면 열린 팀의 글([0] 줄 없음)이다
  const unlockId = hiddenTeamUnlockIdOf(teamId)
  const original = () => openedHiddenIds.includes(teamId)
  return (unlockId === null ? original() : isUnlocked(unlockId, original))
    ? `${title}!N${hint}!N!N${generalModeOnly}`
    : `${title}!N${hint}!N!N${cannotPick}!N${generalModeOnly}`
}
