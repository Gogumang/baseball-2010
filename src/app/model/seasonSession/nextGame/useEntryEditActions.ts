import { useCallback } from 'react'
import {
  type SeasonEntryInput,
  tableRosterOf,
  seasonEntryListsOf,
  seasonRosterOfEntry,
  seasonStarterNameOf,
  playerFaceOf,
} from '@/entities/season-mode/model/seasonEntry'
import { teamRecordMoraleOf } from '@/entities/team/model/teamMorale'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import { openEntryEditor, type EntryKey, pressEntryKey, leavesEntryEditor, pointEntryCursor } from '@/entities/season-mode/model/entryEditor'
import { SEASON_SCENE_STATE, SEASON_PHASE } from '@/entities/season-mode/model/seasonStateMachine'
import { seasonEntryCellSourceOf } from '@/app/model/seasonSession/records/entryCells'
import { cpuRosterOf } from '@/app/model/seasonSession/roster/roster'
import type { SeasonSave } from '@/app/model/seasonSession/save/seasonSave'
import type { PendingSeasonGame } from '@/app/model/seasonSession/types/session'
import type { MatchInfoActionsContext } from '@/app/model/seasonSession/nextGame/useMatchInfoActions'

/** `useSeasonSession` 몸통 문장 94~101 을 그대로 옮겼다 (r346) — 부르는 차례 · 훅 차례는 `useSeasonSession` 그대로 */
export function useEntryEditActions(ctx: MatchInfoActionsContext) {
  const { preGameAces, save, pendingGame, setEntryEdit, aceLevels, setScene, entryEdit, stageSave, nextGameFromMenu, commit } = ctx
  /**
   * 0xe0 의 유저 팀 명단 — 정규·포스트시즌은 시즌 세이브 명단(+ 0xd7 에서 고른 마선수), 국가대항전은
   * 대한민국 명단(마선수 없음, 0x6548 66ae). 로테이션 날짜는 경기 옵션과 같은 값이다.
   */
  const userEntrySourceOf = useCallback(
    (current: SeasonSave, pending: PendingSeasonGame): SeasonEntryInput => {
      const dayCounter = pending.options.dayCounter ?? 0
      if (pending.kind === '국가대항전') {
        const teamId = pending.options.ourTeamId
        return {
          teamId,
          roster: current.cupRoster ?? tableRosterOf(teamId),
          dayCounter,
          acePitcherId: -1,
          aceBatterId: -1,
          cells: {
            ...seasonEntryCellSourceOf(current, teamId, true),
            // 대표팀 칸 +0x918 은 대회 초기화 b7c72 0x205c0 이 마스터 팀 10 으로 새로 채운 것이라 사기 +2 는 표값이다 —
            // 시즌 사기 칸(0x1f570(저장, SR[1]))은 대회 중 상대국 슬롯 +0x934 로 돌아가 이 칸을 안 쓴다(1f58a~1f5a4)
            teamMorale: teamRecordMoraleOf(teamId),
            // 투수 +0x2c 는 대회 초기화 b7c88 · 하루 끝 b81e0 의 0xb6190(팀 10) 이 전원 10000 으로 채운다 — 사람 경기가 깎은 값은
            // 그 경기 결과 장면의 하루 끝에서 다시 차므로 0xe0 에 들어올 때는 늘 10000 이다. 웹 `cupRoster` 는 경기 끝 값을 받지
            // 않고(옛 저장은 0 으로 들었다) 이 칸을 쓰지 않는다
            staminaOf: () => FULL_STAMINA,
          },
        }
      }
      const teamId = current.state.record.teamId
      return {
        teamId,
        roster: current.roster,
        dayCounter,
        acePitcherId: preGameAces.pitcher,
        aceBatterId: preGameAces.batter,
        cells: seasonEntryCellSourceOf(current, teamId, true),
      }
    },
    [preGameAces],
  )
  /**
   * 0xdd '4'/왼 · '6'/오른 (0x83cc) → this+0x120 = 1/0, 밀기 4/3 → 0xe0. 들어옴 0x63dc 가 그 팀 레코드로
   * 편집기를 세운다 — 편집 가능 = this+0x120 (CPU 팀은 보기 전용), 첫 탭은 투수.
   * CPU 팀 명단은 웹에서 붙박이 표에 0xdd 진입에서 굴린 마선수(`opponentAces`, 0x6548 66f8·670a)를 8·9번에 끼운다.
   */
  const openEntryEdit = useCallback(
    (isUserTeam: boolean) => {
      if (save === null || pendingGame === null) return
      const { options } = pendingGame
      const source: SeasonEntryInput = isUserTeam
        ? userEntrySourceOf(save, pendingGame)
        : {
            teamId: options.opponentTeamId,
            // CPU 팀 레코드 — 트레이드로 바뀌었으면 저장의 것
            roster: cpuRosterOf(save, options.opponentTeamId),
            dayCounter: options.opponentDayCounter ?? options.dayCounter ?? 0,
            acePitcherId: options.opponentAces?.pitcher ?? -1,
            aceBatterId: options.opponentAces?.batter ?? -1,
            cells: seasonEntryCellSourceOf(save, options.opponentTeamId, false),
          }
      setEntryEdit({
        isUserTeam,
        teamId: source.teamId,
        editor: openEntryEditor(isUserTeam),
        // 마선수 두 줄 능력치 0xb6415(rec, k, 1) 의 레벨 배율 — 전역 mgr[0x13a..]
        lists: seasonEntryListsOf({ ...source, aceLevels }),
        isAceLocked: false,
      })
      setScene(SEASON_SCENE_STATE.엔트리편집)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
    [aceLevels, pendingGame, save, userEntrySourceOf],
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
        const source = userEntrySourceOf(save, pendingGame)
        const roster = seasonRosterOfEntry(source.roster, lists, source.dayCounter)
        // 국가대항전은 대표팀 슬롯 +0x918 — 대회 내내 남는다
        stageSave(pendingGame.kind === '국가대항전' ? { ...save, cupRoster: roster } : { ...save, roster })
        // 명단 첨자를 새 명단에 맞춰 다시 세운다 (줄 순서는 같다)
        lists = seasonEntryListsOf({ ...source, roster, aceLevels })
      }
      if (leavesEntryEditor(outcome.state.result, entryEdit.isUserTeam)) {
        setEntryEdit(null)
        setScene(SEASON_SCENE_STATE.경기정보)
        return
      }
      setEntryEdit({ ...entryEdit, editor: outcome.state, lists, isAceLocked: outcome.isAceLocked })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
    [aceLevels, entryEdit, pendingGame, save, stageSave, userEntrySourceOf],
  )
  const pointEntryCursorAction = useCallback(
    (index: number) => {
      if (entryEdit === null || entryEdit.isAceLocked) return
      setEntryEdit({ ...entryEdit, editor: pointEntryCursor(entryEdit.editor, entryEdit.lists, index) })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
    [entryEdit],
  )
  const closeEntryAceLocked = useCallback(() => {
    setEntryEdit((current) => (current === null ? null : { ...current, isAceLocked: false }))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
  }, [])
  /** 0xdd "선발" 줄 — 내 팀 명단(엔트리 편집 결과)의 투수 0번 */
  const matchInfoStarterName =
    save !== null && pendingGame !== null
      ? (() => {
          const source = userEntrySourceOf(save, pendingGame)
          return seasonStarterNameOf(source.teamId, source.roster, source.dayCounter)
        })()
      : null
  /**
   * 0xdd 상대 "선발" 줄 — 0x5e0e8 이 상대 팀 레코드 0번을 읽는다. 레코드 0번 = 투수 차례(`opponentPitcherOrder`)의 0번 칸에
   * 앉은 선수라, 트레이드로 바뀐 CPU 팀은 저장 명단(`cpuRosterOf`)의 그 칸 선수 이름이다. 차례가 없는 길(국가대항전)은 null
   */
  const matchInfoOpponentStarterName =
    save !== null && pendingGame !== null && pendingGame.options.opponentPitcherOrder !== undefined
      ? (() => {
          const opponent = pendingGame.options.opponentTeamId
          const index = pendingGame.options.opponentPitcherOrder?.[0] ?? 0
          const player = cpuRosterOf(save, opponent).pitchers[index]
          return player === undefined ? null : playerFaceOf(opponent, player, true, index).name
        })()
      : null
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
    setScene(SEASON_SCENE_STATE.관리메뉴)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
  }, [commit, nextGameFromMenu, save])
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

/** `useEntryEditActions` 까지 선 값 */
export type EntryEditActionsContext = MatchInfoActionsContext & ReturnType<typeof useEntryEditActions>
