import { useCallback, useState } from 'react'
import type { TeamSetupRolls } from '@/features/play-team-game/model/teamGameFlow'
import { swapWithStarter } from '@/entities/pitcher-career/model/pitcherRotation'
import {
  advanceEntrySlide,
  leavesEntryEditor,
  openEntryEditor,
  pointEntryCursor,
  pressEntryKey,
  tickEntryEditor,
} from '@/entities/season-mode/model/entryEditor'
import type { EntryKey } from '@/entities/season-mode/model/entryEditor'
import { seasonEntryListsOf, seasonRosterOfEntry, seasonStarterNameOf, tableRosterOf } from '@/entities/season-mode/model/seasonEntry'
import type { SeasonEntryInput } from '@/entities/season-mode/model/seasonEntry'
import type { SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit'
import type { CpuMatchInfo } from '@/pages/general-mode/lib/matchInfoLines'
import type { GeneralModeEntryEdit } from './generalModeTypes'

/** 0x30f20 이 세운 두 팀 · 고른 마선수 · 굴림 넷 · 고친 유저 명단 — 편집기가 보는 팀의 재료 */
export interface EntryBuild {
  readonly userTeamId: number
  readonly aiTeamId: number
  readonly acePitcherId: number
  readonly aceBatterId: number
  readonly rolls: TeamSetupRolls | null
  readonly userEntryRoster: SeasonTeamRoster | null
}

/**
 * 엔트리 편집기가 보는 팀 — 22 들어옴의 `0x30f20` 이 세운 그대로: 마선수(유저 팀은 고른 것 · AI 팀은 굴린 것,
 * 8·9번)를 넣고 선발 **0↔k 를 맞바꾼** 모양(3107a·31090 `0xb8c94`). 유저 팀은 고친 명단(없으면 표)에서 만든다.
 * 고친 명단은 **맞바꾸기 전** 모양으로 들고 있다 — 경기는 그 차례에서 k 번을 선발로 세우므로(`startTeamGame`)
 * 편집기의 투수 0번과 같은 투수다.
 */
function entrySourceOf(build: EntryBuild, isUserTeam: boolean): SeasonEntryInput {
  return isUserTeam ? userEntrySourceOf(build) : cpuEntrySourceOf(build)
}

/** 유저 팀 — 고친 명단(없으면 표) · 선발 칸 ours · 고른 마선수 */
function userEntrySourceOf(build: EntryBuild): SeasonEntryInput {
  const roster = build.userEntryRoster ?? tableRosterOf(build.userTeamId)
  const starterSlot = build.rolls === null ? 0 : build.rolls.startingPitcherSlots.ours
  // 일반모드는 리그 로테이션이 없다 (선발은 0x30f20 의 무작위 맞바꿈 — 여기서 했다)
  return {
    teamId: build.userTeamId,
    roster: { ...roster, pitchers: swapWithStarter(roster.pitchers, starterSlot) },
    dayCounter: 0,
    acePitcherId: build.acePitcherId,
    aceBatterId: build.aceBatterId,
  }
}

/** CPU 팀 — 표 명단 · 선발 칸 opponent · 굴린 마선수(굴림 전이면 −1) */
function cpuEntrySourceOf(build: EntryBuild): SeasonEntryInput {
  const { rolls } = build
  const roster = tableRosterOf(build.aiTeamId)
  const starterSlot = rolls === null ? 0 : rolls.startingPitcherSlots.opponent
  return {
    teamId: build.aiTeamId,
    roster: { ...roster, pitchers: swapWithStarter(roster.pitchers, starterSlot) },
    dayCounter: 0,
    acePitcherId: rolls?.opponentAces.pitcher ?? -1,
    aceBatterId: rolls?.opponentAces.batter ?? -1,
  }
}

/** 경기정보 "선발" 줄 — 유저 팀 투수 0번(0x5e0e8) · CPU 칸(선발 · 마선수). 상태 22 가 아니거나 0x30f20 전이면 null */
export function matchInfoStartersOf(
  isMatchInfo: boolean,
  builtTeams: { readonly userTeamId: number; readonly aiTeamId: number },
  rolls: TeamSetupRolls | null,
  userEntryRoster: SeasonTeamRoster | null,
  sourceOf: (isUserTeam: boolean) => SeasonEntryInput,
): readonly [string | null, CpuMatchInfo | null] {
  const userStarterName =
    isMatchInfo && (rolls !== null || userEntryRoster !== null) ? seasonStarterNameOf(builtTeams.userTeamId, sourceOf(true).roster, 0) : null
  if (!isMatchInfo || rolls === null) return [userStarterName, null]
  const cpuMatchInfo: CpuMatchInfo = {
    starterName: seasonStarterNameOf(builtTeams.aiTeamId, sourceOf(false).roster, 0) ?? '-',
    acePitcherId: rolls.opponentAces.pitcher,
    aceBatterId: rolls.opponentAces.batter,
  }
  return [userStarterName, cpuMatchInfo]
}

/** 상태 23 엔트리 편집 (편집 객체 [메뉴+0x120]) — 열기 0x2648c · 키 0x55864 · 나가기 0x2a370 */
export function useGeneralEntryEdit(
  build: EntryBuild,
  aceLevels: Readonly<Record<number, number>> | undefined,
  setUserEntryRoster: (roster: SeasonTeamRoster) => void,
  bumpBlockWrite: () => void,
) {
  const [entryEdit, setEntryEdit] = useState<GeneralModeEntryEdit | null>(null)
  const { userTeamId, aiTeamId, acePitcherId, aceBatterId, rolls, userEntryRoster } = build
  const sourceOf = useCallback(
    (isUserTeam: boolean) => entrySourceOf({ userTeamId, aiTeamId, acePitcherId, aceBatterId, rolls, userEntryRoster }, isUserTeam),
    [userTeamId, aiTeamId, acePitcherId, aceBatterId, rolls, userEntryRoster],
  )

  const openEntry = useCallback(
    (isUserTeam: boolean) => {
      const source = sourceOf(isUserTeam)
      setEntryEdit({
        isUserTeam,
        teamId: source.teamId,
        // 0x2648c: 0x5561c(ed, &팀, 메뉴+0xec ≠ 0, 1, 1) — CPU 팀은 보기 전용, 첫 탭은 투수
        editor: openEntryEditor(isUserTeam),
        // 마선수 두 줄 능력치 0xb6415(rec, k, 1) 의 레벨 배율 — 전역 mgr[0x13a..]
        lists: seasonEntryListsOf({ ...source, aceLevels }),
        isAceLocked: false,
      })
    },
    [aceLevels, sourceOf],
  )

  const pressEntryKeyAction = useCallback(
    (key: EntryKey) => {
      if (entryEdit === null || entryEdit.isAceLocked) return
      const outcome = pressEntryKey(entryEdit.editor, entryEdit.lists, key)
      let lists = outcome.lists
      if (lists !== entryEdit.lists && entryEdit.isUserTeam) {
        const source = sourceOf(true)
        const swapped = seasonRosterOfEntry(source.roster, lists, 0)
        // 맞바꾼 모양으로 고친 것을 맞바꾸기 전 모양으로 되적는다 (맞바꿈은 제 자신이 되돌림이다)
        setUserEntryRoster({
          ...swapped,
          pitchers: swapWithStarter(swapped.pitchers, rolls?.startingPitcherSlots.ours ?? 0),
        })
        lists = seasonEntryListsOf({ ...source, roster: swapped, aceLevels })
      }
      // 0x2a370: 1 이거나, 2 이면서 CPU 팀, 3 이면서 유저 팀이면 → 밀기 → 상태 22 (22 들어옴은 23 에서 왔으면 아무것도 안 한다)
      if (leavesEntryEditor(outcome.state.result, entryEdit.isUserTeam)) {
        // 2a3cc~2a45a — 나가는 세 갈래 모두 두 팀을 블록 칸 0x32 · 0x33 에 걸고 0x22755 로 파일을 쓴다
        bumpBlockWrite()
        return setEntryEdit(null)
      }
      setEntryEdit({ ...entryEdit, editor: outcome.state, lists, isAceLocked: outcome.isAceLocked })
    },
    [aceLevels, entryEdit, sourceOf, rolls, bumpBlockWrite, setUserEntryRoster],
  )

  const pointEntryCursorAction = useCallback(
    (index: number) => {
      if (entryEdit === null || entryEdit.isAceLocked) return
      setEntryEdit({ ...entryEdit, editor: pointEntryCursor(entryEdit.editor, entryEdit.lists, index) })
    },
    [entryEdit],
  )

  const frameEntryAction = useCallback(() => {
    setEntryEdit((current) => (current === null ? null : { ...current, editor: advanceEntrySlide(tickEntryEditor(current.editor)) }))
  }, [])

  const closeEntryAceLocked = useCallback(() => {
    setEntryEdit((current) => (current === null ? null : { ...current, isAceLocked: false }))
  }, [])

  return { entryEdit, sourceOf, openEntry, pressEntryKeyAction, pointEntryCursorAction, frameEntryAction, closeEntryAceLocked }
}
