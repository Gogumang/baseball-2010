import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { FULL_PLAY_SETTINGS } from '@/features/play-team-game/model/matchSettings'
import type { MatchProgressSettings } from '@/features/play-team-game/model/matchSettings'
import { rollTeamSetup } from '@/features/play-team-game/model/teamGameFlow'
import { resetLiveGameState } from '@/shared/lib/liveGameState/liveGameState'
import type { TeamGameOptions, TeamSetupRolls } from '@/features/play-team-game/model/teamGameFlow'
import type { PlayerSide } from '@/entities/game/model/gameState'
import { swapWithStarter } from '@/entities/pitcher-career/model/pitcherRotation'
import {
  chooseAce, chooseAiTeam, chooseFirstBat, chooseStadium, chooseUserTeam, createFlowState,
  moveFirstBat, moveStadium, stepBack, withSetup,
} from '@/pages/general-mode/lib/generalModeFlow'
import { GENERAL_MODE_STEP } from '@/pages/general-mode/lib/generalModeSetup'
import type { GeneralModeSetup } from '@/pages/general-mode/lib/generalModeSetup'
import type { CpuMatchInfo } from '@/pages/general-mode/lib/matchInfoLines'
import type { GeneralModeFlowState } from '@/pages/general-mode/lib/generalModeFlow'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import {
  QUICK_RESPIN_TICKS, finishQuickRespin, rollQuickRespinTeams, rollQuickStart,
} from '@/pages/general-mode/lib/quickStart'
import type { QuickStartOpenState } from '@/pages/general-mode/lib/quickStart'
import { teamGameOptionsOf } from '@/pages/general-mode/lib/generalModeSetup'
import {
  leavesEntryEditor, openEntryEditor, pointEntryCursor, pressEntryKey,
} from '@/entities/season-mode/model/entryEditor'
import type { EntryEditorState, EntryKey } from '@/entities/season-mode/model/entryEditor'
import {
  seasonEntryListsOf, seasonEntryOrderOf, seasonRosterOfEntry, seasonStarterNameOf, tableRosterOf,
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
  /** 경기정보 "선발" 줄의 유저 팀 값 — 0x30f20 의 0↔k 뒤(엔트리 편집이 고쳤으면 그것)의 투수 0번 (0x5e0e8) */
  readonly userStarterName: string | null
  /** 경기정보 CPU 칸 — 0x30f20 이 세운 AI 팀의 선발·마선수. 상태 22 밖이면 null */
  readonly cpuMatchInfo: CpuMatchInfo | null
  readonly settings: MatchProgressSettings
  /** 경기 장면(0x104)으로 넘어갔는가 */
  readonly isPlaying: boolean
  /** 경기진행 설정 창이 떠 있는가 (skin+0x2ba) */
  readonly isSettingsOpen: boolean
  /** `*` 재굴림이 도는 중인가 (skin+0xf4) — 그동안 경기정보 키를 안 받고(0x312b6) 바닥이 0x44 다 */
  readonly isRespinning: boolean
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

  /**
   * 상태 22 진입 `0x314b0` — 빠른실행이면 기록을 통째로 굴리고(31500~31546), 모드 1 이면 이어서 **`0x30f20` 으로
   * 경기를 세운다**(3158c): 상대 마선수 둘 → AI 선발 → 사람 선발 굴림 넷 (`rollTeamSetup`). 원본은 경기 장면이
   * 아니라 여기서 굴리므로 경기정보·엔트리 편집(상태 23)이 이미 굴린 팀을 보고, OK 키(0x311a8)는 굴리지 않는다.
   */
  const [initial] = useState(() => {
    const created = createFlowState({
      isQuickStart,
      ...(isQuickStart
        ? { setup: rollQuickStart(random, { openedHiddenTeamIds, openedAcePitcherIds, openedAceBatterIds }) }
        : {}),
    })
    return {
      flow: created,
      rolls: created.step === GENERAL_MODE_STEP.경기정보 ? rollsOf(created.setup, random) : null,
    }
  })
  const [flow, setFlow] = useState<GeneralModeFlowState>(initial.flow)
  /** 0x30f20 이 굴린 넷 — 상태 22 에 들어올 때마다(23 에서 돌아온 것 말고) 새로 굴린다 */
  const [rolls, setRolls] = useState<TeamSetupRolls | null>(initial.rolls)
  const [settings, setSettings] = useState<MatchProgressSettings>(initialSettings ?? FULL_PLAY_SETTINGS)
  const [isSettingsOpen, setSettingsOpen] = useState(false)
  const [isPlaying, setPlaying] = useState(false)
  const [entryEdit, setEntryEdit] = useState<GeneralModeEntryEdit | null>(null)
  /**
   * 유저 팀 레코드(저장 칸 `0x1f875(저장, 쪽)`)를 엔트리 편집이 고친 것. 원본은 상태 22 들어옴 `0x314b0` 이
   * 이전 상태가 23 이 아닐 때마다 `0x30f20` 으로 경기를 새로 세우므로(314c8 `cmp [메뉴+0x28], #0x17`)
   * 21 로 물러났다 오거나 재굴림하면 고친 것이 사라진다 — 웹도 그때 비운다.
   * 나갈 때 `0x2a370` 이 두 팀을 저장 칸 0x32·0x33(이어하기 칸과 같은 자리, R10)에 적는다 — 웹은 경기정보 OK 가 넘기는
   * 첫 진행(`GeneralModeScreen.onGameStart`)에 고친 명단이 이미 들어 있어 따로 적지 않는다.
   */
  const [userEntryRoster, setUserEntryRoster] = useState<SeasonTeamRoster | null>(null)

  /**
   * `*` 재굴림 (0x311a8). 키 '*'(0x31424)는 [skin+0xf4] = 1 · [메뉴+0x154] = 0 만 하고, 굴림은 그 뒤 **매 틱**
   * 갱신 앞머리(31200~)가 한다: 1~19틱은 팀 둘만(`rollQuickRespinTeams`), 20틱째에 선공·마선수까지 굴리고
   * [skin+0xf4] = 0 → `0x30f20`(31290). 도는 동안([메뉴+0x154] ≤ 0x13) 키는 전부 버린다(312b6).
   * `respinTick` = [메뉴+0x154] (도는 중이 아니면 null). `respinBuilt` = 0x30f20 이 마지막으로 세운 두 팀 —
   * 도는 동안 기록 +0 · +4 는 바뀌지만 선발 줄은 0x30f20 이 만든 팀 객체(0xb51fd)를 읽으므로 옛 팀이 남는다.
   */
  const [respinTick, setRespinTick] = useState<number | null>(null)
  // 열린 것 목록은 부르는 쪽이 그릴 때마다 새 배열일 수 있다 — 틱 타이머가 그 때문에 다시 걸리지 않게 ref 로 읽는다
  const openStateRef = useRef<QuickStartOpenState>({})
  openStateRef.current = { openedHiddenTeamIds, openedAcePitcherIds, openedAceBatterIds }
  const [respinBuilt, setRespinBuilt] = useState<{ readonly userTeamId: number; readonly aiTeamId: number } | null>(null)

  const respin = useCallback(() => {
    // 0x3140e: 빠른실행([메뉴+0x14c])이고 [skin+0xf4] == 0 일 때만
    if (!flow.isQuickStart || flow.step !== GENERAL_MODE_STEP.경기정보 || respinTick !== null) return
    setRespinBuilt({ userTeamId: flow.setup.userTeamId, aiTeamId: flow.setup.aiTeamId })
    setRespinTick(0)
  }, [flow, respinTick])

  useEffect(() => {
    if (respinTick === null) return undefined
    const timer = window.setTimeout(() => {
      const tick = respinTick + 1
      if (tick < QUICK_RESPIN_TICKS) {
        const teams = rollQuickRespinTeams(random, openStateRef.current)
        setFlow((current) => withSetup(current, { ...current.setup, ...teams }))
        setRespinTick(tick)
        return
      }
      // 20틱째 — 팀 둘 · 선공 · 마투수 · 마타자 → [skin+0xf4] = 0 → 0x30f20. 고친 엔트리도 여기서 사라진다
      const setup = finishQuickRespin(random, flow.setup, openStateRef.current)
      setUserEntryRoster(null)
      setRolls(rollsOf(setup, random))
      setFlow((current) => withSetup(current, setup))
      setRespinBuilt(null)
      setRespinTick(null)
    }, millisecondsPerFrame())
    return () => window.clearTimeout(timer)
  }, [respinTick, flow.setup, random])
  const isRespinning = respinTick !== null

  /** 상태 21 OK — 마타자를 고르면 22 로 들어가며 0x30f20 이 굴린다 */
  const selectAce = useCallback(
    (cell: number) => {
      const next = chooseAce(flow, cell)
      if (next.step === GENERAL_MODE_STEP.경기정보 && flow.step !== GENERAL_MODE_STEP.경기정보) {
        setUserEntryRoster(null)
        setRolls(rollsOf(next.setup, random))
      }
      setFlow(next)
    },
    [flow, random],
  )

  const back = useCallback(() => {
    const previous = stepBack(flow)
    if (previous === null) return false
    setUserEntryRoster(null)
    // 22 를 떠나면 0x30f20 이 세운 팀도 버린다 — 다시 들어오면 새로 굴린다
    setRolls(null)
    setFlow(previous)
    return true
  }, [flow])

  /**
   * 엔트리 편집기가 보는 팀 — 22 들어옴의 `0x30f20` 이 세운 그대로: 마선수(유저 팀은 고른 것 · AI 팀은 굴린 것,
   * 8·9번)를 넣고 선발 **0↔k 를 맞바꾼** 모양(3107a·31090 `0xb8c94`). 유저 팀은 고친 명단(없으면 표)에서 만든다.
   * 고친 명단은 **맞바꾸기 전** 모양으로 들고 있다 — 경기는 그 차례에서 k 번을 선발로 세우므로(`startTeamGame`)
   * 편집기의 투수 0번과 같은 투수다.
   */
  const builtTeams = respinBuilt ?? flow.setup
  const entrySourceOf = useCallback(
    (isUserTeam: boolean): SeasonEntryInput => {
      const teamId = isUserTeam ? builtTeams.userTeamId : builtTeams.aiTeamId
      const roster = (isUserTeam ? userEntryRoster : null) ?? tableRosterOf(teamId)
      const starterSlot = rolls === null
        ? 0
        : isUserTeam ? rolls.startingPitcherSlots.ours : rolls.startingPitcherSlots.opponent
      return {
        teamId,
        roster: { ...roster, pitchers: swapWithStarter(roster.pitchers, starterSlot) },
        // 일반모드는 리그 로테이션이 없다 (선발은 0x30f20 의 무작위 맞바꿈 — 위에서 이미 했다)
        dayCounter: 0,
        acePitcherId: isUserTeam ? flow.setup.acePitcherId : (rolls?.opponentAces.pitcher ?? -1),
        aceBatterId: isUserTeam ? flow.setup.aceBatterId : (rolls?.opponentAces.batter ?? -1),
      }
    },
    [builtTeams.userTeamId, builtTeams.aiTeamId, flow.setup.acePitcherId, flow.setup.aceBatterId, rolls, userEntryRoster],
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
        const swapped = seasonRosterOfEntry(source.roster, lists, 0)
        // 맞바꾼 모양으로 고친 것을 맞바꾸기 전 모양으로 되적는다 (맞바꿈은 제 자신이 되돌림이다)
        setUserEntryRoster({
          ...swapped,
          pitchers: swapWithStarter(swapped.pitchers, rolls?.startingPitcherSlots.ours ?? 0),
        })
        lists = seasonEntryListsOf({ ...source, roster: swapped })
      }
      // 0x2a370: 1 이거나, 2 이면서 CPU 팀, 3 이면서 유저 팀이면 → 밀기 → 상태 22 (22 들어옴은 23 에서 왔으면 아무것도 안 한다)
      if (leavesEntryEditor(outcome.state.result, entryEdit.isUserTeam)) return setEntryEdit(null)
      setEntryEdit({ ...entryEdit, editor: outcome.state, lists, isAceLocked: outcome.isAceLocked })
    },
    [entryEdit, entrySourceOf, rolls],
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

  const isMatchInfo = flow.step === GENERAL_MODE_STEP.경기정보
  const userStarterName = isMatchInfo && (rolls !== null || userEntryRoster !== null)
    ? seasonStarterNameOf(builtTeams.userTeamId, entrySourceOf(true).roster, 0)
    : null
  const cpuMatchInfo: CpuMatchInfo | null = isMatchInfo && rolls !== null
    ? {
        starterName: seasonStarterNameOf(builtTeams.aiTeamId, entrySourceOf(false).roster, 0) ?? '-',
        acePitcherId: rolls.opponentAces.pitcher,
        aceBatterId: rolls.opponentAces.batter,
      }
    : null

  const actions = useMemo(
    () => ({
      selectUserTeam: (teamId: number) => setFlow((current) => chooseUserTeam(current, teamId)),
      selectAiTeam: (teamId: number) => setFlow((current) => chooseAiTeam(current, teamId)),
      moveFirstBat: (side: PlayerSide) => setFlow((current) => moveFirstBat(current, side)),
      selectFirstBat: (side: PlayerSide) => setFlow((current) => chooseFirstBat(current, side)),
      moveStadium: (stadiumId: number) => setFlow((current) => moveStadium(current, stadiumId)),
      selectStadium: (stadiumId: number) => setFlow((current) => chooseStadium(current, stadiumId)),
      selectAce,
      respin,
      // 도는 동안([메뉴+0x154] ≤ 0x13)은 312b6 에서 끝나 키 처리까지 가지 않는다
      openSettings: () => {
        if (!isRespinning) setSettingsOpen(true)
      },
      closeSettings: () => setSettingsOpen(false),
      applySettings: (next: MatchProgressSettings) => {
        setSettings(next)
        setSettingsOpen(false)
      },
      start: () => {
        if (!isRespinning) setPlaying(true)
      },
      back: () => (isRespinning ? true : back()),
      openEntry: (isUserTeam: boolean) => {
        if (!isRespinning) openEntry(isUserTeam)
      },
      pressEntryKey: pressEntryKeyAction,
      pointEntryCursor: pointEntryCursorAction,
      closeEntryAceLocked,
    }),
    [respin, isRespinning, selectAce, back, openEntry, pressEntryKeyAction, pointEntryCursorAction, closeEntryAceLocked],
  )

  const gameOptions = useMemo(
    () => teamGameOptionsOf(flow.setup, {
      settings,
      ...(gaugeSettingOn === undefined ? {} : { gaugeSettingOn }),
      ...(runningModeManual === undefined ? {} : { runningModeManual }),
      ...(throwModeManual === undefined ? {} : { throwModeManual }),
      ...(aceLevels === undefined ? {} : { aceLevels }),
      ...(rolls === null ? {} : { teamSetupRolls: rolls }),
      // 고친 차례는 맞바꾸기 전 모양 — 선발 칸 k 는 teamSetupRolls 가 든다
      ...(userEntryRoster === null ? {} : { ourEntryOrder: seasonEntryOrderOf(userEntryRoster) }),
    }),
    [flow.setup, settings, gaugeSettingOn, runningModeManual, throwModeManual, aceLevels, rolls, userEntryRoster],
  )

  return {
    flow, entryEdit, userStarterName, cpuMatchInfo, settings, isPlaying, isSettingsOpen, isRespinning, gameOptions, actions,
  }
}

/**
 * `0x30f20` 의 굴림 넷 — 준비 기록의 마선수(`+0xe`·`+0xd`)가 상대 마선수 굴림의 입력이다.
 * 같은 함수가 0x310a8 에서 0xb6814(전역 상태)를 불러 +0x6b = 0 으로 둔다 (`liveGameState` — 상태 22 진입 3158c · 재굴림 끝 31290)
 */
function rollsOf(setup: GeneralModeSetup, random: RandomPort): TeamSetupRolls {
  resetLiveGameState()
  return rollTeamSetup(setup.acePitcherId, setup.aceBatterId, random)
}
