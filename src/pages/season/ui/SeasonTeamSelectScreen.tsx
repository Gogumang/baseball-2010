import { useState } from 'react'
import { MessageBox } from '@/shared/ui'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { TeamSelectScreen } from '@/pages/create-player/ui/TeamSelectScreen'

/** 0xca 에서 고를 수 있는 칸의 끝 — 칸 > 9(히든 팀 10~14)는 힌트만 띄운다 (0x8e06 `cmp r3, #9`) */
const LAST_PICKABLE_TEAM = 9
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
  return openedHiddenIds.includes(teamId)
    ? `${title}!N${hint}!N!N${generalModeOnly}`
    : `${title}!N${hint}!N!N${cannotPick}!N${generalModeOnly}`
}

export interface SeasonTeamSelectScreenProps {
  /** 전역 저장 +0x70 + 칸 — 열린 히든 팀은 격자에 그림이 서지만 시즌에서는 고를 수 없다 */
  readonly openedHiddenIds?: readonly number[]
  /** 칸 0~9 를 골랐다 — 원본은 0xc8 이름 입력으로 간다 */
  readonly onPick: (teamId: number) => void
  /**
   * 취소(−16) — 0x8ec8: [0x140006c] = 5 · 0xbc290(앱, 0x103) 으로 메인 메뉴 장면에 나간다 (관리 메뉴 취소와 같다).
   * ⚠️ 그 뒤 [0x1552d14] = 1 을 쓰는데 그 칸의 뜻은 못 풀었다 — 옮기지 않았다.
   */
  readonly onExit: () => void
}

/**
 * **시즌 팀 고르기 0xca** — 키는 그림 함수 0x8da4 안(메뉴 this+0x98). 격자는 선수 등록 쪽 `TeamSelectScreen` 을 빌린다.
 * ```
 * 확인(−5 · '5')  칸 ≤ 9 → 0xc8 (이름 입력)
 *                칸 > 9 → 히든 팀 힌트 팝업 (`hiddenTeamHintOf`) — 열린 팀이어도 시즌에서는 못 고른다
 * 취소(−16)       → 메인 메뉴 (0x140006c = 5)
 * ```
 */
export function SeasonTeamSelectScreen({ openedHiddenIds = [], onPick, onExit }: SeasonTeamSelectScreenProps) {
  const [hint, setHint] = useState<string | null>(null)

  const pick = (teamId: number) => {
    if (teamId > LAST_PICKABLE_TEAM) return setHint(hiddenTeamHintOf(teamId, openedHiddenIds))
    onPick(teamId)
  }

  return (
    <TeamSelectScreen title="시즌모드" openedHiddenIds={openedHiddenIds}
      onSelect={pick} onSelectLocked={pick} onCancel={onExit}
      overlay={hint !== null && <MessageBox text={hint} buttons={['확인']} onAnswer={() => setHint(null)} />} />
  )
}
