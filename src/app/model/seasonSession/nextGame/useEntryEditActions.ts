import { useCallback } from 'react'
import { seasonEntryListsOf, seasonRosterOfEntry } from '@/entities/season-mode/model/seasonEntry'
import { openEntryEditor, type EntryKey, pressEntryKey, leavesEntryEditor, pointEntryCursor } from '@/entities/season-mode/model/entryEditor'
import { SEASON_SCENE_STATE, SEASON_PHASE } from '@/entities/season-mode/model/seasonStateMachine'
import { type SeasonScope, useSeasonValue } from '@/app/model/seasonSession/atoms/seasonScope'
import { saveAtom } from '@/app/model/seasonSession/atoms/saveAtoms'
import { sceneAtom } from '@/app/model/seasonSession/atoms/sceneAtoms'
import { entryEditAtom, nextGameFromMenuAtom, pendingGameAtom, preGameAcesAtom } from '@/app/model/seasonSession/atoms/nextGameAtoms'
import { useSeasonSaveWriters } from '@/app/model/seasonSession/state/useSeasonSaveWriters'
import {
  cpuEntrySourceOf,
  opponentStarterNameOf,
  userEntrySourceOf,
  userStarterNameOf,
  withEntryRoster,
} from '@/app/model/seasonSession/nextGame/entrySources'

/** 엔트리 편집(0xe0) · 경기정보 선발 이름 · 다음경기 취소 */
export function useEntryEditActions(scope: SeasonScope) {
  const { atoms, aceLevels } = scope
  const save = useSeasonValue(atoms, saveAtom)
  const pendingGame = useSeasonValue(atoms, pendingGameAtom)
  const preGameAces = useSeasonValue(atoms, preGameAcesAtom)
  const entryEdit = useSeasonValue(atoms, entryEditAtom)
  const nextGameFromMenu = useSeasonValue(atoms, nextGameFromMenuAtom)
  const { commit, stageSave } = useSeasonSaveWriters(scope)
  /**
   * 0xdd '4'/왼 · '6'/오른 (0x83cc) → this+0x120 = 1/0, 밀기 4/3 → 0xe0. 들어옴 0x63dc 가 그 팀 레코드로
   * 편집기를 세운다 — 편집 가능 = this+0x120 (CPU 팀은 보기 전용), 첫 탭은 투수.
   * CPU 팀 명단은 `cpuEntrySourceOf`.
   */
  const openEntryEdit = useCallback(
    (isUserTeam: boolean) => {
      if (save === null || pendingGame === null) return
      const source = isUserTeam ? userEntrySourceOf(save, pendingGame, preGameAces) : cpuEntrySourceOf(save, pendingGame.options)
      atoms.set(entryEditAtom, {
        isUserTeam,
        teamId: source.teamId,
        editor: openEntryEditor(isUserTeam),
        // 마선수 두 줄 능력치 0xb6415(rec, k, 1) 의 레벨 배율 — 전역 mgr[0x13a..]
        lists: seasonEntryListsOf({ ...source, aceLevels }),
        isAceLocked: false,
      })
      atoms.set(sceneAtom, SEASON_SCENE_STATE.엔트리편집)
    },
    [aceLevels, atoms, pendingGame, preGameAces, save],
  )
  /**
   * 0xe0 키 `0x7044` — 편집기 `0x55864` 를 돌리고 끝 코드 `[ed+0x338]` 을 본다:
   * 1 → 0xdd · 2 → CPU 팀일 때만 0xdd · 3 → 유저 팀일 때만 0xdd. 0xdd 로 돌아오면 들어옴 0x6548 이
   * 이전 상태 0xe0 을 보고 아무것도 안 한다(설정 창 자동 열기·명단 다시 세우기 없음) — 그래서 장면만 바꾼다.
   *
   * 유저 팀 명단이 바뀌면 시즌 저장 **객체(메모리)** 만 고친다(`stageSave`). 원본은 저장 객체의 팀 레코드를 바로 고치고 파일
   * 쓰기는 0xdd 의 경기 시작(0x84a0 → 0x22754)이 하므로 경기를 시작하지 않고 끄면 고친 것이 날아간다 — 웹도 같다(r278). 그 사이
   * 다른 시즌 파일 쓰기(`commit`)가 오면 원본처럼 함께 쓰인다.
   */
  const pressEntryKeyAction = useCallback(
    (key: EntryKey) => {
      if (entryEdit === null || entryEdit.isAceLocked) return
      const outcome = pressEntryKey(entryEdit.editor, entryEdit.lists, key)
      let lists = outcome.lists
      if (lists !== entryEdit.lists && entryEdit.isUserTeam && save !== null && pendingGame !== null) {
        const source = userEntrySourceOf(save, pendingGame, preGameAces)
        const roster = seasonRosterOfEntry(source.roster, lists, source.dayCounter)
        stageSave(withEntryRoster(save, pendingGame.kind, roster))
        // 명단 첨자를 새 명단에 맞춰 다시 세운다 (줄 순서는 같다)
        lists = seasonEntryListsOf({ ...source, roster, aceLevels })
      }
      if (leavesEntryEditor(outcome.state.result, entryEdit.isUserTeam)) {
        atoms.set(entryEditAtom, null)
        atoms.set(sceneAtom, SEASON_SCENE_STATE.경기정보)
        return
      }
      atoms.set(entryEditAtom, { ...entryEdit, editor: outcome.state, lists, isAceLocked: outcome.isAceLocked })
    },
    [aceLevels, atoms, entryEdit, pendingGame, preGameAces, save, stageSave],
  )
  const pointEntryCursorAction = useCallback(
    (index: number) => {
      if (entryEdit === null || entryEdit.isAceLocked) return
      atoms.set(entryEditAtom, { ...entryEdit, editor: pointEntryCursor(entryEdit.editor, entryEdit.lists, index) })
    },
    [atoms, entryEdit],
  )
  const closeEntryAceLocked = useCallback(() => {
    atoms.set(entryEditAtom, (current) => (current === null ? null : { ...current, isAceLocked: false }))
  }, [atoms])
  /** 0xdd "선발" 줄 — 내 팀 명단(엔트리 편집 결과)의 투수 0번 */
  const matchInfoStarterName = save !== null && pendingGame !== null ? userStarterNameOf(save, pendingGame, preGameAces) : null
  const matchInfoOpponentStarterName = save !== null && pendingGame !== null ? opponentStarterNameOf(save, pendingGame.options) : null
  /**
   * 취소 `0x48ea`: 이전 상태가 0xc9 일 때만 0xc9 로 돌아간다. 관리 메뉴 갱신이 phase 를 3 으로
   * 되쓰므로(0x4f8c) 같이 3(기본)으로 돌려 둔다 — 안 그러면 다시 띄울 때 0xd8 로 샌다.
   */
  const cancelNextGame = useCallback(() => {
    if (save === null || !nextGameFromMenu) return
    commit({
      ...save,
      state: { ...save.state, record: { ...save.state.record, phase: SEASON_PHASE.기본 } },
    })
    atoms.set(sceneAtom, SEASON_SCENE_STATE.관리메뉴)
  }, [atoms, commit, nextGameFromMenu, save])
  return {
    openEntryEdit,
    pressEntryKeyAction,
    pointEntryCursorAction,
    closeEntryAceLocked,
    matchInfoStarterName,
    matchInfoOpponentStarterName,
    cancelNextGame,
  }
}
