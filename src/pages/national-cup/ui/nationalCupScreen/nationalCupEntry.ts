import { TEAMS } from '@/shared/config/original/teams'
import type { NationalCup } from '@/entities/national-cup/model/nationalCup'
import { hiddenTeamOpenText, newlyOpenedHiddenTeamsOf, queuedPopupsOf } from '@/entities/national-cup/model/nationalCupFlow'

/** 134 에 들어설 때 걸리는 팝업 — 히든 팀 오픈(0x22) · 칭호(0x1274c 창, 높이 0x78) */
export type EntryPopup = { readonly kind: '히든팀'; readonly text: string } | { readonly kind: '칭호'; readonly title: string }

export interface EntryState {
  /** 이번 진입이 처음 연 히든 팀 (팝업이 대기 칸에서 밀려도 열기는 다 일어난다) */
  readonly openedTeams: readonly number[]
  readonly popups: readonly EntryPopup[]
}

/**
 * 134 진입 한 번의 팝업 — 진입 `0x19f30` 이 먼저 `0x65de4` 로 히든 팀 팝업을 걸고(대한민국 → 결승 상대), 같은 진입의 첫 틀
 * `0x1b92c`(장면+0x2c == 1)가 칭호 8 팝업을 건다. 팝업 관리자는 띄운 것 하나 + 대기 한 칸이라 `queuedPopupsOf` 로 거른다.
 */
export function entryStateOf(
  cup: NationalCup,
  isEntering: boolean,
  openedHiddenIds: readonly number[] | undefined,
  entryTitle: string | null | undefined,
): EntryState {
  if (!isEntering) return { openedTeams: [], popups: [] }
  const openedTeams = openedHiddenIds === undefined ? [] : newlyOpenedHiddenTeamsOf(cup, openedHiddenIds)
  const hiddenPopups: EntryPopup[] = openedTeams.map((team) => ({ kind: '히든팀', text: hiddenTeamOpenText(TEAMS[team]?.name ?? '') }))
  const titlePopups: EntryPopup[] =
    entryTitle === null || entryTitle === undefined
      ? []
      : // 칭호 팝업 0x1274c — 그리기 0x1afe8 · 키 0x1b1e4 (`TitleWindow`)
        [{ kind: '칭호', title: entryTitle }]
  return { openedTeams, popups: queuedPopupsOf([...hiddenPopups, ...titlePopups]) }
}
