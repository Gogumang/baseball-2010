import { useCallback, useMemo, useState } from 'react'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { FULL_PLAY_SETTINGS } from '@/features/play-team-game/model/matchSettings'
import type { MatchProgressSettings } from '@/features/play-team-game/model/matchSettings'
import type { TeamGameOptions } from '@/features/play-team-game/model/teamGameFlow'
import type { PlayerSide } from '@/entities/game/model/gameState'
import {
  chooseAce, chooseAiTeam, chooseFirstBat, chooseStadium, chooseUserTeam, createFlowState,
  moveFirstBat, moveStadium, stepBack, withSetup,
} from '@/pages/general-mode/lib/generalModeFlow'
import type { GeneralModeFlowState } from '@/pages/general-mode/lib/generalModeFlow'
import { rollQuickStart } from '@/pages/general-mode/lib/quickStart'
import type { QuickStartOpenState } from '@/pages/general-mode/lib/quickStart'
import { teamGameOptionsOf } from '@/pages/general-mode/lib/generalModeSetup'
import {
  leavesEntryEditor, openEntryEditor, pointEntryCursor, pressEntryKey,
} from '@/entities/season-mode/model/entryEditor'
import type { EntryEditorState, EntryKey } from '@/entities/season-mode/model/entryEditor'
import {
  seasonEntryListsOf, seasonRosterOfEntry, seasonStarterNameOf, tableRosterOf,
} from '@/entities/season-mode/model/seasonEntry'
import type { SeasonEntryInput, SeasonEntryLists } from '@/entities/season-mode/model/seasonEntry'
import type { SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit'

export interface UseGeneralModeOptions extends QuickStartOpenState {
  readonly random: RandomPort
  /** 메인 메뉴에서 **빠른실행**을 잡고 들어왔는가 (메뉴+0x14c) */
  readonly isQuickStart?: boolean
  /**
   * 저장에서 읽어 온 경기진행 설정 (모드 칸 m = **0**, 일반모드).
   * 안 넘기면 `FULL_PLAY_SETTINGS`("모든 이닝을 직접 플레이") 다 — 원본 저장의 참 기본값은
   * 종류 0(찬스)·값 0 이지만 그러면 득점권 타석만 잡게 된다 (matchSettings 의 웹판 판단).
   */
  readonly initialSettings?: MatchProgressSettings
  /** 환경설정 "투구 게이지" (설정 +0x2d) — 원본 기본값은 꺼짐 */
  readonly gaugeSettingOn?: boolean
  /** 환경설정 "주루" 가 수동인가 (설정 +0xbd) */
  readonly runningModeManual?: boolean
  /** 환경설정 "송구" 가 수동인가 (설정 +0xf4) — 사람이 수비하는 타석에서만 먹는다 (0xae6c8) */
  readonly throwModeManual?: boolean
  /** 마선수 레벨 열 칸 (전역 `mgr[0x13a..0x143]`) — 경기 옵션 `aceLevels` 로 그대로 넘긴다 */
  readonly aceLevels?: Readonly<Record<number, number>>
}

/** 상태 23 엔트리 편집 한 판 (편집 객체 [메뉴+0x120]) */
export interface GeneralModeEntryEdit {
  /** 메뉴+0xec — 1 유저 팀(편집 가능) · 0 CPU 팀(보기 전용) */
  readonly isUserTeam: boolean
  readonly teamId: number
  readonly editor: EntryEditorState
  readonly lists: SeasonEntryLists
  /** 마선수를 고르려 해서 StrTEXT 0xd200c 팝업이 떠 있다 */
  readonly isAceLocked: boolean
}

export interface GeneralModeSession {
  readonly flow: GeneralModeFlowState
  /** 상태 23 엔트리 편집 — 그 화면이 아니면 null */
  readonly entryEdit: GeneralModeEntryEdit | null
  /** 경기정보 "선발" 줄의 유저 팀 값 — 엔트리 편집이 고친 투수 0번 (0x5e0e8) */
  readonly userStarterName: string | null
  readonly settings: MatchProgressSettings
  /** 경기 장면(0x104)으로 넘어갔는가 */
  readonly isPlaying: boolean
  /** 경기진행 설정 창이 떠 있는가 (skin+0x2ba) */
  readonly isSettingsOpen: boolean
  /** 지금 기록으로 만든 경기 옵션 */
  readonly gameOptions: TeamGameOptions
  readonly actions: {
    readonly selectUserTeam: (teamId: number) => void
    readonly selectAiTeam: (teamId: number) => void
    readonly moveFirstBat: (side: PlayerSide) => void
    readonly selectFirstBat: (side: PlayerSide) => void
    readonly moveStadium: (stadiumId: number) => void
    readonly selectStadium: (stadiumId: number) => void
    readonly selectAce: (cell: number) => void
    /** `*` — 빠른실행 결정사항을 다시 굴린다 */
    readonly respin: () => void
    readonly openSettings: () => void
    readonly closeSettings: () => void
    readonly applySettings: (next: MatchProgressSettings) => void
    readonly start: () => void
    /** CLR. 더 뒤가 없으면 `false` 를 돌려준다 — 부르는 쪽이 모드 목록으로 나가면 된다 */
    readonly back: () => boolean
    /** 경기정보 '4'/왼(유저 팀, 메뉴+0xec = 1) · '6'/오른(CPU 팀, 0) → 상태 23 (0x311a8) */
    readonly openEntry: (isUserTeam: boolean) => void
    /** 상태 23 의 키 — 편집기 0x55864, 끝 코드면 22 로 (0x2a370) */
    readonly pressEntryKey: (key: EntryKey) => void
    /** 상태 23 — 웹 전용, 줄을 눌러 커서를 옮긴다 */
    readonly pointEntryCursor: (index: number) => void
    readonly closeEntryAceLocked: () => void
  }
}

/**
 * **일반모드 한 판의 상태 고리** — 메인 메뉴 하위 상태 18~22 와 경기 장면 0x104 를 묶는다.
 *
 * 준비 기록·단계 규칙은 전부 `lib/generalModeFlow` 에 있고 여기서는 화면이 부르는 손잡이만 묶는다.
 */
export function useGeneralMode(options: UseGeneralModeOptions): GeneralModeSession {
  const {
    random, isQuickStart = false, initialSettings, gaugeSettingOn, runningModeManual, throwModeManual, aceLevels,
    openedHiddenTeamIds, openedAcePitcherIds, openedAceBatterIds,
  } = options

  const [flow, setFlow] = useState<GeneralModeFlowState>(() =>
    createFlowState({
      isQuickStart,
      // 빠른실행은 상태 22 진입 함수(0x314b0)가 기록을 통째로 굴리고 들어간다
      ...(isQuickStart
        ? { setup: rollQuickStart(random, { openedHiddenTeamIds, openedAcePitcherIds, openedAceBatterIds }) }
        : {}),
    }),
  )
  const [settings, setSettings] = useState<MatchProgressSettings>(initialSettings ?? FULL_PLAY_SETTINGS)
  const [isSettingsOpen, setSettingsOpen] = useState(false)
  const [isPlaying, setPlaying] = useState(false)
  const [entryEdit, setEntryEdit] = useState<GeneralModeEntryEdit | null>(null)
  /**
   * 유저 팀 레코드(저장 칸 `0x1f875(저장, 쪽)`)를 엔트리 편집이 고친 것. 원본은 상태 22 들어옴 `0x314b0` 이
   * 이전 상태가 23 이 아닐 때마다 `0x30f20` 으로 경기를 새로 세우므로(314c8 `cmp [메뉴+0x28], #0x17`)
   * 21 로 물러났다 오거나 재굴림하면 고친 것이 사라진다 — 웹도 그때 비운다.
   * 나갈 때 `0x2a370` 이 두 팀을 저장 칸 0x32·0x33(이어하기 칸과 같은 자리, R10)에 적지만 웹에는 이어하기가 없다.
   */
  const [userEntryRoster, setUserEntryRoster] = useState<SeasonTeamRoster | null>(null)

  const respin = useCallback(() => {
    setUserEntryRoster(null)
    setFlow((current) =>
      withSetup(
        current,
        rollQuickStart(random, { openedHiddenTeamIds, openedAcePitcherIds, openedAceBatterIds }),
      ),
    )
  }, [random, openedHiddenTeamIds, openedAcePitcherIds, openedAceBatterIds])

  const back = useCallback(() => {
    setUserEntryRoster(null)
    let canGoBack = true
    setFlow((current) => {
      const previous = stepBack(current)
      if (previous === null) {
        canGoBack = false
        return current
      }
      return previous
    })
    return canGoBack
  }, [])

  /**
   * 엔트리 편집기가 보는 팀 — 유저 팀은 고친 명단(없으면 표), CPU 팀은 표.
   * ⚠️ 원본은 22 들어옴에서 `0x30f20` 이 이미 마선수(8·9번)를 넣고 선발 0↔k 맞바꿈(난수)까지 한 팀을 보여 준다.
   *    웹은 그 넷을 경기 시작(`startTeamGame`)에서 굴리므로 여기서는 **유저 팀 마선수만 끼우고** 선발 맞바꿈과
   *    CPU 팀 마선수는 없다 (굴림 차례를 옮기려면 팀 경기 쪽을 고쳐야 한다).
   */
  const entrySourceOf = useCallback(
    (isUserTeam: boolean): SeasonEntryInput => {
      const teamId = isUserTeam ? flow.setup.userTeamId : flow.setup.aiTeamId
      return {
        teamId,
        roster: (isUserTeam ? userEntryRoster : null) ?? tableRosterOf(teamId),
        // 일반모드는 리그 로테이션이 없다 (선발은 0x30f20 의 무작위 맞바꿈)
        dayCounter: 0,
        acePitcherId: isUserTeam ? flow.setup.acePitcherId : -1,
        aceBatterId: isUserTeam ? flow.setup.aceBatterId : -1,
      }
    },
    [flow.setup, userEntryRoster],
  )

  const openEntry = useCallback(
    (isUserTeam: boolean) => {
      const source = entrySourceOf(isUserTeam)
      setEntryEdit({
        isUserTeam,
        teamId: source.teamId,
        // 0x2648c: 0x5561c(ed, &팀, 메뉴+0xec ≠ 0, 1, 1) — CPU 팀은 보기 전용, 첫 탭은 투수
        editor: openEntryEditor(isUserTeam),
        lists: seasonEntryListsOf(source),
        isAceLocked: false,
      })
    },
    [entrySourceOf],
  )

  const pressEntryKeyAction = useCallback(
    (key: EntryKey) => {
      if (entryEdit === null || entryEdit.isAceLocked) return
      const outcome = pressEntryKey(entryEdit.editor, entryEdit.lists, key)
      let lists = outcome.lists
      if (lists !== entryEdit.lists && entryEdit.isUserTeam) {
        const source = entrySourceOf(true)
        const roster = seasonRosterOfEntry(source.roster, lists, 0)
        setUserEntryRoster(roster)
        lists = seasonEntryListsOf({ ...source, roster })
      }
      // 0x2a370: 1 이거나, 2 이면서 CPU 팀, 3 이면서 유저 팀이면 → 밀기 → 상태 22 (22 들어옴은 23 에서 왔으면 아무것도 안 한다)
      if (leavesEntryEditor(outcome.state.result, entryEdit.isUserTeam)) return setEntryEdit(null)
      setEntryEdit({ ...entryEdit, editor: outcome.state, lists, isAceLocked: outcome.isAceLocked })
    },
    [entryEdit, entrySourceOf],
  )

  const pointEntryCursorAction = useCallback(
    (index: number) => {
      if (entryEdit === null || entryEdit.isAceLocked) return
      setEntryEdit({ ...entryEdit, editor: pointEntryCursor(entryEdit.editor, entryEdit.lists, index) })
    },
    [entryEdit],
  )

  const closeEntryAceLocked = useCallback(() => {
    setEntryEdit((current) => (current === null ? null : { ...current, isAceLocked: false }))
  }, [])

  const userStarterName = userEntryRoster === null
    ? null
    : seasonStarterNameOf(flow.setup.userTeamId, userEntryRoster, 0)

  const actions = useMemo(
    () => ({
      selectUserTeam: (teamId: number) => setFlow((current) => chooseUserTeam(current, teamId)),
      selectAiTeam: (teamId: number) => setFlow((current) => chooseAiTeam(current, teamId)),
      moveFirstBat: (side: PlayerSide) => setFlow((current) => moveFirstBat(current, side)),
      selectFirstBat: (side: PlayerSide) => setFlow((current) => chooseFirstBat(current, side)),
      moveStadium: (stadiumId: number) => setFlow((current) => moveStadium(current, stadiumId)),
      selectStadium: (stadiumId: number) => setFlow((current) => chooseStadium(current, stadiumId)),
      selectAce: (cell: number) => setFlow((current) => chooseAce(current, cell)),
      respin,
      openSettings: () => setSettingsOpen(true),
      closeSettings: () => setSettingsOpen(false),
      applySettings: (next: MatchProgressSettings) => {
        setSettings(next)
        setSettingsOpen(false)
      },
      start: () => setPlaying(true),
      back,
      openEntry,
      pressEntryKey: pressEntryKeyAction,
      pointEntryCursor: pointEntryCursorAction,
      closeEntryAceLocked,
    }),
    [respin, back, openEntry, pressEntryKeyAction, pointEntryCursorAction, closeEntryAceLocked],
  )

  const gameOptions = useMemo(
    () => teamGameOptionsOf(flow.setup, {
      settings,
      ...(gaugeSettingOn === undefined ? {} : { gaugeSettingOn }),
      ...(runningModeManual === undefined ? {} : { runningModeManual }),
      ...(throwModeManual === undefined ? {} : { throwModeManual }),
      ...(aceLevels === undefined ? {} : { aceLevels }),
    }),
    [flow.setup, settings, gaugeSettingOn, runningModeManual, throwModeManual, aceLevels],
  )

  return { flow, entryEdit, userStarterName, settings, isPlaying, isSettingsOpen, gameOptions, actions }
}
