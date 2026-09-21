/**
 * **히든 팀 다섯**(10 대한민국 · 11 일본 · 12 쿠바 · 13 미국 · 14 외인구단) 의 잠금 규칙 — J-1 확정.
 *
 * 오픈 플래그는 **전역 기록** `+0x70 + idx`(저장 객체 쪽에서는 `+0x7a + (idx−10)`)라 모드가
 * 달라도 하나를 본다. 여는 길은 두 가지뿐이다 (이벤트 보상으로 열리는 길은 없다):
 *   - 대한민국 — 국가대항전에 **나가기만 하면**
 *   - 일본·쿠바·미국 — 대한민국이 국가대항전에서 우승하면 그 **결승 상대**가 열린다
 *   - 외인구단 — **마선수 10명이 모두 열리면** (0x7b408)
 *
 * 그리고 열려 있어도 **일반모드에서만 고를 수 있다**: 팀 고르기 화면 0x14114 는 커서가 히든 팀일 때
 * StrMODE[1] "일반모드에서 사용 할 수 있습니다" 를 붙인다.
 */
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { TEAM_GAME_MODE } from '@/features/play-team-game/model/gameAbilities'

/** 히든 팀은 10번부터 다섯이다 (teams.ts 와 같은 번호) */
export const HIDDEN_TEAM_FIRST_ID = 10
export const HIDDEN_TEAM_COUNT = 5

/**
 * 힌트 팝업이 쓰는 StrMODE 번호.
 *   [225] "<히든 팀 오픈 힌트>" 머리글
 *   [216 + 팀] = [226]~[230] 팀별 한 줄 ("당신은 국가대표!" … "마선수 총출동!")
 *   [0] "선택 할 수 없는 팀입니다"  ·  [1] "일반모드에서 사용 할 수 있습니다"
 */
export const HIDDEN_HINT_TITLE = 225
export const HIDDEN_HINT_BASE = 216
export const TEAM_LOCKED_TEXT = 0
export const GENERAL_MODE_ONLY_TEXT = 1

export function isHiddenTeam(teamId: number): boolean {
  return teamId >= HIDDEN_TEAM_FIRST_ID && teamId < HIDDEN_TEAM_FIRST_ID + HIDDEN_TEAM_COUNT
}

/** 전역 기록 +0x70+idx 가 켜졌는가 — 0~9 는 늘 열려 있다 */
export function isTeamOpened(teamId: number, openedHiddenIds: readonly number[]): boolean {
  return !isHiddenTeam(teamId) || openedHiddenIds.includes(teamId)
}

/** 히든 팀을 고를 수 있는 모드 — **일반모드(1) 하나뿐**이다 (StrMODE[1]) */
export function canUseHiddenTeams(mode: number): boolean {
  return mode === TEAM_GAME_MODE.일반
}

/**
 * 지금 이 모드에서 이 팀을 고를 수 있는가.
 * 히든 팀은 ① 열려 있고 ② 일반모드일 때만 고를 수 있다.
 */
export function canSelectTeam(
  teamId: number,
  options: { readonly openedHiddenIds: readonly number[]; readonly mode: number },
): boolean {
  if (!isHiddenTeam(teamId)) return true
  return isTeamOpened(teamId, options.openedHiddenIds) && canUseHiddenTeams(options.mode)
}

/**
 * 못 고르는 히든 팀을 눌렀을 때 뜨는 팝업 글.
 *
 * 두 자리에서 서로 다르게 이어 붙인다:
 *   - **일반모드 팀 고르기**(상태 18·19, R4 3a): 잠겼으면 `[225] + [216+팀] + [0]`
 *   - **그 밖의 팀 고르기**(0x14114): 열렸으면 `[225] + [226+k] + [1]`,
 *     잠겼으면 `[225] + [226+k] + [0] + [1]`
 *
 * 고를 수 있는 경우(일반모드 + 열린 팀, 또는 히든이 아닌 팀)에는 `null` 이다.
 *
 * ⚠️ 이어 붙이는 형식 문자열 `0xcc1ec` 의 모양은 노트에 없다 — **그냥 이어 붙인다**.
 * 원본 StrMODE 값들이 이미 `!N` 으로 시작해 줄이 갈리므로 이것으로 충분해 보인다.
 */
export function hiddenTeamHintMessage(
  teamId: number,
  options: { readonly openedHiddenIds: readonly number[]; readonly mode: number },
): string | null {
  if (!isHiddenTeam(teamId)) return null
  const isOpened = isTeamOpened(teamId, options.openedHiddenIds)
  const isGeneralMode = canUseHiddenTeams(options.mode)
  if (isOpened && isGeneralMode) return null

  const parts = [ORIGINAL_MODE_TEXT[HIDDEN_HINT_TITLE], ORIGINAL_MODE_TEXT[HIDDEN_HINT_BASE + teamId]]
  if (!isOpened) parts.push(ORIGINAL_MODE_TEXT[TEAM_LOCKED_TEXT])
  if (!isGeneralMode) parts.push(ORIGINAL_MODE_TEXT[GENERAL_MODE_ONLY_TEXT])
  return parts.join('')
}
