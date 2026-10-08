import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { SeasonRecord, SeasonState } from '@/entities/season-mode/model/seasonRecord'
import {
  SEASON_GAME_COUNT, isFinalYear, normalizeSeasonState, startNewSeason,
} from '@/entities/season-mode/model/seasonRecord'
import type { SeasonSceneState } from '@/entities/season-mode/model/seasonStateMachine'
import {
  SEASON_PHASE,
  SEASON_SCENE_STATE,
  afterGameNext,
  enterSeasonScene,
  seasonOpponentOf,
} from '@/entities/season-mode/model/seasonStateMachine'
import {
  applySeasonGameEvaluation,
  evaluateSeasonGame,
  seasonGameIsEvaluated,
  seasonHumanWonOf,
} from '@/entities/season-mode/model/seasonEvaluation'
import { clearSeasonGameRecord } from '@/entities/season-mode/model/seasonReputation'
import { applyGameIncome } from '@/entities/season-mode/model/seasonAttendance'
import type { SeasonPlayer, SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit'
import { TRADE_TAB, swapTradedPlayers } from '@/entities/season-mode/model/playerTrade'
import type { TradeSettlement, TradeSwap } from '@/entities/season-mode/model/playerTrade'
import { NO_TRADE_REQUEST, rollTradeRequest } from '@/entities/season-mode/model/tradeRequest'
import type { TradeRequest } from '@/entities/season-mode/model/tradeRequest'
import {
  EMPTY_LEAGUE, LEAGUE_SIDE_HOME, UNSHUFFLED_PITCHER_ORDER, leagueSideOf, nextSeasonLeague, pitcherOrderOf,
  pitcherOrdersAfterPostseason, rankingOf, rotateLeaguePitchers, startPostseason,
} from '@/entities/league/model/league'
import type { League } from '@/entities/league/model/league'
import { recordLeagueResult } from '@/entities/league/model/league'
import { playLeagueDay } from '@/entities/league/model/leagueDay'
import type { LeagueAbilityContext, LeagueTeamRecord } from '@/entities/league/model/leagueDay'
import { finishRegularSeason } from '@/entities/league/model/seasonEnd'
import { runCpuPostseasonWithStamina } from '@/entities/league/model/postseasonPlay'
import {
  advancePostseason, postseasonGameOf, postseasonPitcherOrderOf, postseasonSideOf, postseasonStarterSlotOf,
} from '@/entities/league/model/league'
import {
  SEASON_MODE, advanceRotation, cpuGameRotationAdvances, rotationSlotOf,
} from '@/entities/pitcher-career/model/pitcherRotation'
import { recordHumanGamePitchers } from '@/entities/pitcher-career/model/leaguePitcherRecords'
import { isMyTurn } from '@/entities/league/model/seasonEnd'
import type { PostseasonSeries } from '@/entities/league/model/league'
import {
  EMPTY_LEAGUE_BATTER_LINE, EMPTY_LEAGUE_PLAYER_STATS, leaguePitcherAppearancesOf, recordLeaguePitcherAppearances,
  recordLeaguePlateAppearances, recordLeagueStolenBases,
} from '@/entities/league/model/leaguePlayerStats'
import type { GameLeaguePitchers } from '@/entities/game/model/gamePitcherLines'
import type { PitcherOfRecord } from '@/entities/game/model/winLossSave'
import type { LeaguePlayerStats } from '@/entities/league/model/leaguePlayerStats'
import { startNextYear } from '@/entities/season-mode/model/seasonRecord'
import { SEASON_END_CHAIN } from '@/entities/season-mode/model/seasonStateMachine'
import { PITCHERS_PER_TEAM, teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'
import { FULL_STAMINA, recoverStaminaAfterGameDay } from '@/entities/pitcher-career/model/pitcherStamina'
import type { TeamGameOptions, TeamGameProgress, TeamGameSummary } from '@/features/play-team-game/model/teamGameFlow'
import { rollOpponentAces } from '@/features/play-team-game/model/teamGameFlow'
import { CHANCE_VALUE, MATCH_SETTING_KIND } from '@/features/play-team-game/model/matchSettings'
import type { MatchProgressSettings } from '@/features/play-team-game/model/matchSettings'
import {
  PRE_GAME_ACES_START, SQUAD_PURPOSE, cancelPreGameAce, choosePreGameAce, matchInfoCancelScene,
} from '@/entities/season-mode/model/preGameFlow'
import type { PreGameAces, SquadPurpose } from '@/entities/season-mode/model/preGameFlow'
import {
  leavesEntryEditor, openEntryEditor, pointEntryCursor, pressEntryKey,
} from '@/entities/season-mode/model/entryEditor'
import type { EntryEditorState, EntryKey } from '@/entities/season-mode/model/entryEditor'
import {
  playerFaceOf, rotatedPitchersOf, seasonEntryListsOf, seasonEntryOrderOf, seasonRosterOfEntry, seasonStarterNameOf, tableRosterOf,
  unrotatedPitchersOf,
} from '@/entities/season-mode/model/seasonEntry'
import type { SeasonEntryInput, SeasonEntryLists, SeasonEntryRecordSource } from '@/entities/season-mode/model/seasonEntry'
import {
  HALL_OF_FAME_FIRST_ID, removeCareerPlayerFromRoster, removeHallOfFamerFromRoster, tableTeamOf,
} from '@/entities/season-mode/model/playerRecruit'
import { PLAYER_SIDE_FIRST_BAT, PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import type { NationalCup } from '@/entities/national-cup/model/nationalCup'
import { KOREA_TEAM_ID, createNationalCup, nationalCupSideOf } from '@/entities/national-cup/model/nationalCup'
import { advanceNationalCupDay } from '@/entities/national-cup/model/nationalCupPlay'
import { isSeasonNationalCupYear } from '@/entities/national-cup/model/nationalCupFlow'
import type { NationalCupFinish } from '@/entities/national-cup/model/nationalCupFlow'
import {
  SEASON_AUTOBOT_BAT_HIDDEN_ID, applySeasonBurstRewards, applySeasonReward, ENDING_BONUS_GAME_POINTS, GAME_POINT_LIMIT, judgeSeasonEnding,
  opensSeasonAutobotBat,
} from '@/entities/season-mode/model/seasonRewards'
import type { SeasonAutobotBatInput } from '@/entities/season-mode/model/seasonRewards'
import type { LeagueFirstAward, SeasonReward, SeasonSummaryEntry } from '@/entities/season-mode/model/seasonRewards'
import {
  SEASON_AWARD_INTRO_EVENT_ID, SEASON_MVP_LEADER_KINDS, seasonMvpResultEventId, seasonTitleResultEventId,
} from '@/widgets/season/lib/seasonAwardEvents'
import { judgeTitles, NO_TEAM } from '@/entities/awards/model/seasonAwards'
import { leaderOf } from '@/entities/awards/model/leaderboard'
import type { LeaderKind } from '@/entities/awards/model/leaderboard'
import {
  SYSTEM_MVP_WINDOW, SYSTEM_TITLE_WINDOW, mvpWindowTextOf, titleWindowTextOf,
} from '@/pages/story/lib/awardWindows'
import { activeSound } from '@/shared/api/audio/soundPort'
import { seasonEndingBgmOf } from '@/app/model/screenBgm'
import { HELL_TRAINING_GAME_POINT, HELL_TRAINING_INDEX } from '@/widgets/season/lib/seasonTraining'
import {
  applySeasonTraining, rollSeasonTraining, seasonTrainingResultOf,
} from '@/widgets/season/lib/seasonTrainingResult'
import type { SeasonTrainingResult } from '@/widgets/season/lib/seasonTrainingResult'
import { rollSeasonOuting } from '@/widgets/season/lib/seasonOuting'
import {
  NATIONAL_CUP_INTRO_EVENT_ID, OPENING_EVENT_ID, SEASON_FINAL_EVENT_ID, SEASON_GOAL_INTRO_EVENT_ID, START_SEASON_EVENT_CURSOR,
  YEAR_GOAL_EVENT_ID, applySeasonEventRewards, clearRepeatableSeen, cursorAfterCalling,
  illnessPenaltyFieldOf, markEventSeen, opensSeasonGoalWindow, pollSeasonEvents, seasonEventFollowUpOf,
  tickAfterAnyGame,
} from '@/entities/season-mode/model/seasonEventFlow'
import type { SeasonEventCursor, SeasonEventReward } from '@/entities/season-mode/model/seasonEventFlow'
import { rewardResumePatchOf } from '@/entities/story/model/storyScene'
import {
  achievedSeasonGoalCount, goalRankOf, seasonGoalResultEventId, seasonGoalWindowNumbersOf, seasonGoalWindowRankOf,
  teamBattingAverageOf, teamEarnedRunAverageOf,
} from '@/entities/season-mode/model/seasonGoals'
import type { GoalPostseasonBracket, SeasonGoalInput, SeasonGoalWindowNumbers } from '@/entities/season-mode/model/seasonGoals'
import {
  INITIAL_SEASON_MENU_CURSORS, TRADE_REQUEST_MENU_CURSOR, menuCursorsOnEnter, regularSeasonRankEventId,
} from '@/entities/season-mode/model/seasonStateMachine'
import type { SeasonMenuCursors } from '@/entities/season-mode/model/seasonStateMachine'
import {
  leagueBatterIdOf, leagueBatterLineOf, leaguePitcherIdOf, leaguePitcherLineOf, leagueRecordBatterLineOf,
  leagueRecordPitcherLineOf,
} from '@/entities/league/model/leaguePlayerStats'
import type { LeagueBatterLine, LeaguePitcherLine } from '@/entities/league/model/leaguePlayerStats'
import { EMPTY_LEAGUE_RECORD } from '@/entities/awards/model/leaderboard'
import type { LeagueRecord } from '@/entities/awards/model/leaderboard'
import { NO_ROSTER_SLOT, entryBattersOfOrder } from '@/features/play-team-game/model/teamGameRoster'
import { rollSceneLoadingTip } from '@/entities/game/model/sceneLoadingTip'
import {
  FULL_PITCHER_STAMINA, SEASON_SHOP_TEXT, SEASON_STAMINA_ITEM, applySeasonGpItem, applySeasonSubItem, seasonGpItemPriceOf,
  seasonShopTextOf,
} from '@/entities/season-mode/model/seasonItemShop'
import { isInfiniteGamePointOn } from '@/shared/lib/dev/devOptions'
import type { GamePointWalletSession } from '@/entities/wallet/model/useGamePointWallet'
import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'
import { seasonHallOfFameRecordSourceOf } from '@/app/model/seasonHallOfFameRecords'
import type { SeasonHallOfFame } from '@/app/model/seasonHallOfFameRecords'
import {
  normalizeCollectionRewardRecord, withAwardedBit, withStoredAwardedBits,
} from '@/entities/collection/model/collectionRewards'
import type { CollectionRewardRecord } from '@/entities/collection/model/collectionRewards'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { GAME_POINT_USAGE } from '@/entities/collection/model/annalsStats'
import type { AnnalsStatEvent } from '@/entities/collection/model/annalsStats'
import { resetLiveGameState, setLiveGameInningIndex } from '@/shared/lib/liveGameState/liveGameState'

/** 시즌모드 = 원본 모드 2 (0x22c7d 의 획득 GP 칸 3) */
const SEASON_STAT_MODE = 2
/** 엔딩 보너스 표 0xcbc2e 의 단위 — 0x8bd8 8c1a `movs #0xfa ; lsls #2` × 표값 */
const ENDING_BONUS_UNIT = 1000

/**
 * 시즌 모드 한 판 (원본 게임 모드 2, 장면 0x105).
 *
 * 화면(`pages/season`)은 상태를 하나도 안 들고 있고, 어느 화면 다음에 무엇이 오는지는
 * `entities/season-mode` 의 상태 기계가 전부 안다. 이 훅은 그 둘을 잇고 **저장**만 맡는다.
 *
 * ⚠️ **웹판 임시**: 원본 시즌모드는 사람이 팀을 조작해 경기를 치른다. 웹에는 아직 팀 경기
 *    화면이 없어 `playNextGame` 이 리그 시뮬레이터(0xc11f0 과 같은 간이 엔진)로 **자동 진행**한다.
 *    승패·수입·평가는 원본 식을 그대로 쓰지만 **경기 자체를 사람이 못 친다** — 화면이 생기면
 *    이 함수만 갈아 끼우면 된다.
 */

export interface SeasonSession {
  readonly state: SeasonState | null
  readonly scene: SeasonSceneState
  readonly league: League
  readonly roster: SeasonTeamRoster
  /** CPU 팀 레코드의 명단 — 트레이드로 바뀐 팀은 시즌 저장의 것, 나머지는 붙박이 표 (`SeasonSave.cpuRosters`) */
  readonly cpuRosterOf: (teamId: number) => SeasonTeamRoster
  /**
   * 트레이드 화면이 보는 **레코드 차례** 명단 — 투수가 로테이션(0xb5ca8)으로 섞인 차례다(`tradeRecordRosterOf`).
   * 화면이 낸 칸(`TradeSwap`)은 이 차례라 `finishTrade` 가 명단 첨자로 되돌린다
   */
  readonly tradeRoster: SeasonTeamRoster
  /** 영입한 명전 선수의 기록을 찾아 준다(기록연감 명전 칸) — 순위표 이름·경기 명단이 같은 것을 본다. 없으면 undefined */
  readonly recordSource: () => SeasonEntryRecordSource | undefined
  readonly tradeRosterOf: (teamId: number) => SeasonTeamRoster
  /** 리그 선수별 성적 — 타이틀·MVP 판정의 유일한 재료다 (B-2) */
  readonly playerStats: LeaguePlayerStats
  /** 포스트시즌 시리즈 (준PO → PO → 한국시리즈). 정규시즌 중에는 null */
  readonly series: PostseasonSeries | null
  /** 정규시즌 순위 (1위부터 팀 번호). 시즌이 끝나야 채워진다 */
  readonly ranking: readonly number[]
  /** 지금 치를 팀 경기의 옵션. 경기 화면이 아니면 null */
  readonly gameOptions: TeamGameOptions | null
  /** 그 경기가 정규·포스트시즌·국가대항전 중 무엇인가 */
  readonly gameKind: SeasonGameKind
  /**
   * 전역기록 **+0x4e — 시즌모드 경기가 중간 저장돼 있다** (`SeasonSave.isGameInProgress`). 명전 삭제 막기 [213](0x2ae0e) ·
   * 모드 초기화 나리 칸 막기 [212]/[213](0x2c880 · 0x2c900) · 시즌모드 진입 0x327b8 모드 2 갈래(곧장 경기)가 본다.
   */
  readonly isGameInProgress: boolean
  /**
   * **이어 세울 경기 진행** — 이어하기(`resumeSavedGame`)로 들어온 경기면 그 저장 블록, 새 경기면 null.
   * 경기 화면이 `resumeFrom` 으로 받는다 (원본 0x213c0(앱, 2, 0) → 장면 0x104 의 0x3f584 모드 2 갈래).
   */
  readonly resumeGame: TeamGameProgress | null
  /** 전역 저장 +0x145 — 리그 1위 G 를 이미 받은 문턱 비트 (`game_o.sav` 칸 — 웹은 `rewardStore` 에 저장) */
  readonly leagueFirstAwardedBits: number
  /**
   * 전역 기록 +0x64 — G포인트. **모드마다 다른 칸은 없다**(시즌 GP아이템 0x7c8c·0x801a 도
   * 같은 칸이다) — 그래서 지갑(`entities/wallet`)을 넘겨받으면 그 값이 그대로 여기로 나온다.
   */
  readonly gamePoints: number
  /** 0xd8 다음경기에 관리 메뉴(0xc9)에서 들어왔는가 — 취소(0x48ea)와 바닥(0xb8b2: 5 / 1)이 본다 */
  readonly isNextGameFromMenu: boolean
  /**
   * 열린 구장 히든 아이템 id (관중석 13·14·15 · 전광판 16·17·18).
   * 원본 자리는 **전역 저장** `app[0xe0 + 종류×4 + (칸−4)]` 다 (S3 7절) — 시즌 레코드가 아니라
   * 앱 저장에 있어 시즌을 새로 시작해도 남는다. 웹에는 그 전역 저장 객체가 없어 세션 상태에 둔다.
   * ⚠️ 그래서 웹에서는 새로 고치면 사라진다 — G(+0x64)는 지갑으로, 리그 1위 G 비트(+0x145)는 `rewardStore` 로
   * 옮겨 이 한계를 벗어났다.
   */
  readonly openedStadiumIds: readonly number[]
  /**
   * 시즌모드가 연 **전역 해금표 `app+0xc0`** 칸 — 지금은 결산 0x6900 의 0x29 "오토봇 배트" 하나다. 앱이 기록연감
   * 해금 목록에 합친다. 자리는 위 칸과 같은 세션 상태다(근사).
   */
  readonly openedHiddenIds: readonly number[]
  /**
   * 지금 결산 0xef 진입(`0x6900`) — 결산이 아니거나 진입 효과가 아직 안 돌았으면 null. 결산 화면은 `serial` 이 바뀔 때
   * 한 번 진입 몫(0x29 해금 알림 창 또는 리그 1위 G 하나)을 띄운다 (`SeasonSummaryEntry`).
   */
  readonly summaryEntry: SeasonSummaryEntry | null
  /** 진행 중인 국가대항전. 없으면 null (원본 L+0xa8~ 칸) */
  readonly cup: NationalCup | null
  /** 선수단 화면 0xd7 의 용도 `this+0x11c` — 1 경기 전 마선수 고르기 · 2 코치채용 */
  readonly squadPurpose: SquadPurpose
  /** 0xd7 경기 전 마선수 고르기의 단계(메뉴+0xd0)와 고른 칸(rec+0xe · rec+0xd) */
  readonly preGameAces: PreGameAces
  /**
   * 0xd7 → 0xdd 를 지나 치를 경기 — 옵션은 이미 섰고 마선수·설정만 시작할 때 얹는다.
   * 경기정보 화면이 두 팀·날짜를 여기서 읽는다. 경기 전 흐름 밖이면 null.
   */
  readonly pendingGame: PendingSeasonGame | null
  /** 경기진행 설정 창(0x5fef4)이 열려 있는가 — 경기정보 0xdd 의 메뉴+0x2ba */
  readonly isMatchSettingsOpen: boolean
  /** 시즌 칸(m = 1)의 경기진행 설정 — 경기 옵션 `settings` 로 간다 */
  readonly matchSettings: MatchProgressSettings
  /** 엔트리 편집 0xe0 — 그 장면이 아니면 null */
  readonly entryEdit: SeasonEntryEdit | null
  /**
   * 경기정보 0xdd "선발" 줄의 내 팀 값 — 엔트리 편집이 고친 명단의 투수 0번(0x5e0e8). 경기 전 흐름 밖이면 null.
   * 팀 경기도 같은 명단 차례로 선다 (옵션 `ourEntryOrder`).
   */
  readonly matchInfoStarterName: string | null
  /** 0xdd 상대 "선발" 줄 — 상대 팀 레코드(트레이드로 바뀌었으면 저장의 것) 0번. 차례가 없으면 null */
  readonly matchInfoOpponentStarterName: string | null
  /** 이벤트 재생 0xd3 — 트는 이벤트와 끝나고 돌아갈 상태(`this+0x24`). 그 장면이 아니면 null */
  readonly eventPlayback: SeasonEventPlayback | null
  /**
   * CPU 트레이드 요청 — 장면 객체 this+0x148 (20바이트). 경기 뒤 마무리 0xf1 진입 0x953c 가 굴려 담는다.
   * 장면 객체 칸이라 **저장되지 않는다**(장면을 만들 때 0, 팀 고르기 0xe4 진입 0x4774 도 지운다).
   */
  readonly tradeRequest: TradeRequest
  /**
   * 팀 트레이닝 결과 팝업(0xc074 의 0x741a0) — 굴림 · 적용을 마친 값. 떠 있는 동안 상태는 0xde 그대로이고
   * (웹은 0xcf 화면 안에서 띄운다) 닫으면 0xc9. 없으면 null
   */
  readonly trainingResult: SeasonTrainingResult | null
  /** 외출 연출 0xe3 의 장소 [gfx+0x184] (0x4a94 가 넘긴 this+0xf8) — 그 장면이 아니면 null */
  readonly outingPlace: number | null
  /** 외출 결과 팝업 0x17 글 (0xc81c) — 떠 있는 동안 상태는 0xe3 그대로, 닫으면 0xc9. 없으면 null */
  readonly outingResultText: string | null
  /**
   * 시상 이벤트 370 · 371 · 376 의 system 3 · 4 발표 창 글(0x8b3bc · 0x8b23c — 시즌 갈래). 지금 트는 이벤트가 그 셋이 아니거나
   * 창 종류가 아니면 null
   */
  readonly awardWindowTextOf: (sub: number) => string | null
  /**
   * 관리 메뉴(0xc9) 진입에서 요청 알림 StrMODE[203] 이 떠 있는가 — 0xe9ac 의 0xec10: 이벤트 폴링이 아무것도 안
   * 틀었고 상태가 0xc9 이고 this+0x148 ≠ 0 이면 팝업 id 0x27(예·아니오). 답은 0xc9 그림 0x73b8 이 받는다.
   */
  readonly isTradeRequestAlertOpen: boolean
  /** 관리 메뉴(this+0x70)·구단관리(this+0x78) 커서 — 장면이 사는 동안 이어진다 (`menuCursorsOnEnter`) */
  readonly menuCursors: SeasonMenuCursors
  readonly notice: string
  readonly actions: SeasonActions
}

/**
 * 이벤트 재생 0xd3 한 판 (갱신 0x5110 · 키 0x90ec · 그리기 0xa09c).
 * `eventId` 는 s_event 번호, 또는 연초 목표 내장 이벤트(`YEAR_GOAL_EVENT_ID`).
 * `serial` 은 같은 이벤트를 잇달아 틀어도 화면을 새로 세우려는 웹 전용 번호다.
 */
export interface SeasonEventPlayback {
  readonly eventId: number
  readonly returnScene: SeasonSceneState
  readonly serial: number
}

/** `equipSeasonPlayer` 의 인자 */
export interface SeasonEquipPurchase {
  readonly isPitcher: boolean
  readonly recordIndex: number
  /** 새 소지금 (100만 원 단위) */
  readonly money: number
  /** 새 니블 네 칸 */
  readonly equipment: readonly number[]
}

export interface SeasonActions {
  /**
   * 새 시즌 — 0xc8 이름 입력에서 [2] 예(0x4a58) → 0xcc 0x5758. 이름은 0xa33e4 가 SR+0x17c 에 (≤ 8바이트, 끝 0).
   * 단장 줄(0xd5)·이벤트 글의 %s 가 이 이름이다.
   */
  readonly chooseTeam: (teamId: number, name: string) => void
  readonly goto: (scene: SeasonSceneState) => void
  readonly updateRecord: (record: SeasonRecord) => void
  readonly updateRoster: (roster: SeasonTeamRoster) => void
  /**
   * 명전 칸을 지웠다 — 시즌 저장이 있으면 내 팀 명단에서 그 명전 선수(기록 번호 `id`)를 빼고 저장한다 (`0x221dc`,
   * `removeHallOfFamerFromRoster`). 시즌 저장이 없으면 아무것도 안 한다.
   */
  readonly removeHallOfFamer: (id: number, isPitcher: boolean) => void
  /**
   * 나만의리그 초기화가 시즌 내 팀에서 그 편 나리 선수를 뺀다 — 0x224ec 칸 3 → `0x223a8(mgr, 1)`(투수) · 칸 4 → `(mgr, 0)`(타자)
   * (`removeCareerPlayerFromRoster`). 시즌 저장이 없으면 아무것도 안 한다.
   */
  readonly removeCareerPlayer: (isPitcher: boolean) => void
  /**
   * 시즌모드 초기화 — 모드 저장 지우기 `0x224ec(mgr, 2)`: game_s.sav 를 지우고 전역기록 +0x42(시즌 커리어 있음) ·
   * +0x4e(경기 중간 저장)를 0 으로. 다음 시즌모드 진입은 팀 고르기다. 경기진행 설정·창 본 표시(전역 칸)는 남는다.
   */
  readonly resetSeason: () => void
  /** 트레이드 한 번이 끝났다 (0xe7) — 커맨드 표시·명단·G 를 **한 번에** 적어 넣는다 */
  readonly finishTrade: (settlement: TradeSettlement) => void
  /**
   * 장비 창 0xdc(종류 3)의 구매 확정 — 0x7d90 결과 0x14: 소지금과 그 선수(팀 레코드 칸)의 장비 니블을 **한 번에** 커밋한다.
   * `recordIndex` 는 선수 고르기 0xdf 목록(레코드 차례 — 투수는 로테이션으로 섞인 차례)의 칸이다.
   */
  readonly equipSeasonPlayer: (purchase: SeasonEquipPurchase) => void
  /**
   * 서브아이템 상점 0xdc(종류 1) 구매 확정 — 0x7d90 결과 0xc: 소지금 − 값 × 10 · SR[0x58 + k] = 1 · 저장.
   * 돌려주는 글은 팝업 StrMODE[92] (가드는 화면이 `checkSeasonSubItem` 으로 먼저 본다)
   */
  readonly buySeasonSubItem: (slot: number) => string
  /**
   * GP 상점 0xdc(종류 2) 구매 확정 — 0x7d90 결과 0xd. 칸 3(십전대보탕)은 G 를 안 빼고 null(→ 상태 0xe8),
   * 그 밖은 G 차감 · 0x22c29(3, 값) · 효과 0xa310c · 0x22e35(2, 칸) · 저장 뒤 효과 글을 돌려준다
   */
  readonly buySeasonGpItem: (slot: number) => string | null
  /**
   * 상태 0xe8 키 0x7c00 — 투수(레코드 차례 칸)의 스태미나가 가득이면 StrMODE[211] 만, 아니면 G 차감 · 0x22c29(3, 값) ·
   * 0x22e35(2, 3) · 스태미나 10000 · 저장 뒤 StrMODE[178]. `recovered` 가 참이면 결과 0x1d(→ 0xdc)
   */
  readonly recoverSeasonPitcherStamina: (recordIndex: number) => { readonly notice: string; readonly recovered: boolean }
  readonly playNextGame: () => void
  /** 관리 메뉴의 "다음경기" — 다음경기 화면 0xd8 로 (들어옴 0x4cb8: phase = 4 · 저장) */
  readonly openNextGame: () => void
  /** 다음경기 화면의 확인 (0x48d0) — 포스트시즌이면 결산 0xef, 아니면 경기로 */
  readonly confirmNextGame: () => void
  /** 다음경기 화면의 취소 (0x48ea) — 관리 메뉴에서 왔을 때만 관리 메뉴로 돌아간다 */
  readonly cancelNextGame: () => void
  /** 0xd7 경기 전 마선수 고르기의 OK — 마투수 → 마타자 → 0xdd (0xa734) */
  readonly choosePreGameAce: (cell: number) => void
  /** 0xd7 의 CLR — 마타자 → 마투수, 마투수 → 포스트시즌 0xef · 그 밖 0xd8 (0xa900) */
  readonly cancelPreGameAce: () => void
  /** 0xdd 의 OK — 평판 16칸을 지우고 경기로 (0x847e → 0xe1) */
  readonly startPendingGame: () => void
  /** 0xdd 의 CLR — 국가대항전이면 대회 쪽, 아니면 0xd7 (0x844e) */
  readonly cancelMatchInfo: () => void
  /** 0xdd 의 '0' — 경기진행 설정 창 열고 닫기 (0x857a) */
  readonly toggleMatchSettings: () => void
  /** 설정 창 확인 "예" — 시즌 칸에 되쓰고 닫는다 (0x60376) */
  readonly applyMatchSettings: (settings: MatchProgressSettings) => void
  /** 0xdd 의 '4'/왼(유저 팀 · this+0x120 = 1) · '6'/오른(CPU 팀 · 0) → 0xe0 엔트리 편집 */
  readonly openEntryEdit: (isUserTeam: boolean) => void
  /** 0xe0 의 키 — 편집기 0x55864 를 돌리고 끝 코드면 0xdd 로 (0x7044) */
  readonly pressEntryKey: (key: EntryKey) => void
  /** 0xe0 — 웹 전용, 줄을 눌러 커서를 옮긴다 */
  readonly pointEntryCursor: (index: number) => void
  /** 0xe0 — 마선수 잠금 팝업을 닫는다 */
  readonly closeEntryAceLocked: () => void
  readonly confirmIncome: (record: SeasonRecord) => void
  /** 경기 뒤 마무리(0xf1) 결과판의 확인 — 키 0x49a4 (포스트시즌 0xef · 짝수 경기 0xc9 · 홀수 0xd8) */
  readonly confirmDayResults: () => void
  /**
   * 관리 메뉴의 요청 알림 [203] 에 답했다 — 0x73b8 의 팝업 0x27 갈래(7422~749e):
   * 예(0) → 상태 0xe5(트레이드 영입 선수)로 · 관리·구단관리 메뉴 커서를 칸 1 로 / 아니오(1)·취소(0x14) → this+0x148 = 0
   */
  readonly answerTradeRequest: (accept: boolean) => void
  /** 요청 트레이드 0xe5 의 [216] 에 "예" — 0x712a: this+0x148 = 0 · 구단관리 0xce */
  readonly cancelTradeRequest: () => void
  /** 관리 메뉴·구단관리 커서를 옮겼다 */
  readonly moveMenuCursor: (menu: keyof SeasonMenuCursors, index: number) => void
  /** 트레이드 결과 알림을 닫았다 — 0xc7ba: this+0x148 = 0 · 관리 메뉴 0xc9 (보통 트레이드도 같다) */
  readonly closeTradeResult: () => void
  /** 국가대항전 한 경기 — 사람이 대표팀을 조작한다 */
  readonly playCupGame: (myTeam: number, opponent: number) => void
  readonly finishCup: (finish: NationalCupFinish) => void
  /** 팀 트레이닝 한 번 — 굴리고 적용한 뒤 결과 팝업을 띄운다 (연출 0xde → 굴림 0xc074 → 적용 0xa2f24 → 팝업) */
  readonly runTraining: (slot: number) => void
  /** 훈련 결과 팝업 키 0xf2c8 의 확인 · 취소 — 팝업을 닫고(0x742a9) 관리 메뉴 0xc9 */
  readonly closeTrainingResult: () => void
  /** 외출 지도 확인 팝업 0x16 에 "예" — 0x4a94: 장소를 넘기고 연출 0xe3 으로 */
  readonly enterOuting: (place: number) => void
  /** 외출 결과 0xc81c — 연출이 끝난 틀에 굴리고 적용 · SR+4 = 1 · 저장하고 결과 팝업 0x17 을 띄운다 */
  readonly runOuting: (place: number) => void
  /** 결과 팝업 0x17 을 닫았다 — 0xce0c: SR+4 = 1 · 0xc9 */
  readonly closeOutingResult: () => void
  /**
   * 경기 결과 화면 확인 — 정산 진입(`enterGameSettlement`)이 정해 둔 장면으로 간다(정규는 관중수입 0xe9). 정산 진입을
   * 거치지 않았으면 여기서 정산한다
   */
  readonly finishGame: (summary: TeamGameSummary) => void
  /**
   * 시즌모드로 들어와 장면 0x105 를 새로 세웠다(메인 메뉴 시즌모드 · [최근게임] 의 3284e — 중간 저장 경기가 없을 때). 상태 1 의
   * 적재 0x75fc 가 로딩 판에 팁 rand(0, 73) 을 굴린다(76cc `0x53dbd`) — `SeasonRoute` 가 들어올 때 한 번 부른다
   */
  readonly constructScene: () => void
  /**
   * 경기 화면이 이어하기 저장을 썼다 — 0xdd OK(0x847e: +0x4e = 1 · 칸 0xc 두 팀 · 0xd st · 파일) · 반 이닝 0x4f928(모드 2:
   * 칸 0xb SR · 0xc · 0xd) · 경기 장면 진입 0x3a426(+0x4e = 1 · 파일). +0x4e 를 세우고 블록을 시즌 저장에 쓴다.
   */
  readonly saveGameProgress: (progress: TeamGameProgress) => void
  /**
   * 경기 끝 정산 진입 0x4ea0c — 정산을 다 하고 +0x4e = 0(0x4f3d6, 블록도 비운다) · 저장. 화면은 결과 화면 확인(`finishGame`)이
   * 넘긴다
   */
  readonly enterGameSettlement: (summary: TeamGameSummary) => void
  /**
   * **시즌모드에 들어온다** — 0x327b8(this, 2) 의 모드 2 갈래(3284e): `(+0x42 && +0x4e)` 면 0x213c0(앱, 2, 0) 으로 시즌 저장을
   * 올려 곧장 경기 장면 0x104 로, 아니면 장면 0x105(시즌 관리). 메인 메뉴 시즌모드(하위 14 → 0x24698)와 [최근게임] 모드 2 가
   * 같은 길이다. 경기로 갔으면 참.
   */
  readonly resumeSavedGame: () => boolean
  /**
   * 경기 중 메뉴 "나가기" — 경기 상태 0x22 0x40140 은 모드를 가리지 않고 메인 메뉴(장면 0x103, 하위 4)로 나가며
   * +0x4e 를 안 건드린다. 그래서 다음에 시즌모드로 들어오면 마지막 반 이닝 저장에서 다시 선다.
   */
  readonly leaveGame: () => void
  /** 결산 화면에서 포스트시즌을 한 걸음 진행시킨다 (0xef — 내 차례면 경기, 아니면 CPU 구간) */
  readonly continuePostseason: () => void
  /** 리그 1위 G 를 지급하고 받은 비트를 남긴다 (0x6900 · 0x87e8) */
  readonly awardLeagueFirst: (award: LeagueFirstAward) => void
  /** 경기 중 자동진행 값 등 G 를 쓴다 (모자라면 화면이 먼저 막는다) */
  readonly spendGamePoint: (cost: number) => void
  /** 구장 히든 아이템을 연다 (0x81d0 컬렉터 해금 — `app[0xe0 + …] = 1`) */
  readonly openStadiumItems: (unlockIds: readonly number[]) => void
  /**
   * 국가대항전 0xf3 갱신 0xe684 가 처음 연 히든 팀 — 0x65de5(전역, 0) 대한민국, 우승(SR+0x144 == 10)이면 결승 상대도.
   * 0x65de4 가 전역 `+0x7a+k = 1` · 전역 저장 0x1f1b9 · StrCOMMON[138] 팝업 0x22 (팝업은 `NationalCupScreen` 이 띄운다)
   */
  readonly openCupHiddenTeams: (teams: readonly number[]) => void
  /**
   * 엔딩 보너스 팝업 0x2b 를 닫았다 — 0x8bd8 의 8bf4~8c84: G += 0xcbc2e[e] × 1000(99999 상한) · 전역기록 저장 · SR+0x7b = 1 ·
   * 저장 · `0x22c7d(보너스, 2)` 통계. 이미 받았으면 아무것도 안 한다
   */
  readonly receiveEndingBonus: () => void
  /**
   * 엔딩을 넘겼다 — 키 0x6b3c 가 SR+0x7b 가 선 채로 단계 1 로 넘기고, 0x8bd8 의 8ccc~8d2c 가 그 화면 전환이 끝나면
   * SR+0x1bc = 1 · 저장 · 관리 메뉴 0xc9
   */
  readonly finishEnding: () => void
  /**
   * 결산을 닫았다(`0x87b4`) — 국가대항전 연차면 대회, 아니면 새 해 (afterKoreanSeries).
   * `reward` 는 [197]/[198] 팝업이 닫힐 때 0x85ec 가 더하는 한국시리즈 보상 — 더하기와 0x87b4 가 한 덩어리다
   */
  readonly finishSeason: (reward?: SeasonReward | null) => void
  /**
   * 이벤트 재생 0xd3 이 끝났다 — 지나온 보상(명령 7)과 본 이벤트를 받아 적용하고, 392 면 목표 결과 393~396 을
   * 이어 틀고, 아니면 돌아갈 상태로 간다.
   */
  readonly finishSeasonEvent: (
    rewards: readonly SeasonEventReward[],
    viewedEventIds: readonly number[],
    endingEventId?: number | null,
  ) => void
  /**
   * 이벤트의 보상 명령 7 하나를 그 자리에서 준다 — 0x8d4c4 가 글 · 창을 세운 그 갱신의 0x8c460(모드 2 갈래). 그 끝이 본 표시
   * (지금 이벤트 · 떠나온 이벤트 0x8b0e4) · 이벤트별 phase(8ccc8)를 하고 저장한다. `StoryScreen.onReward` 로 잇는다.
   */
  readonly giveSeasonEventReward: (rewards: readonly SeasonEventReward[], eventId: number, viewedEventIds?: readonly number[]) => void
  /**
   * 선택지 확인 — 0x8b804 의 8b8d8 `0x8b0e4(mgr)`: 떠나온 이벤트 줄 본 표시 → 저장(0x1fded · 0x22755). 0x8b12c 의 외출 갈래는
   * [[mgr+0xb4]+0x174] 가 나리 외출 상태(0x70 · 0x71)일 때라 시즌에서는 안 탄다. `StoryScreen.onChoiceConfirm` 으로 잇는다.
   */
  readonly confirmSeasonEventChoice: (eventId: number, leftEventIds: readonly number[]) => void
  /**
   * 이벤트의 system 창(알림 · 올해의 목표)을 답 0 으로 닫았다 — 0x8d928~0x8d942 의 0x7fe90: 시즌모드라 기록 +0x187 = 1 ·
   * 저장(0x22755). 하위와 상관없이 모든 system 창이다.
   */
  readonly confirmEventSystemWindow: () => void
  readonly clearNotice: () => void
  readonly quit: () => void
}

/** 저장 칸 하나에 시즌 상태·리그 전적·로스터를 함께 담는다 (원본 저장 0x22755 에 해당) */
interface SeasonSave {
  readonly state: SeasonState
  readonly league: League
  readonly roster: SeasonTeamRoster
  readonly playerStats?: LeaguePlayerStats
  readonly series?: PostseasonSeries | null
  readonly ranking?: readonly number[]
  /** 진행 중인 국가대항전 (L+0xa8~0xc3). 대회 밖이면 null */
  readonly cup?: NationalCup | null
  /**
   * 국가대항전 대한민국 명단 — 원본 저장의 대표팀 슬롯 `+0x918`. 대회 초기화 `b7c72 0x205c0` 이 마스터 팀 10 을
   * 깊은 복사해 채우고 **대회 내내 남는다**(하루 끝 0xb818c 는 스태미나만 다시 채우고 명단은 안 건드린다) —
   * 엔트리 편집(0xe0)이 고친 차례가 다음 대회 경기로 이어진다. 대회 밖이면 null(없으면 표에서 만든다).
   */
  readonly cupRoster?: SeasonTeamRoster | null
  /**
   * 경기진행 설정 시즌 칸 (전역 저장 +0x12c+m 계열, m = 1). 원본은 **전역 저장**이라 시즌을 새로 해도 남는다 —
   * 웹엔 그 전역 저장 객체가 없어 시즌 저장에 두되, 새 시즌(`chooseTeam`)이 앞 저장의 값을 그대로 넘겨받는다.
   * 모드 초기화 0x224ec(2) 는 이 칸을 안 지운다 — `resetSeason` 이 시즌 없는 덩어리에 남겨 둔다(`SeasonGlobalCarry`).
   * ⚠️ 시즌 저장 칸을 통째로 지우면(브라우저 저장 삭제) 함께 사라진다 — 그 점만 근사다.
   * 한 번도 고치지 않았으면 원본 저장의 0 초기값(`SEASON_DEFAULT_MATCH_SETTINGS` — 찬스 · 공격 득점권)이다.
   */
  readonly matchSettings?: MatchProgressSettings
  /**
   * 전역 저장 +0x11e — 경기진행 설정 창을 한 번 봤는가. 0 이면 0xdd 들어옴 0x6548 이 창을 저절로 열고 1 로 쓴다.
   * 위 칸과 같이 새 시즌이 넘겨받는다.
   */
  readonly matchSettingsSeen?: boolean
  /**
   * **다른 아홉 팀의 투수 스태미나** `+0x2c` — 팀 번호 → 붙박이 표 칸 차례(`teamPitchers(팀)`)의 값.
   * 내 팀 값은 `roster.pitchers[i].stamina` 다. 원본은 시즌 저장의 팀 레코드(0x1f570)마다 투수 레코드에 들어 있어
   * 시즌 내내 이어진다 (a583fe0 · `seasonStamina` 주석). 이 칸이 없는 옛 저장은 모두 10000 으로 채운다.
   */
  readonly cpuPitcherStaminas?: Readonly<Record<number, readonly number[]>>
  /**
   * **CPU 팀 레코드의 선수 배열** — 원본 시즌 저장의 팀 레코드(`0x1f570(저장, 팀)`)마다 든 투수·타자 0x30 바이트들.
   * 트레이드 성공(0xd1cc~0xd3ae)이 내 팀과 상대 팀 레코드의 한 칸씩을 맞바꾸므로 **바뀐 팀만** 여기 둔다 —
   * 없는 팀은 붙박이 표 명단(`tableRosterOf`)과 같다(옛 저장도 그렇다). 스태미나(+0x2c)는 `cpuPitcherStaminas` 가 주인이다.
   */
  readonly cpuRosters?: Readonly<Record<number, SeasonTeamRoster>>
  /**
   * **전역기록 +0x4e — 시즌모드 경기가 중간 저장돼 있다.** 원본은 전역기록(game_o.sav) 칸이지만 쓰고 지우는 곳이 모두
   * 시즌 저장(game_s.sav)의 생사와 함께다 — 웹은 블록과 같이 시즌 저장에 둔다:
   * - 1: 경기정보 0xdd OK 0x84a0 (곧이어 0x22754 로 파일) · 경기 장면 진입 0x39fdc 모드 2 갈래 0x3a426 (새 경기·이어하기 둘 다)
   * - 0: 경기 끝 정산 진입 0x4ea0c(0x4f3d6) · 새 시즌 팀 고르기 0x5804(+0x42 = 1 과 함께) · 모드 저장 지우기 0x224ec(mgr, 2)
   *   (시즌 파일을 지우며 같이)
   * 경기 중 "나가기"(0x40140)는 안 건드린다. 읽는 곳: 0x327b8 모드 2 갈래 · 명전 삭제 막기 0x2ae0e · 선물 막기 0x2ad4c(🌐) ·
   * 모드 초기화 나리 칸 0x2c880 · 0x2c900. (CORRECTIONS 의 "+0x4e 읽기 0x5804" 는 읽기가 아니라 이 0 쓰기다 — `adds r0,#0x4e ; strb r7(=0)`.)
   */
  readonly isGameInProgress?: boolean
  /**
   * **모드 2 저장 블록** — 0xdd OK 와 반 이닝 0x4f928 이 시즌 파일에 쓰는 칸 0xc(두 팀 0x290 바이트) · 0xd(st 0xa4 바이트).
   * 칸 0xb(SR = 장면+0xf08)도 쓰지만 이어 세울 때 0x3f584 모드 2 갈래는 0xc · 0xd 만 되복사한다(SR 는 시즌 파일 그 자체다).
   * 웹 진행(`TeamGameProgress`)에는 SR 쪽 경기 중 변화(돌발 보상 `burstRewardDeltas`)가 들어 있어 경기 끝 정산이 한꺼번에 얹는다.
   * ⚠️ 웹 전용 그림자: `kind`(정규·포스트시즌·국가대항전 — 원본은 SR+0x12c · 리그 +0xb4 로 안다) · `ownRotationShift`
   * (웹 명단 첨자 돌림 수 — `withOwnRecordRotation`). 진행 꼴이 바뀌어 못 읽으면 저장 없음으로 본다.
   */
  readonly gameSave?: SeasonGameSaveBlock | null
}

/**
 * **시즌이 없어도 남는 전역 칸** — 경기진행 설정(+0x12c+1 계열)과 창 본 표시(+0x11e). 원본은 전역기록이라 모드 초기화
 * 0x224ec(2)(시즌 파일 지움)가 안 건드린다. 웹은 시즌 저장에 두므로 시즌을 지울 때 이 두 칸만 남긴 덩어리를 쓴다
 * (`normalizeSeasonSave` 는 `state` 가 없으면 시즌 없음으로 본다).
 */
type SeasonGlobalCarry = Pick<SeasonSave, 'matchSettings' | 'matchSettingsSeen'>

/** 저장(또는 시즌 없는 덩어리)에서 전역 칸만 고른다 */
function seasonGlobalCarryOf(raw: unknown): SeasonGlobalCarry {
  if (raw === null || typeof raw !== 'object') return {}
  const value = raw as Partial<SeasonSave>
  return {
    ...(value.matchSettings === undefined || value.matchSettings === null || typeof value.matchSettings !== 'object'
      ? {}
      : { matchSettings: value.matchSettings }),
    ...(typeof value.matchSettingsSeen === 'boolean' ? { matchSettingsSeen: value.matchSettingsSeen } : {}),
  }
}

/** 시즌 저장의 경기 블록 (`SeasonSave.gameSave`) */
interface SeasonGameSaveBlock {
  /** 마지막으로 쓴 경기 진행 — 모르는 꼴로 담고 `seasonGameProgressOf` 가 가려 낸다 */
  readonly progress: unknown
  readonly kind: SeasonGameKind
  readonly ownRotationShift: number
}

/** 엔트리 편집 0xe0 한 판 — 편집 객체 `[this+0xa8]` 와 그 목록 */
export interface SeasonEntryEdit {
  /** this+0x120 — 1 유저 팀(편집 가능) · 0 CPU 팀(보기 전용) */
  readonly isUserTeam: boolean
  /** 이름을 빌려 온 팀 번호 */
  readonly teamId: number
  readonly editor: EntryEditorState
  readonly lists: SeasonEntryLists
  /** 마선수를 고르려 해서 StrTEXT 0xd200c 팝업이 떠 있다 */
  readonly isAceLocked: boolean
}

/** 0xd7 → 0xdd 를 지나 치를 경기 한 판 */
export interface PendingSeasonGame {
  readonly kind: SeasonGameKind
  /**
   * 두 팀·측·날짜가 선 옵션 — 내 마선수(rec+0xe·+0xd)와 설정은 0xdd 확인 때 얹는다.
   * 상대 마선수(`opponentAces`)는 0xdd 에 들어올 때 굴려 여기 싣는다 (정규·포스트시즌만).
   */
  readonly options: TeamGameOptions
}

/**
 * 시즌 로스터를 팀 명단 표에서 만든다 — 원본 선수 레코드 구조가 안 풀려 **근사**다.
 * 칸 번호(`+0xa & 0x1f`)만 순서대로 채우고 종류 비트는 0(기본 선수)으로 둔다.
 * 타자 수비 위치(`+0x1c & 0xf`)는 표의 값을 넣는다 — 엔트리 편집(0xb5e99·0xb5fe5)과 트레이드 자리 벌점이
 * 이 칸을 본다. 스태미나(+0x2c)는 10000 — 시즌 시작 0xb6cc4 · 첫날 6850 의 0xb6190 과 같다.
 */
function rosterOf(teamId: number): SeasonTeamRoster {
  return withFullRosterStamina(tableRosterOf(teamId))
}

/**
 * 엔트리 편집이 생기기 전 세이브는 타자 수비 위치를 모두 0 으로 적었다 — 그대로면 엔트리 편집의
 * 수비위치 탭이 아무것도 못 바꾸고(0xb5fe5 는 둘 다 ≠ 0 일 때만) 트레이드 벌점도 늘 10 이다.
 * **모든 타자가 0 일 때만** 리그 선수(id < 0xb4)의 표 값으로 채운다 (영입 선수는 그대로).
 */
function withTablePositions(roster: SeasonTeamRoster, teamId: number): SeasonTeamRoster {
  if (roster.batters.some((player) => (player.fieldPosition & 0xf) !== 0)) return roster
  return {
    ...roster,
    batters: roster.batters.map((player) => {
      const table = teamBatters(tableTeamOf(player, teamId))
      const position = player.id < HALL_OF_FAME_FIRST_ID ? table[player.id]?.position ?? 0 : 0
      return { ...player, fieldPosition: (player.fieldPosition & ~0xf) | position }
    }),
  }
}

const EMPTY_ROSTER: SeasonTeamRoster = { pitchers: [], batters: [] }

/**
 * 사람 경기(정규시즌) 투수 줄을 리그 기록표에 쌓는다 — `recordHumanGamePitchers` 와 같은 길에, 판정 받은 투수가 트레이드로
 * 옮겨 온 투수면 그 붙박이 표 팀(요약 `decisionTableTeams`)으로 센다. 원본 경기 끝 0xa7de8 은 판정 투수의 레코드 +0x2e·+0x2f
 * 를 올리고 그 레코드의 id(+0)가 옛 팀 Xls 행이라 기록이 선수를 따라간다. 표 팀이 없으면 그 함수 그대로다.
 */
function recordSeasonHumanGamePitchers(
  stats: LeaguePlayerStats,
  pitchers: GameLeaguePitchers | undefined,
): LeaguePlayerStats {
  const tableTeams = pitchers?.decisionTableTeams
  const recordIds = pitchers?.decisionRecordIds
  if (pitchers === undefined || (tableTeams === undefined && recordIds === undefined)) {
    return recordHumanGamePitchers(stats, pitchers, true)
  }
  const recordOf = (record: PitcherOfRecord | null, teamId: number | undefined, recordId: number | undefined) => {
    if (record === null) return null
    // 표 밖 투수(영입한 명전·나리)는 줄과 같이 칸 −1 · 원본 id 로 찾는다
    if (recordId !== undefined) return { side: record.side, pitcherSlot: -1, recordId }
    return { side: record.side, pitcherSlot: record.number, ...(teamId === undefined ? {} : { teamId }) }
  }
  const appearances = leaguePitcherAppearancesOf(
    pitchers.lines,
    {
      winner: recordOf(pitchers.decision.winner, tableTeams?.winner, recordIds?.winner),
      loser: recordOf(pitchers.decision.loser, tableTeams?.loser, recordIds?.loser),
      save: recordOf(pitchers.decision.save, tableTeams?.save, recordIds?.save),
    },
    (side) => pitchers.sideTeams[side] ?? pitchers.sideTeams[0],
    (_teamId, pitcherSlot, recordId) =>
      recordId === undefined && (pitcherSlot < 0 || pitcherSlot >= PITCHERS_PER_TEAM),
  )
  return recordLeaguePitcherAppearances(stats, appearances)
}

/** CPU 팀 레코드 — 트레이드로 바뀌었으면 저장의 것, 아니면 붙박이 표 명단 */
function cpuRosterOf(save: SeasonSave | null, teamId: number): SeasonTeamRoster {
  return save?.cpuRosters?.[teamId] ?? tableRosterOf(teamId)
}

/**
 * CPU 끼리 경기(0xc2a48 · 0xc2760 → 준비 0xc239c → 0xb891c·0xb8680)가 읽는 팀 레코드 — 트레이드로 바뀐 팀만 저장의 명단을
 * 칸마다 붙박이 표 자리(`tableTeamOf` 팀 · id)로 넘긴다. 바뀌지 않은 팀은 undefined(표 그대로 — 예전과 같은 길).
 * CPU 팀 레코드에는 리그 선수만 있다(나리·명전은 트레이드에서 거절된다) — 그 밖의 칸은 표 칸 그대로 둔다.
 */
function cpuLeagueRecordOf(save: SeasonSave, teamId: number): LeagueTeamRecord | undefined {
  const roster = save.cpuRosters?.[teamId]
  if (roster === undefined) return undefined
  const seatOf = (player: SeasonPlayer, index: number) =>
    player.id < HALL_OF_FAME_FIRST_ID
      ? { tableTeamId: tableTeamOf(player, teamId), tableSlot: player.id }
      : { tableTeamId: teamId, tableSlot: index }
  return { batters: roster.batters.map(seatOf), pitchers: roster.pitchers.map(seatOf) }
}

/**
 * **트레이드가 보는 레코드 차례** — 원본 트레이드(0xe5·0xe6 목록 · 요청 0x93c8 · 맞바꾸기 0xd1cc)는 `0x1f9a9(저장, 모드, 팀)` 의
 * 팀 레코드 배열을 칸 차례대로 본다. 투수 배열은 경기 준비마다 로테이션 `0xb5ca8`(0~3 한 칸 당김, 영구)로 섞여 있는데
 * 웹 명단(내 팀 `roster` · CPU `cpuRosters`)은 로테이션 전 자리 차례이고 섞인 차례는 리그가 든다(`League.pitcherOrders` —
 * 칸 p 에 앉은 명단 첨자). 트레이드는 관리 메뉴(정규시즌 경기 사이)에서만 열리고 그때 레코드는 지난 경기 준비까지 돈
 * 모양이라 리그 차례 그대로다(다음 경기 준비의 한 칸은 아직 안 돌았다). 그래서 목록·요청 칸은 이 차례로 보이고,
 * 맞바꿀 때 명단 첨자로 되돌린다(`recordPitcherIndexOf`). 차례가 명단 길이와 안 맞는 꼬리(영입으로 늘어난 칸)는 그대로다.
 */
function recordPitcherOrderOf(save: SeasonSave, teamId: number, pitcherCount: number): readonly number[] {
  const order = pitcherOrderOf(save.league, teamId)
  const valid = order.length <= pitcherCount
    && order.every((index) => Number.isInteger(index) && index >= 0 && index < order.length)
    && new Set(order).size === order.length
  const head = valid ? order : []
  return [...head, ...Array.from({ length: pitcherCount - head.length }, (_unused, k) => head.length + k)]
}

/** 레코드 차례로 늘어세운 팀 명단 — 타자는 그대로(로테이션은 투수만 섞는다) */
function tradeRecordRosterOf(save: SeasonSave, teamId: number, roster: SeasonTeamRoster): SeasonTeamRoster {
  const order = recordPitcherOrderOf(save, teamId, roster.pitchers.length)
  return { ...roster, pitchers: order.flatMap((index) => roster.pitchers[index] ?? []) }
}

/** 레코드 칸 p → 명단 첨자 */
function recordPitcherIndexOf(save: SeasonSave, teamId: number, roster: SeasonTeamRoster, recordIndex: number): number {
  return recordPitcherOrderOf(save, teamId, roster.pitchers.length)[recordIndex] ?? recordIndex
}

/** 트레이드 화면·요청이 낸 레코드 칸을 명단 첨자로 — 투수 탭만 (타자 배열은 섞이지 않는다) */
function rosterTradeSwapOf(save: SeasonSave, swap: TradeSwap): TradeSwap {
  if (swap.tab !== TRADE_TAB.투수) return swap
  const myTeamId = save.state.record.teamId
  return {
    ...swap,
    myIndex: recordPitcherIndexOf(save, myTeamId, save.roster, swap.myIndex),
    opponentIndex: recordPitcherIndexOf(save, swap.opponentTeamId, cpuRosterOf(save, swap.opponentTeamId), swap.opponentIndex),
  }
}

/**
 * 성공한 트레이드를 시즌 저장의 두 팀 레코드에 건다 — `swapTradedPlayers`(0xd1cc~0xd3ae).
 * 투수 스태미나(+0x2c)도 레코드째 옮겨 가므로, 상대 팀 칸은 `cpuPitcherStaminas`(표 칸 차례)에서 꺼내 실어 보내고
 * 받은 내 투수의 값을 그 칸에 되적는다.
 */
function withTradeSwap(save: SeasonSave, swap: TradeSwap): SeasonSave {
  const myTeamId = save.state.record.teamId
  const opponent = swap.opponentTeamId
  const staminas = save.cpuPitcherStaminas?.[opponent] ?? teamPitchers(opponent).map(() => FULL_STAMINA)
  const theirs = cpuRosterOf(save, opponent)
  const swapped = swapTradedPlayers(
    myTeamId,
    {
      mine: save.roster,
      theirs: {
        ...theirs,
        pitchers: theirs.pitchers.map((player, index) => ({ ...player, stamina: staminas[index] ?? FULL_STAMINA })),
      },
    },
    swap,
  )
  return {
    ...save,
    roster: swapped.mine,
    cpuRosters: { ...save.cpuRosters, [opponent]: swapped.theirs },
    cpuPitcherStaminas: {
      ...save.cpuPitcherStaminas,
      [opponent]: swapped.theirs.pitchers.map((player) => player.stamina),
    },
  }
}

/*
 * ## 시즌 투수 스태미나 `+0x2c` — 경기 사이에 이어지는 값 (직접 떴다)
 * ```
 * 0x6548 0xdd 진입 6850  SR+0xb2 == 0(시즌 첫날)이면 i = 0..9: 0xb6190(0x1f9a9(저장, 모드, i))  ; 열 팀 전원 10000
 * 0x4ea0c 경기 끝        정규: 내 경기 → 4f296 CPU 경기 0xc2a48 → 4f29a 하루 끝 0xb818c
 *                        포스트시즌(L+0x34)·국가대항전(L+0xac): 4f268/4f230 → 곧장 4f29a 0xb818c
 *                        → 모드 2 면 4f2bc: i = 0..9: 0xb617c(0x1f570(저장, i))  ; 열 팀 모두 +20% (0xb60e0)
 * 0xb818c 하루 끝        L+0xac(국가대항전) 갈래만 b81e0 0xb6190(팀 10) = 대한민국 10000.
 *                        L+0x34(포스트시즌)는 b8228 에서 곧장 끝 — **내 팀을 10000 으로 채우지 않는다**.
 * ```
 * - 그래서 정규시즌·포스트시즌 모두 하루 끝은 "열 팀 +20%" 하나다. a583fe0 의 "포스트시즌은 하루 끝 0xb818c 가 내 팀만
 *   10000" 은 P1 의 유력을 옮긴 것인데, 그 10000 은 대회 갈래(L+0xac) 안에 있다 — P5 가 이미 대한민국으로 고쳐 읽었다.
 * - 국가대항전 중에는 0x1f570 이 팀 10 을 +0x918, 나머지를 상대국 슬롯 +0x934 로 돌리므로 리그 열 팀 레코드는 안
 *   움직인다. 대한민국은 매일 10000 이라 웹 팀 경기 기본값(늘 10000)과 같다 — 넘기지도 받지도 않는다.
 * - 회복량 0x66ed0 은 모드 3 이 아니면 늘 20%다 (`staminaRecoveryPercentOf`).
 */

/** 리그 열 팀 0..9 — 6850 · 4f2bc 의 `cmp #9` 고리 */
const LEAGUE_TEAM_COUNT = 10
const SEASON_STAMINA_RECOVERY = { mode: 2, isMine: false, isStarterRole: false } as const

/** `0xb6190` — 다른 아홉 팀 투수 전원 10000 */
function fullCpuPitcherStaminas(myTeamId: number): Record<number, readonly number[]> {
  const table: Record<number, readonly number[]> = {}
  for (let team = 0; team < LEAGUE_TEAM_COUNT; team += 1) {
    if (team !== myTeamId) table[team] = teamPitchers(team).map(() => FULL_STAMINA)
  }
  return table
}

/** `0xb6190` — 내 팀 투수 전원 10000 */
function withFullRosterStamina(roster: SeasonTeamRoster): SeasonTeamRoster {
  return { ...roster, pitchers: roster.pitchers.map((player) => ({ ...player, stamina: FULL_STAMINA })) }
}

/** 시즌 첫날 6850 — 열 팀 모두 0xb6190 */
function withSeasonFirstDayStamina(save: SeasonSave): SeasonSave {
  return {
    ...save,
    roster: withFullRosterStamina(save.roster),
    cpuPitcherStaminas: fullCpuPitcherStaminas(save.state.record.teamId),
  }
}

/**
 * 경기 끝 스태미나를 되적는다 — 내 팀은 명단 차례(요약 `ourPitcherStaminas`), 상대는 표 칸 차례.
 * 요약에 없는 칸은 그대로 둔다.
 */
/**
 * 시즌 CPU 경기의 경기용 능력치 갈래 (`0xb570c` 모드 2) — 팀 능력치 정액 `0xb592c`(시즌 기록의 10팀 네 칸)와
 * 코치 `0xb5a74`(SR+0x185, 팀 검사 없음). 리그 CPU 경기 교체의 마무리 후보 정렬(능력 합 `0xb5b50`)이 쓴다 (27f02c7).
 */
function seasonAbilityContextOf(state: SeasonState): LeagueAbilityContext {
  return { mode: SEASON_MODE, teamAbilities: state.teamAbilities, coach: state.record.coach }
}

/**
 * 정규시즌 사람 경기 그 팀의 **오늘 선발 칸** — 리그가 들고 다니는 투수 레코드 차례(`League.pitcherOrders`)의 0번.
 *
 * 원본 경기 준비 `0x6548`(670e~673e)은 g ≠ 0 이면 두 팀 레코드를 `0xb5ca8` 로 한 칸 돌린 뒤 0번을 세운다. 웹은 그
 * 한 칸을 경기가 끝난 뒤 `playLeagueDay`(`rotatesHumanGameTeams`)가 리그 차례에 넣으므로, 경기 전에는 여기서 미리
 * 한 칸 돌려 본다. 차례는 지난 시즌·포스트시즌에서 이어진다(`nextSeasonLeague`) — 첫 해 정규시즌에서만 `g % 4` 와 같다.
 */
export function seasonLeagueStarterSlotOf(league: League, team: number, day: number): number {
  return seasonLeaguePitcherOrderOf(league, team, day)[0] ?? 0
}

/**
 * 정규시즌 사람 경기를 준비했을 때 그 팀의 **투수 레코드 차례 전체** — 0번이 선발, 나머지가 교체 `0xabfcc` 의 벤치 차례.
 * `seasonLeagueStarterSlotOf` 와 같이 g ≠ 0 이면 `0x6548`(670e~673e)의 한 칸을 미리 돌려 본다.
 */
export function seasonLeaguePitcherOrderOf(league: League, team: number, day: number): readonly number[] {
  const prepared = cpuGameRotationAdvances(SEASON_MODE, day) ? rotateLeaguePitchers(league, [team]) : league
  return pitcherOrderOf(prepared, team)
}

/**
 * 국가대항전 상대국 슬롯(+0x934)의 투수 레코드 차례 — 하루마다 마스터에서 새로 덮이고(0xb818c b8216 → 0x20648) 그날
 * 경기 준비 `0x6548` 이 g ≠ 0 이면 한 칸 돌린다 → 첫날 `[0..7]`, 그 뒤로는 늘 `[1,2,3,0,4..7]` (7dd3826).
 */
export function nationalCupOpponentPitcherOrderOf(cupDay: number): readonly number[] {
  return cupDay === 0 ? UNSHUFFLED_PITCHER_ORDER : advanceRotation(UNSHUFFLED_PITCHER_ORDER)
}

/**
 * 내 팀 명단을 **원본 저장 레코드 모양**으로 — 웹 시즌 명단(`roster`·`cupRoster`)은 로테이션을 돌기 전 모양이고 돈 칸 수
 * k(경기 옵션 `dayCounter` 의 `rotationSlotOf`)를 따로 셈한다(`seasonEntry` 머리 주석). 원본 `0x6548` 은 저장 레코드를
 * `0xb5ca8` 로 제자리에서 돌린 뒤 경기용 팀 객체 `0xb891c`(`team[i] = i`)를 세우므로 0번 레코드가 선발이고 **나머지가 그
 * 차례대로 교체 `0xabfcc` 의 벤치 차례**다. 진행기는 넘긴 명단 차례를 벤치 차례로 쓰므로, 명단 투수 0~3 을 k 칸 돌려
 * 넘기고(시작 스태미나도 같이) 선발 칸은 0(`dayCounter: 0`)으로 둔다. 끝 스태미나는 `withGameEndStamina` 가 되돌린다.
 */
function withOwnRecordRotation(options: TeamGameOptions): { readonly options: TeamGameOptions; readonly shift: number } {
  const shift = rotationSlotOf(options.dayCounter ?? 0)
  const order = options.ourEntryOrder
  const staminas = options.ourPitcherStaminas
  return {
    shift,
    options: {
      ...options,
      dayCounter: 0,
      // 상대 칸은 리그 차례(`opponentPitcherOrder`)로 서지만, 안 넘긴 길이 날짜 칸을 따라 바뀌지 않게 남겨 둔다
      opponentDayCounter: options.opponentDayCounter ?? options.dayCounter ?? 0,
      ...(order === undefined ? {} : { ourEntryOrder: { ...order, pitchers: rotatedPitchersOf(order.pitchers, shift) } }),
      ...(staminas === undefined ? {} : { ourPitcherStaminas: rotatedPitchersOf(staminas, shift) }),
    },
  }
}

function withGameEndStamina(save: SeasonSave, summary: TeamGameSummary, ownRotationShift: number): SeasonSave {
  // 진행기에는 0x6548 이 돌린 레코드 차례로 넘겼다(`withOwnRecordRotation`) — 웹 명단 차례로 되돌린다
  const ours = summary.ourPitcherStaminas === undefined
    ? undefined
    : unrotatedPitchersOf(summary.ourPitcherStaminas, ownRotationShift)
  const theirs = summary.opponentPitcherStaminas
  return {
    ...save,
    roster: ours === undefined ? save.roster : {
      ...save.roster,
      pitchers: save.roster.pitchers.map((player, index) => {
        const stamina = ours[index]
        return stamina === undefined ? player : { ...player, stamina }
      }),
    },
    cpuPitcherStaminas: theirs === undefined
      ? save.cpuPitcherStaminas
      : { ...save.cpuPitcherStaminas, [summary.opponentTeamId]: theirs },
  }
}

/** 하루 끝 4f2bc — 열 팀 모두 `0xb617c` (투수마다 +20%, 10000 에서 자름) */
function withDayEndRecovery(save: SeasonSave): SeasonSave {
  const recover = (stamina: number) => recoverStaminaAfterGameDay(stamina, SEASON_STAMINA_RECOVERY)
  const table: Record<number, readonly number[]> = {}
  for (const [team, staminas] of Object.entries(save.cpuPitcherStaminas ?? {})) {
    table[Number(team)] = staminas.map(recover)
  }
  return {
    ...save,
    roster: {
      ...save.roster,
      pitchers: save.roster.pitchers.map((player) => ({ ...player, stamina: recover(player.stamina) })),
    },
    cpuPitcherStaminas: table,
  }
}

/** 팀 경기 옵션의 시작 스태미나 — 내 팀은 명단 차례, 상대는 표 칸 차례 (정규·포스트시즌만) */
function staminaOptionsOf(save: SeasonSave, opponentTeamId: number): Partial<TeamGameOptions> {
  const opponent = save.cpuPitcherStaminas?.[opponentTeamId]
  return {
    ourPitcherStaminas: save.roster.pitchers.map((player) => player.stamina),
    ...(opponent === undefined ? {} : { opponentPitcherStaminas: opponent }),
  }
}

/** SR+0xb7 = 0xf 는 "우승팀 미정" 이다 (P4 1a) */
const NO_CHAMPION = 0xf

/**
 * 경기진행 설정의 원본 기본값 — 전역 저장이 0 으로 초기화되므로 모든 칸이 0 이다:
 * 종류 0 **찬스** · 값 0 **공격 득점권**(사람이 공격 중 2·3루에 주자가 있을 때만 조작) · 상세 비트 모두 0.
 * 예전에는 웹판 판단으로 "모든 이닝 직접"(`FULL_PLAY_SETTINGS`)을 박아 두었다 — 원본과 달라 걷었다.
 * 처음 경기정보(0xdd)에 들어오면 설정 창이 저절로 열리므로(+0x11e) 사람이 바로 고를 수 있다.
 */
export const SEASON_DEFAULT_MATCH_SETTINGS: MatchProgressSettings = {
  kind: MATCH_SETTING_KIND.찬스,
  value: CHANCE_VALUE.공격득점권,
  battingOrderBits: 0,
  pitchingInningBits: 0,
  offenseRunnerBits: 0,
  defenseRunnerBits: 0,
}
/** 시즌모드 = 원본 게임 모드 2 (능력치 보정 마스크 0x306 에 든다) */
const SEASON_GAME_MODE = 2
/** 경기 뒤 마무리 0xf1 진입 0x953c 가 트는 배경음 — 관리 화면 4 (`0x6ea6d(소리, 4, −1, 1)`) */
const SEASON_MANAGEMENT_BGM = 4
/** 이벤트 재생 0xd3 배경음 (0x5110 `0x6ea6d(소리, 0x28, −1, 1)`) */
const SEASON_EVENT_BGM = 40

/** 정산 진입에서 정산을 마친 경기 — 결과 화면 확인 뒤 갈 장면과 그때 낼 평가 징글 */
interface SettledSeasonGame {
  readonly next: SeasonSceneState
  readonly jingle: number | null
}

/** 같은 경기 화면을 쓰는 세 갈래 — 끝났을 때 정산하는 곳이 다르다 */
export type SeasonGameKind = '정규' | '포스트시즌' | '국가대항전'

const SEASON_GAME_KINDS: readonly SeasonGameKind[] = ['정규', '포스트시즌', '국가대항전']

/**
 * **시즌 경기 블록 → 이어 세울 진행.** 시즌 저장이 블록을 모르는 값으로 들고 있으므로 시즌(모드 2) 경기 진행인지 가려 낸다.
 * ⚠️ 웹 전용: 원본은 파일을 그대로 올린다(0x213c0). 웹은 진행 꼴이 바뀌어 옛 블록을 못 읽으면 null(저장 없음)로 거른다.
 */
export function seasonGameProgressOf(raw: unknown): TeamGameProgress | null {
  if (raw === null || typeof raw !== 'object') return null
  const progress = raw as Partial<TeamGameProgress>
  const { options, game } = progress
  if (options === undefined || options === null || typeof options !== 'object') return null
  if (options.mode !== SEASON_GAME_MODE) return null
  if (game === undefined || game === null || typeof game !== 'object') return null
  if (typeof game.inning !== 'number' || (game.half !== '초' && game.half !== '말')) return null
  if (!Array.isArray(progress.ourEntry) || !Array.isArray(progress.opponentEntry)) return null
  if (!Array.isArray(progress.ourPitcherEntry) || !Array.isArray(progress.opponentPitcherEntry)) return null
  return raw as TeamGameProgress
}

/** 저장의 경기 블록을 고른다 — 꼴이 안 맞으면 null */
function normalizeGameSave(raw: unknown): SeasonGameSaveBlock | null {
  if (raw === null || typeof raw !== 'object') return null
  const value = raw as Partial<Record<keyof SeasonGameSaveBlock, unknown>>
  if (seasonGameProgressOf(value.progress) === null) return null
  const kind = SEASON_GAME_KINDS.find((candidate) => candidate === value.kind)
  if (kind === undefined) return null
  const shift = typeof value.ownRotationShift === 'number' && Number.isInteger(value.ownRotationShift)
    ? value.ownRotationShift
    : 0
  return { progress: value.progress, kind, ownRotationShift: shift }
}

/**
 * 저장에서 읽은 것을 쓸 수 있는 모양으로 만든다.
 *
 * 저장은 그냥 JSON 이라 **필드가 늘기 전에 저장한 세이브**에는 나중에 생긴 칸이 아예 없다.
 * 예전에는 `as SeasonSave` 로 캐스팅만 해서 그 `undefined` 가 그대로 흘렀고, 경기 한 판만
 * 끝내도 `seasonReputation` 의 `score -= s[1]` 에서 터졌다. 나만의리그 쪽 `normalizeCareer`
 * 와 같은 자세로 **빠진 칸만 기본값으로 채운다** — 있는 값은 손대지 않는다.
 */
function normalizeSeasonSave(saved: Partial<SeasonSave> | null): SeasonSave | null {
  if (saved === null || saved === undefined || typeof saved !== 'object') return null
  // 시즌 초기화(`resetSeason` — game_s.sav 지움)가 남긴 덩어리 — 저장소에 clear 가 없어 전역 칸 둘만 남긴 덩어리
  // (`SeasonGlobalCarry`)를 덮어쓴다. 시즌은 없다
  if (saved.state === undefined) return null
  const state = normalizeSeasonState(saved.state)
  const roster = saved.roster === undefined
    ? rosterOf(state.record.teamId)
    : withTablePositions(saved.roster, state.record.teamId)
  // 스태미나 표가 생기기 전 저장은 명단 투수를 0(표에서 만든 값)으로 적었고 경기는 늘 10000 으로 쳤다 —
  // 그 값 그대로 10000 으로 채운다
  const staminaKnown = saved.cpuPitcherStaminas !== undefined
  // 옛 저장(칸 없음)은 경기 저장 없음 — 블록을 못 읽으면 +0x4e 도 내린다(웹 전용, 블록 없이 표시만 설 수는 없다)
  const gameSave = normalizeGameSave(saved.gameSave)
  return {
    ...saved,
    isGameInProgress: saved.isGameInProgress === true && gameSave !== null,
    gameSave,
    state,
    league: saved.league ?? EMPTY_LEAGUE,
    roster: staminaKnown ? roster : withFullRosterStamina(roster),
    playerStats: saved.playerStats ?? EMPTY_LEAGUE_PLAYER_STATS,
    cpuPitcherStaminas: saved.cpuPitcherStaminas ?? fullCpuPitcherStaminas(state.record.teamId),
  }
}

/**
 * **시즌 모드 경기 뒤 평가 징글** (36 좋음 · 37 보통 · 38 나쁨).
 *
 * 원본 시즌 상태 **0xe9(경기 뒤 관중·수입 창, 0xdea0)** 안 `0xdeae~0xdede` — 직접 떠서 옮겼다:
 * ```
 * 0000deae: adds r3,#0x4a ; ldrb r3,[r3] ; lsls/asrs #0x18   ; p = (s8)레코드[+0x4a]
 * 0000deb6: cmp r3,#0 ; bge 0xdeca
 * 0000debc: movs r1,#0x26        ; p < 0      → 38   (예약 0xdec4)
 * 0000dece: cmp r3,#3 ; bgt 0xded8                   ; ★ 시즌 문턱은 3 (나만의리그는 1)
 * 0000ded4: movs r1,#0x25        ; 0 ≤ p ≤ 3 → 37   (예약 0xdede)
 * 0000deda: movs r1,#0x24        ; p > 3     → 36
 * ```
 * 나만의리그 쪽(0x12c96, 문턱 1)은 `useCareerSession.evaluationJingleIdOf` 가 따로 들고 있다 —
 * **문턱만 다르고 모양이 같다**. 레코드 `+0x4a` 는 `SeasonRecord.lastPopularityChange` 다.
 *
 * 웹은 `play` 로 낸다. `0x6e498` 은 큐가 아니라 **지금 소리를 끊고 한 칸을 덮어쓴 뒤 다음 틱에 트는**
 * 것이라(`shared/api/audio/soundPort` 머리 주석) 통로가 하나인 웹의 `play` 와 들리는 결과가 같다.
 */
const SEASON_EVALUATION_THRESHOLD = 3
export function seasonEvaluationJingleIdOf(popularityChange: number): number {
  if (popularityChange < 0) return 38
  return popularityChange > SEASON_EVALUATION_THRESHOLD ? 36 : 37
}

/**
 * 장면 0x105 를 만들 때(`0x3b14` 4016 `0x8ce94` → `0xacf60`) — 반복 이벤트의 본 비트를 지운다.
 * 메모리에서만 지우고 저장은 다음 저장 때 같이 된다.
 */
function withSceneConstructed(save: SeasonSave | null): SeasonSave | null {
  if (save === null) return null
  const record = clearRepeatableSeen(save.state.record)
  return record === save.state.record ? save : { ...save, state: { ...save.state, record } }
}

/**
 * 새 해 `0x6e0c` — 결산을 닫은 뒤(국가대항전이 없는 해)와 **국가대항전 결과 팝업을 닫은 뒤**(`0x896c` →
 * `0x8a56`/`0x8b10` 보상 → `0x8b88: bl 0x6e0c`) 두 자리가 같은 함수를 부른다.
 *
 * ```
 * e = 0xa3084(SR)                 ; 연차 idx 가 9(isFinalYear)가 아니면 −1
 * e ≥ 0: 저장+0xa0+e = 1, phase = 6, 저장, 이벤트 500 → 0xd3 → 0xf5(엔딩)
 * e < 0: phase = 1 · 0xa305c(리그 초기화) · 연차 +1 · 사기 100 · CPU 9팀 +30 → 0xc9
 * ```
 * 리그 초기화 `0xa305c → 0xb7b34` 가 **L = SR+0x80 을 0xf8 바이트 memset** 하므로 국가대항전 플래그
 * `SR+0x12c`(= L+0xac)도 여기서 0 이 된다 — `startNextYear` 주석 참고.
 */
function nextYearOf(save: SeasonSave): { readonly save: SeasonSave; readonly scene: SeasonSceneState } {
  const { record } = save.state
  // 0x6e0c 머리 — 마지막 해(연차 idx 9)면 새 해 대신 **엔딩**이다.
  // `judgeSeasonEnding` 이 0~4 를 돌려주는 해가 곧 `isFinalYear` 인 해라 둘은 같은 조건이다.
  if (isFinalYear(record) && judgeSeasonEnding(record) !== null) {
    return {
      save: { ...save, state: { ...save.state, record: { ...record, phase: SEASON_PHASE.엔딩 } } },
      scene: SEASON_SCENE_STATE.엔딩,
    }
  }
  // 새 해로 넘어가며 리그 전적·선수 성적을 비운다 (정규시즌 표는 해마다 새로 센다).
  // 투수 레코드 차례는 잇는다 — 리그 초기화 0xb7b34 는 L(SR+0x80)만 지우고 팀 저장 레코드(0x1f570)는 다시 짓지
  // 않으므로 0xb5ca8 로 섞인 차례(정규시즌 + 포스트시즌 시리즈에서 돈 칸)가 새 해로 남는다 (3eb7301)
  const series = save.series ?? null
  const pitcherOrders = series === null
    ? save.league.pitcherOrders
    : pitcherOrdersAfterPostseason(series, save.league.pitcherOrders)
  return {
    save: {
      ...save,
      state: startNextYear(save.state),
      league: nextSeasonLeague(pitcherOrders),
      playerStats: EMPTY_LEAGUE_PLAYER_STATS,
      series: null,
      ranking: [],
    },
    scene: SEASON_SCENE_STATE.관리메뉴,
  }
}

/**
 * @param wallet 전역 G 지갑(`useGamePointWallet`). 넘기면 **지갑이 G 의 주인**이고
 *   시즌은 자기 주머니를 안 쓴다. 안 넘기면 예전처럼 세션 주머니로 논다(테스트용) —
 *   그 자리는 새로 고치면 사라진다.
 * @param aceLevels 전역 마선수 레벨 열 칸(`mgr[0x13a..0x143]`, `useAceLevels().levels`).
 *   시즌 경기 옵션에 그대로 실어 명단 마선수 능력치 배율 `0xd88aa`(0xb6414 첫 단계)와
 *   상대 마투수 마구 횟수 `0xd8509` 가 이 값을 보게 한다 — 시즌이라고 따로 보는 칸은 없다.
 *   안 넘기면 팀 경기 쪽 기본(전부 Lv1 = 60%)이다.
 */
export function useSeasonSession(
  store: JsonStorePort,
  random: RandomPort,
  wallet: GamePointWalletSession | null = null,
  aceLevels?: Readonly<Record<number, number>>,
  /** 기록연감 통계 `[mgr+0xc8]` 에 한 건 쌓는다 (G 사용처 0x22c29 — 시즌은 k 3). 안 넘기면 안 쌓는다 */
  recordStat?: (event: AnnalsStatEvent) => void,
  /**
   * 결산 0x6900 의 0x29 검사가 읽는 다른 두 모드 저장 +0x7a 와 전역 해금표 — 결산에 들어갈 때 부른다.
   * 안 넘기면(그 저장을 못 읽으면) 0x29 검사를 건너뛴다 (나리 쪽 `applyRegularSeasonReward` 와 같은 자세).
   */
  autobotBatInput?: () => SeasonAutobotBatInput | undefined,
  /**
   * 전역기록 `+0x145` 지급 비트를 담는 저장소 (`game_o.sav` 의 그 바이트 — `collectionRewards.ts`). 넘기면 리그 1위 G 를
   * 받은 문턱이 새로 고쳐도 남는다. 안 넘기면 세션 상태로만 든다(테스트용 — 예전 동작).
   */
  rewardStore?: JsonStorePort,
  /**
   * 기록연감의 명전 칸 — 영입한 명전 선수(id ≥ 0xb4)를 팀 경기에 그 기록으로 세울 때 읽는다(`seasonHallOfFameRecordSourceOf`).
   * 기록연감 훅이 시즌 세션보다 늦게 서므로 경기를 세울 때 부른다. 안 넘기면 그 선수는 예전 근사(남은 표 칸)로 선다.
   */
  readHallOfFame?: () => SeasonHallOfFame | undefined,
): SeasonSession {
  /** 내 팀 명단 차례 — 영입한 명전 선수에게 기록을 싣는다 (7da5044 의 받는 쪽 `TeamEntryOrder.record`) */
  const recordSourceNow = useCallback((): SeasonEntryRecordSource | undefined => {
    const hallOfFame = readHallOfFame?.()
    return hallOfFame === undefined ? undefined : seasonHallOfFameRecordSourceOf(hallOfFame)
  }, [readHallOfFame])
  const entryOrderOf = useCallback(
    (roster: SeasonTeamRoster) => seasonEntryOrderOf(roster, recordSourceNow()),
    [recordSourceNow],
  )
  const loaded = useRef<SeasonSave | null>(null)
  if (loaded.current === null) loaded.current = withSceneConstructed(normalizeSeasonSave(store.load() as Partial<SeasonSave> | null))
  /** 시즌이 없을 때의 전역 칸 (`SeasonGlobalCarry`) — 시즌이 있으면 그 저장이 주인이다 */
  const carriedGlobals = useRef<SeasonGlobalCarry | null>(null)
  if (carriedGlobals.current === null) carriedGlobals.current = seasonGlobalCarryOf(store.load())

  const [save, setSave] = useState<SeasonSave | null>(loaded.current)
  const [scene, setScene] = useState<SeasonSceneState>(() =>
    save === null
      ? SEASON_SCENE_STATE.팀고르기
      // SR+0x1bc 가 서 있으면(엔딩까지 본 시즌) 진입 분기가 phase 를 보기 전에 관리 메뉴로 보낸다
      : enterSeasonScene(save.state.record, {
        hasSeasonSave: true,
        forceManagementMenu: save.state.record.endingSeen,
      }),
  )
  const [notice, setNotice] = useState('')
  const [gameOptions, setGameOptions] = useState<TeamGameOptions | null>(null)
  /** 이어하기로 세울 진행 — 새 경기면 null (`SeasonSession.resumeGame`) */
  const [resumeGame, setResumeGame] = useState<TeamGameProgress | null>(null)
  /** 지금 경기에 넘긴 내 팀 명단을 0x6548 로테이션 몇 칸 돌렸는가 (`withOwnRecordRotation`) — 끝 스태미나를 되돌린다 */
  const [ownRotationShift, setOwnRotationShift] = useState(0)
  /** 지금 치르는 경기가 무엇인가 — 끝났을 때 어디로 정산할지 갈린다 */
  const [gameKind, setGameKind] = useState<SeasonGameKind>('정규')
  /** 전역 저장 +0x145 — 리그 1위 G 를 이미 받은 문턱 비트 (시즌을 새로 해도 남는다, `rewardStore` 에 둔다) */
  const [rewardRecord, setRewardRecord] = useState<CollectionRewardRecord>(
    () => normalizeCollectionRewardRecord(rewardStore?.load()),
  )
  const leagueFirstAwardedBits = rewardRecord.awardedBits
  useEffect(() => {
    rewardStore?.save(rewardRecord)
  }, [rewardRecord, rewardStore])
  /**
   * 지갑을 안 넘겼을 때만 쓰는 **세션 주머니** — 옛 동작 그대로다 (테스트용).
   * 지갑을 넘기면 이 칸은 놀고 `wallet.balance` 가 유일한 값이다.
   */
  const [ownGamePoints, setOwnGamePoints] = useState(0)
  /**
   * 다음경기 화면(0xd8)에 **관리 메뉴에서** 들어왔는가 — 원본 키 0x48ea 가 보는 이전 상태
   * `this+0x24 == 0xc9` 자리다. 경기 뒤(0xf1)·저장에서 바로 들어오면 거짓이라 취소가 안 먹는다.
   */
  const [nextGameFromMenu, setNextGameFromMenu] = useState(false)
  /** 선수단 0xd7 의 `this+0x11c` — 구단관리 코치채용은 2, 경기 전 흐름은 1 */
  const [squadPurpose, setSquadPurpose] = useState<SquadPurpose>(SQUAD_PURPOSE.코치채용)
  const [preGameAces, setPreGameAces] = useState<PreGameAces>(PRE_GAME_ACES_START)
  const [pendingGame, setPendingGame] = useState<PendingSeasonGame | null>(null)
  const [isMatchSettingsOpen, setIsMatchSettingsOpen] = useState(false)
  /** 전역 저장 app+0xe0 — 열린 구장 히든 아이템 id (S3 7절). 웹은 세션 상태에 둔다(근사) */
  const [openedStadiumIds, setOpenedStadiumIds] = useState<readonly number[]>([])
  /** 전역 해금표 app+0xc0 중 시즌모드가 연 칸 (0x29) — 세션 상태, 앱이 기록연감 해금 목록에 합친다 */
  const [openedHiddenIds, setOpenedHiddenIds] = useState<readonly number[]>([])
  /** 지금 결산 진입(0x6900) — 0x29 가 새로 열려 진입의 리그 1위 G 검사를 건너뛰었는가 (0x69ce → 0x6ac8) */
  const [summaryEntry, setSummaryEntry] = useState<SeasonSummaryEntry | null>(null)
  const summaryEntrySerial = useRef(0)
  const autobotBatInputRef = useRef(autobotBatInput)
  autobotBatInputRef.current = autobotBatInput
  /** 엔트리 편집 0xe0 — 편집 객체와 목록 */
  const [entryEdit, setEntryEdit] = useState<SeasonEntryEdit | null>(null)
  /** 이벤트 재생 0xd3 — 트는 이벤트와 돌아갈 상태 */
  const [eventPlayback, setEventPlayback] = useState<SeasonEventPlayback | null>(null)
  /** this+0x148 — CPU 트레이드 요청 (장면 객체 칸, 저장 안 함) */
  const [tradeRequest, setTradeRequest] = useState<TradeRequest>(NO_TRADE_REQUEST)
  /** 관리 메뉴 진입의 요청 알림 [203] (팝업 0x27) 이 떠 있는가 */
  const [isTradeRequestAlertOpen, setTradeRequestAlertOpen] = useState(false)
  const [trainingResult, setTrainingResult] = useState<SeasonTrainingResult | null>(null)
  const [outingPlace, setOutingPlace] = useState<number | null>(null)
  const [outingResultText, setOutingResultText] = useState<string | null>(null)
  /** 0xed 진입 0xe7ac → 0x8dd60 이 굴린 시즌 MVP 순위 종류(표 0xd4f34 의 rand(0..6)) — 376 창 · 378/379 가 읽는다 */
  const seasonMvpKind = useRef<LeaderKind | null>(null)
  /** 관리 메뉴·구단관리 메뉴 객체의 커서 — 장면 생성(0x3b14)에서 0, 상태를 오가도 남는다 */
  const [menuCursors, setMenuCursors] = useState<SeasonMenuCursors>(INITIAL_SEASON_MENU_CURSORS)
  /** 이전 상태 this+0x24 — 진입 갈래(0x4efc · 0x47d8)가 본다 */
  const previousScene = useRef(scene)
  useLayoutEffect(() => {
    const previous = previousScene.current
    if (previous === scene) return
    previousScene.current = scene
    const record = save?.state.record
    if (record === undefined) return
    setMenuCursors((cursors) => menuCursorsOnEnter(cursors, scene, previous, record))
  }, [save, scene])
  const moveMenuCursor = useCallback((menu: keyof SeasonMenuCursors, index: number) => {
    setMenuCursors((cursors) => ({ ...cursors, [menu]: index }))
  }, [])
  const playbackSerial = useRef(0)
  /**
   * 전역 저장 +0xbe — 이벤트 100 의 1000 G 를 받았는가 (0x8c714). 모드를 가리지 않는 전역 칸이라 시즌을 새로
   * 해도 남는다. ⚠️ 웹엔 그 전역 저장 객체가 없어 세션 상태에 둔다(새로 고치면 사라진다) — 근사.
   */
  const [event100Awarded, setEvent100Awarded] = useState(false)
  /**
   * 이벤트 관리자 읽기 객체의 커서(+0x28 · +0x2c) — 관리자는 장면 0x105 를 만들 때(0x3b14) 새로 생긴다.
   * 웹은 훅이 서는 때와 경기를 마치고 돌아오는 때(`finishGame`)를 그 자리로 본다.
   */
  const eventCursor = useRef<SeasonEventCursor>(START_SEASON_EVENT_CURSOR)
  /**
   * 새 선수 플래그 this+0xf9 — 장면을 만들 때 0(0x401e), 진입 분기 0xcb 가 **새 시즌 초기화 0xcc 에서 왔을 때만** 1
   * (4c5a~4c78). 웹은 팀을 고른 직후(`chooseTeam`)가 그 자리다. 관리 메뉴 첫 폴링이 400 을 틀고 지운다.
   */
  const newPlayerFlag = useRef(false)

  /**
   * 지금 들고 있는 G — **화면도 판정도 이 값 하나만 본다.**
   *
   * 지갑을 넘기면 `?무한G` 는 지갑 안에서 처리된다(`balance` 가 늘 99999 이고 쓰기는 안 먹는다).
   * 안 넘겼을 때만 예전처럼 여기서 보여 주는 값을 올린다 — 판정도 같은 값을 보므로
   * "99999 인데 G포인트 부족" 같은 어긋남은 어느 쪽에서도 나지 않는다.
   */
  const gamePoints = wallet === null
    ? (isInfiniteGamePointOn() ? GAME_POINT_LIMIT : ownGamePoints)
    : wallet.balance

  /** G 보상을 쌓는다 (상한 99999 — 0xa3e4) */
  const gainGamePoint = useCallback(
    (amount: number) => {
      if (wallet !== null) return wallet.gain(amount)
      setOwnGamePoints((points) => Math.min(GAME_POINT_LIMIT, points + amount))
    },
    [wallet],
  )

  /**
   * G 를 치른다 (`spendGamePoint` 액션이자 안에서도 쓴다).
   * ⚠️ 지갑을 쓰면 **모자랄 때 한 푼도 안 깎인다**(0xa46e) — 세션 주머니 때의 0 으로 자르기와
   *    다르지만, 화면이 값을 먼저 막으니 닿지 않는 갈래다.
   */
  const spendGamePoint = useCallback(
    (cost: number) => {
      // 시즌이 G 를 쓰는 자리 셋 — 트레이드 0xd152 · 지옥훈련 0xa2fee(500) · 자동진행 0x3c862(모드 2 → k 3, |값|) —
      // 모두 G 를 뺀 뒤 `0x22c29(mgr, 3, 액수)` 로 시즌 소모 GP 에 적는다. 시즌 GP 아이템(0x8058)·십전대보탕(0x7cd8)도 여기로 온다
      recordStat?.({ kind: 'G사용', usage: GAME_POINT_USAGE.season, amount: Math.abs(cost) })
      if (wallet !== null) return wallet.spend(cost)
      setOwnGamePoints((points) => Math.max(0, points - cost))
    },
    [recordStat, wallet],
  )

  /** 정산 진입(0x4ea0c)에서 정산을 마친 경기 — 결과 화면 확인(`finishGame`)이 다음 장면으로 넘긴다 */
  const settledGame = useRef<SettledSeasonGame | null>(null)
  /** 마지막으로 쓴 저장 — 경기 화면의 이어하기 저장(effect)이 렌더 사이에 잇달아 와도 앞 것을 덮지 않게 */
  const latestSave = useRef(save)
  latestSave.current = save
  const commit = useCallback(
    (next: SeasonSave) => {
      latestSave.current = next
      setSave(next)
      store.save(next)
    },
    [store],
  )

  /**
   * 번호로 이벤트를 틀고 0xd3 으로 — `0x8bdc8` 은 커서 +0x2c 를 그 레코드 다음으로 옮긴다(0xae170).
   * 연초 목표 내장 이벤트(0x8a680)는 커서를 건드리지 않는다.
   */
  const startEvent = useCallback((eventId: number, returnScene: SeasonSceneState) => {
    if (eventId !== YEAR_GOAL_EVENT_ID) eventCursor.current = cursorAfterCalling(eventCursor.current, eventId)
    playbackSerial.current += 1
    setEventPlayback({ eventId, returnScene, serial: playbackSerial.current })
    setScene(SEASON_SCENE_STATE.이벤트재생)
    // 0xd3 진입 0x5110 — 0x8be21(이벤트 시작) 뒤 SR+0x50(phase) ≠ 2(정규시즌 경기 끝)이고 내장 이벤트([관리자+0x39f],
    // 연초 목표 0xc038 → 0x8a680)가 아니면 배경음 40 (512c~5152, 나리 114 0x11d00 과 같은 두 가드)
    const phase = latestSave.current?.state.record.phase
    if (eventId !== YEAR_GOAL_EVENT_ID && phase !== SEASON_PHASE.경기끝) activeSound().playBgm(SEASON_EVENT_BGM)
  }, [])

  /**
   * 상태에 **막 들어온 틀** (0xe9ac 의 e9c2: 상태가 바뀐 틀에만 ① 상태별 진입 함수 ② 이벤트 폴링이 돈다).
   * 같은 상태로 다시 가라고 해도(관리 메뉴 → 관리 메뉴) 바뀐 것이 아니라 돌지 않는다.
   */
  const enteredScene = useRef<SeasonSceneState | null>(null)
  useEffect(() => {
    if (enteredScene.current === scene) return
    enteredScene.current = scene
    // 결산을 떠나면 그 진입은 끝났다 — 다시 들어올 때 지난 진입 값을 새 진입으로 읽지 않게 비운다
    if (scene !== SEASON_SCENE_STATE.시즌결산) setSummaryEntry(null)
    if (save === null) return
    const { record } = save.state

    if (scene === SEASON_SCENE_STATE.관리메뉴 || scene === SEASON_SCENE_STATE.외출지도) {
      // 0xc9 진입 0x4efc: SR+0x1bc == 0 이면 phase = 3 · 저장 (4f78~4f9c)
      const entered = scene === SEASON_SCENE_STATE.관리메뉴 && !record.endingSeen && record.phase !== SEASON_PHASE.기본
        ? { ...record, phase: SEASON_PHASE.기본 }
        : record
      const polled = pollSeasonEvents(eventCursor.current, {
        scene,
        record: entered,
        teamMorale: save.state.teamMorale,
        event100Awarded,
        newPlayerFlag: newPlayerFlag.current,
      }, random)
      eventCursor.current = polled.cursor
      if (polled.record !== record) commit({ ...save, state: { ...save.state, record: polled.record } })
      const { poll } = polled
      if (poll.kind === '오프닝') {
        newPlayerFlag.current = false
        return startEvent(OPENING_EVENT_ID, scene)
      }
      if (poll.kind === '연초목표') return startEvent(YEAR_GOAL_EVENT_ID, scene)
      if (poll.kind === '이벤트') return startEvent(poll.eventId, scene)
      // 0xec10 — 아무 이벤트도 안 틀었고 0xc9 이고 this+0x148 ≠ 0 이면 요청 알림 [203] (팝업 0x27).
      // ⚠️ 그 앞 0xebfc 의 엔딩 플래그(0x1552adc) 갈래는 웹에 그 전역 칸이 없어 건너뛴다 — 시즌 중엔 늘 0 이다(유력)
      if (scene === SEASON_SCENE_STATE.관리메뉴 && tradeRequest.isRequested) setTradeRequestAlertOpen(true)
      return
    }

    // 팀 고르기 0xe4 진입 0x4774 — this+0x148 20바이트를 memset 0 (보통 트레이드는 요청 플래그가 늘 0)
    if (scene === SEASON_SCENE_STATE.트레이드) {
      setTradeRequest(NO_TRADE_REQUEST)
      return
    }

    // 결산 0xef 진입 0x6900 — 들어갈 때마다 머리에서 세 모드 해금 0x29 를 본다. 새로 열리면 해금 알림 창(0x62368 →
    // 0x74ef5, 꼬리표 0)을 띄우고 그 진입의 리그 1위 G 검사를 건너뛴다(0x69ce → 0x6ac8). 창을 닫으면 0x87e8 이 G 검사를
    // 한 번 돌린다. 안 열리면 진입이 곧장 G 검사를 한 번(0x69d4~0x6ac0) — 결산 화면(`SeasonSummaryScreen`)이 이 값으로
    // 그 창과 검사를 맡는다
    if (scene === SEASON_SCENE_STATE.시즌결산) {
      // 0xef 진입 0x6900 — SR+0x50 = 0xf · 저장 뒤 조건 없이 관리 화면 배경음 4 (6926~6934 `0x6ea6d(소리, 4, −1, 1)`)
      activeSound().playBgm(SEASON_MANAGEMENT_BGM)
      const input = autobotBatInputRef.current?.()
      const opens = input !== undefined && opensSeasonAutobotBat(record, {
        ...input,
        globalOpenedHiddenIds: [...input.globalOpenedHiddenIds, ...openedHiddenIds],
      })
      if (opens) setOpenedHiddenIds((opened) => [...opened, SEASON_AUTOBOT_BAT_HIDDEN_ID])
      summaryEntrySerial.current += 1
      setSummaryEntry({ serial: summaryEntrySerial.current, opensAutobotBat: opens })
      // 0x690e~0x6922 — 머리에서 SR+0x50 = 0xf 를 쓰고 0x1fded · 0x22755 로 저장한다(조건 없이, 포스트시즌 경기 뒤 다시 들어와도)
      commit({ ...save, state: { ...save.state, record: { ...record, phase: SEASON_PHASE.결산 } } })
      return
    }

    // 10년차 엔딩 0xf5 진입 0x6be8 — 엔딩 판정 0xa3085 가 0(비 인기 구단 — 보너스 표 0xcbc2e[0] = 0)이면 SR+0x7b = 1 · 저장
    // (6c12~6c2e) — 키 0x6b3c 가 보너스 팝업 없이 넘긴다. 이어서 배경음을 예약한다(0 → 52 · 그 밖 46, `seasonEndingBgmOf`)
    if (scene === SEASON_SCENE_STATE.엔딩) {
      const endingIndex = judgeSeasonEnding(record)
      if (endingIndex === 0 && !record.endingBonusReceived) {
        commit({ ...save, state: { ...save.state, record: { ...record, endingBonusReceived: true } } })
      }
      activeSound().playBgm(seasonEndingBgmOf(endingIndex))
      return
    }

    // 시즌 끝 사슬 — 진입 함수마다 phase 를 세우고 저장한다 (0x6d6c 0xb · 0xe854 0xc · 0xe900 0xd · 0xe7ac 0xe · 0x6c90 0x10)
    const step = SEASON_END_CHAIN.find((candidate) => candidate.state === scene)
    if (step === undefined) return
    const staged = { ...save, state: { ...save.state, record: { ...record, phase: step.phase } } }
    commit(staged)
    // 0xee — 392 를 틀고 [다음 0xeb] (6d9c~6db0)
    if (scene === SEASON_SCENE_STATE.포스트시즌시작) return startEvent(SEASON_GOAL_INTRO_EVENT_ID, step.next)
    // 0xf0 — 정규시즌 순위 0xb7aa0(L, 팀, 1) 로 401 · 402 · 403 (6cb2~6cee)
    if (scene === SEASON_SCENE_STATE.정규시즌순위) {
      const rank = Math.max(0, rankingOf(save.league).indexOf(record.teamId))
      return startEvent(regularSeasonRankEventId(rank), step.next)
    }
    // 0xeb 0xe854 · 0xec 0xe900 — 0x8dad5(evmgr, 0xc · 0xd) 로 타이틀 칸을 채우고 370 · 371 을 튼다(이전 = 다음 상태, 다음 = 0xd3)
    if (scene === SEASON_SCENE_STATE.타자시상) return startEvent(SEASON_AWARD_INTRO_EVENT_ID.타자, step.next)
    if (scene === SEASON_SCENE_STATE.투수시상) return startEvent(SEASON_AWARD_INTRO_EVENT_ID.투수, step.next)
    // 0xed 0xe7ac — 0x8dd61(evmgr) 가 표 0xd4f34 에서 rand(0..6) 으로 MVP 순위 종류를 고른 뒤(빈 순위표면 다시) 376 을 튼다
    if (scene === SEASON_SCENE_STATE.최우수선수) {
      seasonMvpKind.current = rollSeasonMvpKind(save, recordSourceNow(), random)
      return startEvent(SEASON_AWARD_INTRO_EVENT_ID.MVP, step.next)
    }
  }, [commit, event100Awarded, openedHiddenIds, random, recordSourceNow, save, scene, startEvent, tradeRequest.isRequested])

  const chooseTeam = useCallback(
    (teamId: number, name: string) => {
      // 새 시즌 0x57f4~0x5806: 전역기록 +0x42 = 1 · **+0x4e = 0** — 새 저장에는 경기 블록·표시 칸이 없다(= 0)
      const next: SeasonSave = {
        // 0xa33e4(SR, 0x1552d00+0x28) — 0xc8 에서 입력한 이름이 SR+0x17c 로
        state: startNewSeason(teamId, name),
        league: EMPTY_LEAGUE,
        roster: rosterOf(teamId),
        playerStats: EMPTY_LEAGUE_PLAYER_STATS,
        series: null,
        ranking: [],
        cup: null,
        cpuPitcherStaminas: fullCpuPitcherStaminas(teamId),
        // 경기진행 설정(+0x12c+1)과 창을 본 표시(+0x11e)는 전역 저장 칸이라 새 시즌이 넘겨받는다 — 시즌 초기화 뒤면
        // 남겨 둔 덩어리에서
        ...seasonGlobalCarryOf(save ?? carriedGlobals.current),
      }
      commit(next)
      // 0xcc → 0xcb: 새 시즌 초기화에서 왔으니 새 선수 플래그가 선다 — 관리 메뉴 첫 폴링이 400 을 튼다
      newPlayerFlag.current = true
      setScene(SEASON_SCENE_STATE.관리메뉴)
    },
    [commit, save],
  )

  const updateRecord = useCallback(
    (record: SeasonRecord) => {
      if (save === null) return
      commit({ ...save, state: { ...save.state, record } })
    },
    [commit, save],
  )

  const updateRoster = useCallback(
    (roster: SeasonTeamRoster) => {
      if (save === null) return
      commit({ ...save, roster })
    },
    [commit, save],
  )

  const removeHallOfFamer = useCallback(
    (id: number, isPitcher: boolean) => {
      if (save === null) return
      const roster = removeHallOfFamerFromRoster(save.roster, id, isPitcher)
      if (roster !== save.roster) commit({ ...save, roster })
    },
    [commit, save],
  )

  const removeCareerPlayer = useCallback(
    (isPitcher: boolean) => {
      const current = latestSave.current
      if (current === null) return
      const roster = removeCareerPlayerFromRoster(current.roster, isPitcher)
      if (roster !== current.roster) commit({ ...current, roster })
    },
    [commit],
  )

  /**
   * 0x224ec(mgr, 2) — 시즌 파일 지움(+0x42 = 0) · +0x4e = 0. 웹 시즌 저장 한 칸이 곧 그 파일이고 +0x4e 도 그 안에 있다.
   * 같은 함수의 나머지 칸(전역기록 G)은 웹에 짝이 없어 지울 것이 없다 — `entities/settings/model/modeReset.ts` 머리 주석:
   * +0x48/+0x49 · +0x54/+0x55 · +0xf8~+0x117 · +0x138 은 대전모드 8·9 칸(🌐), +8 은 시즌 파일 도장(0x22754 가 쓰고 0x213c0 이
   * 견준다). 경기진행 설정(+0x12c+1)·창 본 표시(+0x11e)는 이 함수가 안 건드리는 전역 칸이라 **남긴다** — 시즌 없는 덩어리에
   * 그 두 칸만 쓴다(`SeasonGlobalCarry`).
   */
  const resetSeason = useCallback(() => {
    const current = latestSave.current
    const carry = seasonGlobalCarryOf(current ?? carriedGlobals.current)
    carriedGlobals.current = carry
    latestSave.current = null
    setSave(null)
    store.save(carry)
    setGameOptions(null)
    setResumeGame(null)
    setPendingGame(null)
    setEntryEdit(null)
    setScene(SEASON_SCENE_STATE.팀고르기)
  }, [store])

  /**
   * 트레이드 진행 결과 (0xe7 — `docs/re/J-modes-rules.md` 4-4).
   *
   * 레코드(SR+0x56)·명단·G(저장+0x64)가 한꺼번에 바뀌므로 **한 번에 커밋한다** —
   * `updateRecord` 와 `updateRoster` 를 잇달아 부르면 같은 `save` 를 보고 한쪽이 덮인다.
   */
  const equipSeasonPlayer = useCallback(
    (purchase: SeasonEquipPurchase) => {
      const current = latestSave.current
      if (current === null) return
      const myTeamId = current.state.record.teamId
      const rosterIndex = purchase.isPitcher
        ? recordPitcherIndexOf(current, myTeamId, current.roster, purchase.recordIndex)
        : purchase.recordIndex
      const players = purchase.isPitcher ? current.roster.pitchers : current.roster.batters
      if (players[rosterIndex] === undefined) return
      const replaced = players.map((player, index) => (index === rosterIndex ? { ...player, equipment: purchase.equipment } : player))
      commit({
        ...current,
        state: { ...current.state, record: { ...current.state.record, money: purchase.money } },
        roster: purchase.isPitcher ? { ...current.roster, pitchers: replaced } : { ...current.roster, batters: replaced },
      })
    },
    [commit],
  )

  const buySeasonSubItem = useCallback(
    (slot: number) => {
      const current = latestSave.current
      if (current === null) return ''
      const applied = applySeasonSubItem(current.state.record, slot)
      commit({ ...current, state: { ...current.state, record: applied.record } })
      return applied.notice
    },
    [commit],
  )

  const buySeasonGpItem = useCallback(
    (slot: number) => {
      const current = latestSave.current
      if (current === null || slot === SEASON_STAMINA_ITEM) return null
      // 0x8034~0x8058: G 를 빼고 0x22c29(3, 값) — spendGamePoint 가 같은 차례로 적는다
      spendGamePoint(seasonGpItemPriceOf(slot))
      const effect = applySeasonGpItem(current.state.record, current.state.teamMorale, slot, random)
      commit({ ...current, state: { ...current.state, record: effect.record, teamMorale: effect.teamMorale } })
      // 0x8086 — 0x22e35(2, 칸)
      recordStat?.({ kind: 'GP아이템수', mode: SEASON_STAT_MODE, index: slot })
      return effect.notice
    },
    [commit, random, recordStat, spendGamePoint],
  )

  const recoverSeasonPitcherStamina = useCallback(
    (recordIndex: number) => {
      const current = latestSave.current
      if (current === null) return { notice: '', recovered: false }
      const rosterIndex = recordPitcherIndexOf(current, current.state.record.teamId, current.roster, recordIndex)
      const pitcher = current.roster.pitchers[rosterIndex]
      if (pitcher === undefined) return { notice: '', recovered: false }
      if (pitcher.stamina === FULL_PITCHER_STAMINA) {
        return { notice: seasonShopTextOf(SEASON_SHOP_TEXT.스태미나최대), recovered: false }
      }
      // 0x7ca2~0x7ce8: G −= 0xcbbe3[3] × 100 · 0x22c29(3, 값) · 0x22e35(2, 3) · 스태미나 = 10000 · 저장
      spendGamePoint(seasonGpItemPriceOf(SEASON_STAMINA_ITEM))
      recordStat?.({ kind: 'GP아이템수', mode: SEASON_STAT_MODE, index: SEASON_STAMINA_ITEM })
      const pitchers = current.roster.pitchers.map((player, index) =>
        (index === rosterIndex ? { ...player, stamina: FULL_PITCHER_STAMINA } : player))
      commit({ ...current, roster: { ...current.roster, pitchers } })
      return { notice: seasonShopTextOf(SEASON_SHOP_TEXT.스태미나회복), recovered: true }
    },
    [commit, recordStat, spendGamePoint],
  )

  const finishTrade = useCallback(
    (settlement: TradeSettlement) => {
      if (save === null) return
      // 성공이면 두 팀 레코드의 한 칸씩을 맞바꾼다 (0xd1cc~0xd3ae — 스태미나 +0x2c 도 레코드를 따라간다).
      // 화면·요청 칸은 레코드 차례라 명단 첨자로 되돌려 건다
      const swapped = settlement.swap === undefined ? save : withTradeSwap(save, rosterTradeSwapOf(save, settlement.swap))
      commit({
        ...swapped,
        state: { ...save.state, record: settlement.record },
      })
      spendGamePoint(settlement.gamePointCost)
    },
    [commit, save, spendGamePoint],
  )

  /**
   * 다음 경기 — ⚠️ **웹판 임시 자동 진행**. 파일 머리 주석 참고.
   *
   * 원본 순서를 지킨다: 내 경기를 치르고(0xc2dac 과 같은 간이 엔진) 전적에 넣은 뒤,
   * 같은 날 나머지 네 경기를 돌리고(0xc2a48 — 칸·명단 엇갈림 포함, `cpuGameSidesOf`), 평가(0xa719c)를
   * 얹고 phase 를 "경기끝" 으로 두어 관중수입(0xe9)으로 넘어간다.
   */
  /**
   * 커리어·팀 상태에서 팀 경기 옵션을 만든다 (세 종류가 같은 화면을 쓴다).
   *
   * `side` 는 원본 `0xb7844(리그, 팀)` 가 돌려주는 값 그대로다 — **1 = 홈(후공)**.
   * 세 갈래(정규·포스트시즌·국가대항전)가 서로 다른 가지를 타므로 부르는 쪽이 골라 넣는다.
   * 경기 준비 `0x6650` 이 그 값을 그대로 `경기[0x28 + side] = 팀번호` 로 꽂는다.
   */
  const optionsFor = useCallback(
    (opponent: number, side: number): TeamGameOptions | null => {
      if (save === null) return null
      const { record } = save.state
      return {
        mode: SEASON_GAME_MODE,
        ourTeamId: record.teamId,
        // [시즌+1] — 질병·보직·사기 보정(0xb5804)이 선수 팀 번호와 견주는 값. 국가대항전은
        // ourTeamId 만 대한민국(10)으로 바뀌고 이 값은 시즌 팀 그대로라 보정이 아무 팀에도 안 붙는다
        seasonTeamId: record.teamId,
        opponentTeamId: opponent,
        playerSide: side === LEAGUE_SIDE_HOME ? PLAYER_SIDE_LAST_BAT : PLAYER_SIDE_FIRST_BAT,
        // 경기진행 설정 시즌 칸 — 0xdd 의 '0' 창이 고친 값. 한 번도 안 고쳤으면 원본 0 초기값(찬스 · 공격 득점권)
        settings: save.matchSettings ?? SEASON_DEFAULT_MATCH_SETTINGS,
        // 코치는 SR+0x185 다 — 채용 화면(0xd7)이 채운 칸을 그대로 넘긴다 (−1 = 없음)
        // 질병 −30% 는 질병 종류 SR+5 가 아니라 **SR+6 > 0** 을 본다 (0xb5824 `ldrsb [SR,#6]`) — `illnessPenaltyFieldOf`
        season: { illness: illnessPenaltyFieldOf(record), morale: save.state.teamMorale, coach: record.coach },
        // 선발 = 리그 투수 레코드 차례의 0번 (`seasonLeagueStarterSlotOf` — g = SR+0xb2 ≠ 0 이면 0x6548 이 한 칸 돌린 뒤).
        // 엔트리 편집·경기정보는 내 팀 명단을 `rotationSlotOf(dayCounter)` 칸 돈 모양으로 보인다. 리그 차례는 0xb5ca8 만
        // 움직여 늘 투수 0~3 을 k 칸 돌린 모양이라 선발 칸 k 를 날짜 칸에 넣으면 그 모양이 원본 레코드와 같다 —
        // 포스트시즌(`postseasonStarterSlotOf`)과 같은 방식이다. 상대 팀은 레코드 차례 전체(`opponentPitcherOrder` — 0번 선발 · 나머지 벤치 차례)를 넘긴다. 날짜 칸
        // (`opponentDayCounter`)은 경기정보·CPU 엔트리 화면이 보는 같은 차례의 0번이다. 내 팀 벤치 차례는 경기를
        // 세울 때 `withOwnRecordRotation` 이 명단을 돌려 맞춘다
        dayCounter: seasonLeagueStarterSlotOf(save.league, record.teamId, record.games),
        opponentDayCounter: seasonLeagueStarterSlotOf(save.league, opponent, record.games),
        opponentPitcherOrder: seasonLeaguePitcherOrderOf(save.league, opponent, record.games),
        teamAbilities: save.state.teamAbilities,
        // 마선수 레벨 — 0xb6414 가 모드를 가리지 않고 전역 mgr[0x13a + i] 를 읽는다 (b9f896b·e2ee55a)
        aceLevels,
        // 시즌 저장의 팀 레코드 차례 그대로 — 경기용 팀 객체 0xb891c 는 첨자만 들고 선수는 0xb8680 으로 같은
        // 레코드(0x1f570)에서 읽으므로 엔트리 편집(0xe0)이 고친 차례가 곧 타순·벤치·투수 차례다 (c041959).
        // 경기정보 뒤에 편집이 끼면 `startPendingGame` 이 고친 명단으로 다시 싣는다
        ourEntryOrder: entryOrderOf(save.roster),
        // 상대 팀도 시즌 저장의 그 팀 레코드로 선다 (0xb891c → 0xb8680 → 0x1f570). 트레이드로 바뀐 팀만 저장에 있고
        // 나머지는 붙박이 표라 넘기지 않는다(예전 길 그대로)
        ...(save.cpuRosters?.[opponent] === undefined
          ? {}
          : { opponentEntryOrder: seasonEntryOrderOf(save.cpuRosters[opponent]) }),
      }
    },
    [aceLevels, entryOrderOf, save],
  )

  /**
   * 평판 기록 16칸(SR+0x1a0..0x1af)을 0 으로 — 원본 `0xa3424` = `memset(SR+0x1a0, 0, 16)`.
   *
   * **경기가 끝날 때가 아니라 시작할 때 지운다.** 부르는 곳은 경기 직전 경기정보 화면
   * (시즌 상태 0xdd)의 "경기 시작" 키 `0x83cc` **한 곳뿐**이고, 거기서 곧장 경기 장면으로
   * 넘어간다 (0x84ac `SR = [this+0xa0]` → `ldr r3,[0x85c8] = 0xa3425` → 0xa3424).
   * 웹판은 0xdd 의 확인(`startPendingGame`)과, 화면을 건너뛰는 `playNextGame` 이 이 자리를 맡는다.
   * 근거: `docs/re/S4-season-reputation.md` 2a·7절, `docs/re/R13-season-leftovers.md` 4절.
   */
  const clearGameRecord = useCallback(
    (current: SeasonSave, opponentTeamId: number) => {
      // 0xdd OK 의 0xa3424 뒤 곧장 경기 장면 셋업 — 정규시즌이면 관중·수입 0xa34b8 이 돈다 (`withSceneSetupIncome`)
      commit(withSceneSetupIncome({
        ...current,
        state: {
          ...current.state,
          record: { ...current.state.record, gameRecord: clearSeasonGameRecord() },
        },
      }, opponentTeamId))
    },
    [commit],
  )

  /**
   * 경기 전 화면(0xd7·0xdd)을 **건너뛰고** 곧장 정규 경기로 — 마선수 없이 저장된 설정으로 친다.
   * 원본에는 이런 길이 없다. 화면은 쓰지 않고 테스트·디버그용으로만 남긴다.
   */
  const playNextGame = useCallback(() => {
    if (save === null) return
    // 정규시즌 가지 — 0xb7844 가 일정표 0xd89cb 로 정한다 (리그 날짜 L+0x32 = SR+0xb2)
    const options = optionsFor(
      seasonOpponentOf(save.state.record),
      leagueSideOf(save.state.record.games, save.state.record.teamId),
    )
    if (options === null) return
    clearGameRecord(save, options.opponentTeamId)
    setGameKind('정규')
    setResumeGame(null)
    const prepared = withOwnRecordRotation({ ...options, ...staminaOptionsOf(save, options.opponentTeamId) })
    setOwnRotationShift(prepared.shift)
    setGameOptions(prepared.options)
    setScene(SEASON_SCENE_STATE.경기직전)
  }, [clearGameRecord, optionsFor, save])

  /**
   * 다음경기 화면 0xd8 에 들어간다 — 들어옴 `0x4cb8`:
   * ```
   * 4cc2  SR+0x50(phase) = 4
   * 4cc8  이전 상태 ≠ 0xd7 이면 0x1fded(app) · 0x22755(app, 1)   ; 저장
   * 4ce0  [this+0x90] vtable+0x14(0, 0)                          ; 1×1 격자 커서를 (0,0) 에 — 보이는 일 없음 (NextGameScreen 주석)
   * ```
   * phase 4 가 저장에 남으므로 이 화면에서 끄고 다시 들어오면 **관리 메뉴가 아니라 0xd8** 로 온다
   * (진입 분기 0xcb 는 짝수 경기라도 phase ∈ {1,3} 일 때만 관리 메뉴다).
   */
  const nextGameEntered = useCallback(
    (current: SeasonSave, fromMenu: boolean, fromSquad = false) => {
      const entered: SeasonSave = {
        ...current,
        state: { ...current.state, record: { ...current.state.record, phase: SEASON_PHASE.다음경기 } },
      }
      // 4cc8 — 이전 상태가 0xd7(경기 전 마선수 고르기 CLR)이면 phase 4 는 메모리에만 쓰고 저장하지 않는다
      if (fromSquad) {
        latestSave.current = entered
        setSave(entered)
      } else {
        commit(entered)
      }
      setNextGameFromMenu(fromMenu)
      setScene(SEASON_SCENE_STATE.다음경기)
    },
    [commit],
  )

  const openNextGame = useCallback(() => {
    if (save === null) return
    nextGameEntered(save, true)
  }, [nextGameEntered, save])

  /**
   * 0xd7 경기 전 마선수 고르기로 (this+0x11c = 1). 들어옴 0x5268 이 메뉴+0xd0 = 1 이라 늘 마투수부터다.
   */
  const enterPreGameSquad = useCallback((pending: PendingSeasonGame) => {
    setPendingGame(pending)
    setSquadPurpose(SQUAD_PURPOSE.경기전)
    setPreGameAces(PRE_GAME_ACES_START)
    setIsMatchSettingsOpen(false)
    setScene(SEASON_SCENE_STATE.선수단)
  }, [])

  /**
   * 0xdd 경기정보로 — 들어옴 0x6548 (이전 상태가 0xe0 이면 6556 에서 곧장 6850 으로 — 웹은 0xe0 에서 돌아올 때
   * 이 함수를 안 부른다):
   *   - 저장 +0x11e 가 0 이면 **경기진행 설정 창을 저절로 열고** 그 칸을 1 로 써서 저장한다 (6564~659c).
   *   - 국가대항전(SR+0x12c)이 아니면(66ae) 0xd7 에서 고른 마선수를 내 팀에 싣고(66da·66e6) 이어 **상대 팀 마선수를
   *     굴린다** — `v = 0x66968(rec+0xe)`(66ee) → `0xb88c8(상대, v)`(66f8) · `w = 0x66994(rec+0xd)`(6700) →
   *     `0xb8870(상대, w)`(670a). 이 둘(rand 2)이 0xdd 진입의 유일한 굴림이다. 웹은 굴린 값을 옵션 `opponentAces` 로
   *     싣고 경기정보·CPU 엔트리 화면이 같은 값을 본다. 다시 0xd7 → 0xdd 로 들어오면 다시 굴린다(원본 그대로).
   *   - 두 팀 명단 세우기(0xb891c)·로테이션(0xb8c80)은 웹에서는 경기를 세울 때(`startTeamGame`) 한다.
   *   - 6850: `SR+0xb2 == 0`(시즌 첫날)이면 열 팀 투수 전원 10000 (`withSeasonFirstDayStamina`, 모듈 머리 주석).
   *     포스트시즌도 SR+0xb2 = L+0x32 가 시리즈마다 0 부터라(0xb80a8 b811c · 0xb7724 b777a −1 · 0xb818c +1) 시리즈 첫 경기면
   *     이 고리를 돈다 — L+0x34 를 보지 않는다(6850~6860 직접 떴다). 국가대항전 첫날도 이 고리를
   *     돌지만 대회 중 0x1f9a9 는 상대국 슬롯을 돌려주므로 리그 팀은 안 바뀐다 — 웹은 건너뛴다.
   *
   * **투수 스태미나 (P1 3절 · 직접 떴다)** — 투수 레코드 +0x2c 는 경기용 칸이 아니라 **시즌 내내 이어지는 값**이다.
   *   - `0xb6190(팀)` = 그 팀 투수 전원(팀+0xc 명, 팀+0x14 배열, 0x30 간격) +0x2c = 10000 (b6192~b61aa, 확정).
   *   - 정규·포스트시즌: 첫날 6850 뒤로는 하루 끝 4f2bc 의 열 팀 `0xb617c`(+20%)만 회복한다 — 경기에서 깎인 값(0xaeb08)이
   *     다음 경기로 **이어진다**. 내 팀은 `roster.pitchers[i].stamina`, 다른 아홉 팀은 `cpuPitcherStaminas` 에 두고
   *     경기 옵션 `ourPitcherStaminas`·`opponentPitcherStaminas` 로 넘겨 요약으로 받는다 (`finishGame`).
   *   - 국가대항전: 대회 초기화 b7c88 과 하루 끝 0xb818c 대회 갈래가 **대한민국을 매일 10000** 으로 채우고,
   *     상대국은 매일 마스터에서 새로 복사된다(0x20648) — 웹 팀 경기 기본값(늘 10000)과 같아 넘기지 않는다.
   */
  const enterMatchInfo = useCallback(
    (current: SeasonSave, pending: PendingSeasonGame, aces: PreGameAces | null) => {
      // 0x6548 의 65ec~6626 — 0xb6814(전역 상태): +0x6b = 0 (`liveGameState`). 0xe0 에서 돌아온 길(6556 → 6850)은 안 지난다
      resetLiveGameState()
      setPendingGame(
        pending.kind === '국가대항전' || aces === null
          ? pending
          : { ...pending, options: { ...pending.options, opponentAces: rollOpponentAces(aces.pitcher, aces.batter, random) } },
      )
      const firstTime = current.matchSettingsSeen !== true
      // 6850 은 SR+0xb2 만 본다 — 포스트시즌도 시리즈 첫 경기(g = 0)면 열 팀을 채운다(`postseasonDayOf`)
      const firstDay = pending.kind !== '국가대항전' && current.state.record.games === 0
      if (firstTime || firstDay) {
        const seen = firstTime ? { ...current, matchSettingsSeen: true } : current
        commit(firstDay ? withSeasonFirstDayStamina(seen) : seen)
      }
      setIsMatchSettingsOpen(firstTime)
      setScene(SEASON_SCENE_STATE.경기정보)
    },
    [commit, random],
  )

  /** 확인 `0x48fc`: `SR+0xb4`(포스트시즌) ? 0xef : (this+0x11c = 1, 0xd7 선수단 → 0xdd → 경기) */
  const confirmNextGame = useCallback(() => {
    if (save === null) return
    if (save.state.record.inPostseason) return setScene(SEASON_SCENE_STATE.시즌결산)
    // 정규시즌 가지 — 0xb7844 가 일정표 0xd89cb 로 정한다 (리그 날짜 L+0x32 = SR+0xb2)
    const options = optionsFor(
      seasonOpponentOf(save.state.record),
      leagueSideOf(save.state.record.games, save.state.record.teamId),
    )
    if (options === null) return
    enterPreGameSquad({ kind: '정규', options })
  }, [enterPreGameSquad, optionsFor, save])

  /** 0xd7 OK (0xa734) — 잠긴 칸 팝업·레벨업 창은 화면(`AceSelectScreen`)이 한다 */
  const choosePreGameAceAction = useCallback(
    (cell: number) => {
      if (save === null || pendingGame === null) return
      const step = choosePreGameAce(preGameAces, cell)
      setPreGameAces(step.aces)
      if (step.kind === '경기정보') enterMatchInfo(save, pendingGame, step.aces)
    },
    [enterMatchInfo, pendingGame, preGameAces, save],
  )

  /**
   * 0xd7 CLR (0xa900). 마투수 단계에서 나가면 포스트시즌 0xef · 그 밖 0xd8 이다.
   * 0xd8 로 돌아가면 들어옴 0x4cb8 이 다시 돌지만 **이전 상태가 0xd7** 이라 저장하지 않고,
   * 그 화면의 취소(0x48ea, 이전 상태 == 0xc9 일 때만)도 먹지 않는다 — 원본 그대로.
   */
  const cancelPreGameAceAction = useCallback(() => {
    if (save === null) return
    const step = cancelPreGameAce(preGameAces, save.state.record.inPostseason)
    if (step.kind === '고르기') return setPreGameAces(step.aces)
    setPendingGame(null)
    if (step.scene === SEASON_SCENE_STATE.다음경기) return nextGameEntered(save, false, true)
    setScene(step.scene)
  }, [nextGameEntered, preGameAces, save])

  /**
   * 0xdd OK (0x847e~0x8532): 저장 · 평판 16칸 지움(0xa3424) · 0xe1 → 경기 장면.
   * 정규·포스트시즌이면 0xd7 에서 고른 마선수가 내 팀에 들어간다(0x6548 66ae~670a, 국가대항전은 안 넣는다).
   */
  const startPendingGame = useCallback(() => {
    if (save === null || pendingGame === null) return
    const withAces = pendingGame.kind === '국가대항전'
      ? {}
      : { acePitcherId: preGameAces.pitcher, aceBatterId: preGameAces.batter }
    // 0xdd 에서 엔트리 편집(0xe0)을 다녀왔으면 명단이 바뀌었다 — 경기는 지금 저장 레코드 차례로 선다.
    // 국가대항전은 대표팀 슬롯(+0x918) 명단이다
    const isCup = pendingGame.kind === '국가대항전'
    const roster = isCup ? save.cupRoster ?? tableRosterOf(pendingGame.options.ourTeamId) : save.roster
    clearGameRecord(save, pendingGame.options.opponentTeamId)
    setIsMatchSettingsOpen(false)
    setGameKind(pendingGame.kind)
    // 새 경기 — +0x4e = 1 과 첫 블록(0x84a0 · 0x1fdb0 칸 0xc · 0xd)은 경기 화면이 세운 첫 진행으로 `saveGameProgress` 가 쓴다
    setResumeGame(null)
    // 0x6548 이 돌린 저장 레코드 차례로 명단을 세운다 — 0번 선발 · 나머지 벤치 차례 (`withOwnRecordRotation`)
    const prepared = withOwnRecordRotation({
      ...pendingGame.options,
      settings: save.matchSettings ?? SEASON_DEFAULT_MATCH_SETTINGS,
      ourEntryOrder: entryOrderOf(roster),
      // 투수 스태미나 +0x2c — 시즌 내내 이어진 값으로 선다. 국가대항전은 두 팀 모두 10000(기본)이다
      ...(isCup ? {} : staminaOptionsOf(save, pendingGame.options.opponentTeamId)),
      ...withAces,
    })
    setOwnRotationShift(prepared.shift)
    setGameOptions(prepared.options)
    setPendingGame(null)
    setScene(SEASON_SCENE_STATE.경기직전)
  }, [clearGameRecord, pendingGame, preGameAces, save])

  /** 0xdd CLR (0x844e) — 국가대항전이면 0xf4(웹은 대회 화면), 아니면 0xd7 을 다시 들어온다(0x5268) */
  const cancelMatchInfo = useCallback(() => {
    if (pendingGame === null) return
    setIsMatchSettingsOpen(false)
    const next = matchInfoCancelScene(pendingGame.kind === '국가대항전')
    if (next === SEASON_SCENE_STATE.선수단) return enterPreGameSquad(pendingGame)
    setPendingGame(null)
    setScene(next)
  }, [enterPreGameSquad, pendingGame])

  /** 0xdd '0' (0x857a) — `0x5fef4(메뉴, 열림 뒤집기)` */
  const toggleMatchSettings = useCallback(() => setIsMatchSettingsOpen((open) => !open), [])

  const applyMatchSettings = useCallback(
    (settings: MatchProgressSettings) => {
      setIsMatchSettingsOpen(false)
      if (save === null) return
      commit({ ...save, matchSettings: settings })
    },
    [commit, save],
  )

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
          teamId, roster: current.cupRoster ?? tableRosterOf(teamId), dayCounter, acePitcherId: -1, aceBatterId: -1,
        }
      }
      return {
        teamId: current.state.record.teamId,
        roster: current.roster,
        dayCounter,
        acePitcherId: preGameAces.pitcher,
        aceBatterId: preGameAces.batter,
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
        }
      setEntryEdit({
        isUserTeam,
        teamId: source.teamId,
        editor: openEntryEditor(isUserTeam),
        lists: seasonEntryListsOf(source),
        isAceLocked: false,
      })
      setScene(SEASON_SCENE_STATE.엔트리편집)
    },
    [pendingGame, save, userEntrySourceOf],
  )

  /**
   * 0xe0 키 `0x7044` — 편집기 `0x55864` 를 돌리고 끝 코드 `[ed+0x338]` 을 본다:
   * 1 → 0xdd · 2 → CPU 팀일 때만 0xdd · 3 → 유저 팀일 때만 0xdd. 0xdd 로 돌아오면 들어옴 0x6548 이
   * 이전 상태 0xe0 을 보고 아무것도 안 한다(설정 창 자동 열기·명단 다시 세우기 없음) — 그래서 장면만 바꾼다.
   *
   * 유저 팀 명단이 바뀌면 곧장 시즌 세이브에 적는다. 원본은 저장 객체의 팀 레코드를 바로 고치고 파일 쓰기는
   * 0xdd 의 경기 시작(0x22754)이 하므로, ⚠️ 경기를 시작하지 않고 끄면 원본은 고친 것이 날아가지만 웹은 남는다.
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
        commit(pendingGame.kind === '국가대항전' ? { ...save, cupRoster: roster } : { ...save, roster })
        // 명단 첨자를 새 명단에 맞춰 다시 세운다 (줄 순서는 같다)
        lists = seasonEntryListsOf({ ...source, roster })
      }
      if (leavesEntryEditor(outcome.state.result, entryEdit.isUserTeam)) {
        setEntryEdit(null)
        setScene(SEASON_SCENE_STATE.경기정보)
        return
      }
      setEntryEdit({ ...entryEdit, editor: outcome.state, lists, isAceLocked: outcome.isAceLocked })
    },
    [commit, entryEdit, pendingGame, save, userEntrySourceOf],
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

  /** 0xdd "선발" 줄 — 내 팀 명단(엔트리 편집 결과)의 투수 0번 */
  const matchInfoStarterName = save !== null && pendingGame !== null
    ? (() => {
      const source = userEntrySourceOf(save, pendingGame)
      return seasonStarterNameOf(source.teamId, source.roster, source.dayCounter)
    })()
    : null
  /**
   * 0xdd 상대 "선발" 줄 — 0x5e0e8 이 상대 팀 레코드 0번을 읽는다. 레코드 0번 = 투수 차례(`opponentPitcherOrder`)의 0번 칸에
   * 앉은 선수라, 트레이드로 바뀐 CPU 팀은 저장 명단(`cpuRosterOf`)의 그 칸 선수 이름이다. 차례가 없는 길(국가대항전)은 null
   */
  const matchInfoOpponentStarterName = save !== null && pendingGame !== null
    && pendingGame.options.opponentPitcherOrder !== undefined
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
  }, [commit, nextGameFromMenu, save])

  /**
   * 경기가 끝났다 — 원본 차례 그대로 정산한다:
   * 내 경기를 전적에 넣고, 같은 날 나머지 네 경기를 돌리고(0xc2a48 — 칸·명단 엇갈림 포함, `cpuGameSidesOf`),
   * 선수 기록표에 **양 팀 타석**을 쌓고(0xa8024), 평가(0xa719c)를 얹은 뒤 관중수입(0xe9)으로 간다.
   * 평가는 **정규시즌 경기만** 받는다 — 포스트시즌·국가대항전은 원본 0x4ea0c 가 건너뛴다.
   */
  const settleGame = useCallback(
    (summary: TeamGameSummary): SettledSeasonGame | null => {
      const latest = latestSave.current
      if (latest === null) return null
      // 전역 경기 상태 +0x6b 에 이 경기 끝 이닝이 남는다(0xb6b6c — 정규·포스트시즌·국가대항전 모두) (`liveGameState`)
      setLiveGameInningIndex(summary.inningsPlayed - 1)
      // 0x4f3d6 — 같은 진입이 +0x4c+모드(+0x4e)를 0 으로 쓰고 0x1fded · 0x22755 · 0x1f1b9 로 저장한다. 정산과 한 커밋이다
      const savedBefore: SeasonSave = { ...latest, isGameInProgress: false, gameSave: null }
      // 돌발미션 보상·페널티 (0x8e34c 모드 2) — 원본은 판정이 난 경기 중에 SR·팀 사기에 바로 더하므로 평가보다 앞이다.
      // 요약이 경기 중 `resolveBurst` 의 deltas 를 판정 차례대로 싣고 온다(`burstRewardDeltas`)
      const burstDeltas = summary.burstRewardDeltas ?? []
      const afterBurst = applySeasonBurstRewards(savedBefore.state, burstDeltas)
      const current: SeasonSave = afterBurst === savedBefore.state ? savedBefore : { ...savedBefore, state: afterBurst }
      const { record } = current.state
      const opponent = summary.opponentTeamId

      // 경기 끝 0x4ea0c 는 모드가 5·6(미션)이 아니면 **갈래(정규·포스트시즌·국가대항전)를 가르기 전에**
      // 기록 달성 G 합 [scene+0x17f4] 를 저장 G(+0x64)에 더하고(4ec5a, 99999 상한) 0x4ec82 `0x22c7d(합, 모드 2)` 로
      // 획득 GP 통계에 적는다. 합은 요약이 싣고 온다(fc7f196 — 30G 자동진행 뒤 타석도 기록을 쌓는다, R15 10-3)
      const earned = summary.gamePoints ?? 0
      if (earned !== 0) gainGamePoint(earned)
      recordStat?.({ kind: 'G획득', mode: SEASON_STAT_MODE, amount: earned })
      // 이어서 0x4ec8a `0x22e10` — 이번 경기 기록달성 횟수(0x1fce0, 모드 2 저장+0x8f0)를 통계 +4+n 누계에 더한다
      recordStat?.({ kind: '기록달성', recordIds: summary.recordIds ?? [] })

      // 경기 중 `0xa755c` 가 올린 평판 16칸 — 원본은 경기 장면이 SR+0x1a0 을 직접 올리므로
      // **갈래와 상관없이** 레코드에 남는다 (S4 2b·6절). 웹은 요약이 싣고 와서 여기서 꽂는다.
      //
      // 경기 끝 꼬리 4f374~4f3b2 — 갈래와 상관없이 SR+0x54(목표점 보기)·SR+0x7c(질병 쿨다운)를 하나씩 줄인다.
      // 그 뒤 장면 0x105 를 **새로 만든다**(0x3b14): 반복 이벤트(490)의 본 비트를 지우고(0x8ce94) 이벤트 관리자
      // (커서)와 새 선수 플래그(this+0xf9)도 새로 선다.
      const played: SeasonRecord = clearRepeatableSeen(tickAfterAnyGame({ ...record, gameRecord: summary.gameRecord }))
      eventCursor.current = START_SEASON_EVENT_CURSOR
      newPlayerFlag.current = false

      // 승패는 원본 셈 `0xb69c8`·`0x4f072` 로 다시 낸다 — 이긴 칸 = R(1) > R(0) ? 1 : 0 이라
      // **동점이면 선공(칸 0) 쪽이 이긴다**. 요약의 `won`(내 점수 > 상대 점수)은 동점을 패로 본다.
      // 원본 시즌 경기는 동점으로 끝나지 않는다(경기 끝 판정 0xb68fc 가 동점이면 끝을 안 낸다 — E 3d ·
      // `seasonHumanWonOf` 주석). 웹 경기도 연장 상한이 없어(`gameState`) 같다 — 비교식만 원본 모양 그대로 둔다.
      // 사람 칸은 이 경기 옵션의 `playerSide` 다 (`state[0x31 + 칸] == 0`)
      const tied = summary.ourScore === summary.opponentScore
      const won = gameOptions === null
        ? summary.won
        : seasonHumanWonOf(summary.ourScore, summary.opponentScore, gameOptions.playerSide)

      // 포스트시즌·국가대항전은 리그 전적·수입 정산도, **평가 0xa719c 도** 타지 않는다.
      // 원본 경기 끝 0x4ea0c 가 L+0xac(4f216)·L+0x34(4f268)이면 0x4f274 의 평가 호출을 건너뛴다
      // (`seasonGameIsEvaluated` 주석). 그래서 이 두 갈래에서 찬 16칸은 읽히지 않고 다음 경기 직전에 지워진다.
      const stage = { nationalCup: gameKind === '국가대항전', postseason: gameKind === '포스트시즌' }
      if (!seasonGameIsEvaluated(stage)) {
        if (stage.postseason) {
          const series = current.series ?? null
          if (series === null) return null
          const winner = won ? record.teamId : opponent
          // 4f268 → 4f29a 0xb818c(포스트시즌 갈래는 스태미나를 안 건드린다) → 4f2bc 열 팀 +20%.
          // CPU 끼리 경기 0xc2760 은 여기서 돌지 않는다 — 부르는 곳은 결산 0xef 키 0x9dc8(9eba) 하나뿐이라 정산 → 장면 0x105
          // 새로 세우기(팁 rand(0, 73)) → 0xef 진입 → 사람이 키를 눌렀을 때다(`continuePostseason`). 그때 회복이 **끝난** 이 표로
          // 서고 깎인 값이 그대로 남는다(0xc2760 의 하루 끝 0xb818c 포스트시즌 갈래는 회복이 없고, 0xb617c 는 0x4ea0c 에서만 불린다)
          const rested = withDayEndRecovery(withGameEndStamina(current, summary, ownRotationShift))
          const advanced = advancePostseason(series, winner)
          commit({
            ...rested,
            series: advanced,
            state: {
              ...current.state,
              record: { ...played, games: postseasonDayOf(advanced), postseasonChampion: advanced.champion ?? NO_CHAMPION },
            },
          })
          return { next: SEASON_SCENE_STATE.시즌결산, jingle: null }
        }
        const cup = current.cup ?? null
        if (cup === null) return null
        // 내 쪽은 시즌 팀(SR[1], 0~9)이 아니라 **경기에 들어간 대한민국(10)** 이다 — 0x6548 국가대항전
        // 가지(65e2 `cmp r5,#0xa`)가 경기[0x28+side] 에 10 을 꽂았고, 결과 장면 0x4ea0c 는 그 경기 팀으로
        // 0xb76dc/0xb77e0 을 부른다. 시즌 팀 번호를 넘기면 참가국 표(10~13)에 없어 대한민국 승패가 안 쌓이고
        // 결승을 이겨도 우승국(L+0xc4)이 15 로 남았다. 커리어 `finishCupGame` 과 같이 요약의 팀 번호를 쓴다
        const winner = won ? summary.ourTeamId : opponent
        const loser = won ? opponent : summary.ourTeamId
        // 같은 날 CPU 경기 두 나라는 사람 경기가 깎아 둔 상대국 슬롯 레코드(base+0x934)의 투수 +0x2c 에서 선다 (701a7a9) —
        // 요약의 상대 투수 끝 스태미나(표 칸 차례)가 그 값이다
        commit({
          ...current,
          cup: advanceNationalCupDay(cup, winner, loser, random, summary.opponentPitcherStaminas),
          state: { ...current.state, record: played },
        })
        return { next: SEASON_SCENE_STATE.국가대항전, jingle: null }
      }

      const afterMyGame = won
        ? recordLeagueResult(current.league, record.teamId, opponent)
        : recordLeagueResult(current.league, opponent, record.teamId)
      // 내 경기의 끝 스태미나를 되적고 → 같은 날 CPU 경기 0xc2a48 이 그 표로 치러 깎고 → 하루 끝 4f2bc 열 팀 +20%
      const afterGameStamina = withGameEndStamina(current, summary, ownRotationShift)
      const day = playLeagueDay(
        afterMyGame,
        record.games,
        record.teamId,
        random,
        // 투수 줄도 같은 정산 0xa8024 · 경기 끝 0xa7de8 이 쌓는다 — 0xa56dc 모드 2 갈래(0xa56fa)는 포스트시즌·국가대항전이면
        // 거짓이라 정규시즌 경기만이다(이 갈래가 곧 정규시즌이다). 요약 `leaguePitchers` 는 양 팀 표 칸으로 싣고 온다
        recordSeasonHumanGamePitchers(
          // 도루 +0x2c 도 같은 정산 0xa8024 가 쌓는다(도루 판 종류 5) — 같은 정규시즌 갈래
          recordLeagueStolenBases(
            recordLeaguePlateAppearances(
              current.playerStats ?? EMPTY_LEAGUE_PLAYER_STATS,
              summary.leaguePlateAppearances,
            ),
            summary.leagueStolenBases ?? [],
          ),
          summary.leaguePitchers,
        ),
        afterGameStamina.cpuPitcherStaminas,
        aceLevels,
        // 사람 경기 두 팀의 로테이션 한 칸(0x6548 670e~673e)은 여기서 리그 차례에 넣는다 — 선발은 `optionsFor` 가 미리 셈했다
        true,
        seasonAbilityContextOf(current.state),
        // 트레이드로 바뀐 CPU 팀은 시즌 저장의 레코드로 선다 (0xc239c → 0xb8680 → 0x1f570)
        (team) => cpuLeagueRecordOf(current, team),
      )
      const rested = withDayEndRecovery({ ...afterGameStamina, cpuPitcherStaminas: day.pitcherStaminas })

      // 평가가 위에서 꽂은 16칸(played.gameRecord)을 읽는다. 원본 차례는 내 경기 전적 → 평가 →
      // 나머지 네 경기 → 하루 끝이지만, 평가는 리그를 읽지 않아 웹처럼 하루를 먼저 돌려도 값이 같다.
      const evaluation = evaluateSeasonGame(played, {
        myRuns: summary.ourScore,
        opponentRuns: summary.opponentScore,
        won,
        tied,
        // 완투 두 칸이 이제 실제로 채워진다 — 인기도와 평판이 서로 다른 이닝 칸을 본다
        popularityCompleteGame: summary.popularityCompleteGame,
        reputationCompleteGame: summary.reputationCompleteGame,
        opponentTeamId: opponent,
      })
      const evaluated = applySeasonGameEvaluation(
        { ...current.state, record: played },
        evaluation,
      )

      commit({
        ...rested,
        league: day.league,
        playerStats: day.playerStats,
        state: {
          ...evaluated,
          record: {
            ...evaluated.record,
            games: evaluated.record.games + 1,
            // 경기를 치르면 이번 주기의 트레이닝·외출 표시를 지운다 (0x4f158)
            acted: false,
            phase: SEASON_PHASE.경기끝,
            // SR+0x1c0 — 0xc2a48 끝(c2be0)이 모드 2 · 국가대항전·포스트시즌 아님일 때만 오늘 점수표를 복사한다.
            // 이 갈래가 곧 그 조건이다(포스트시즌·국가대항전은 위에서 먼저 돌아갔다)
            dayBoard: day.board,
          },
        },
      })
      // 관중수입 창(0xe9)이 뜨면서 나는 평가 징글 36·37·38 (0xdec4/0xdede) — 창은 결과 화면 확인 뒤에 선다
      return { next: SEASON_SCENE_STATE.관중수입, jingle: seasonEvaluationJingleIdOf(evaluation.popularityChange) }
    },
    [aceLevels, commit, gainGamePoint, gameKind, gameOptions, ownRotationShift, random, recordStat],
  )

  /**
   * **정산 진입** (`TeamGameScreen.onSettlementEnter` — 경기 끝 결과 판 OK → 상태 0x19, 진입 0x4ea0c).
   * 원본 0x4ea0c 는 이 자리에서 정산을 **다** 한다 — 기록 달성 G(4ec5a) · 갈래별 리그·평가·CPU 경기·하루 끝(4f216~4f31e) ·
   * 경기 끝 꼬리(4f374~4f3b2) 뒤 0x1fded · 0x22755(저장, 1) 파일 쓰기 → +0x4c+모드 = 0(0x4f3d6) → 0x1f1b9.
   * 그래서 결과 화면을 보는 사이에 창을 닫아도 정산은 남는다. 화면 넘김(0xe9 · 결산 · 대회)은 결과 화면 확인(`finishGame`)이다.
   */
  const enterGameSettlement = useCallback(
    (summary: TeamGameSummary) => {
      if (settledGame.current !== null) return
      settledGame.current = settleGame(summary)
    },
    [settleGame],
  )

  /**
   * 결과 화면 확인 — 정산 진입에서 정해 둔 다음 장면으로 간다. 정산 진입을 거치지 않고 왔으면(테스트 · 옛 길) 여기서 정산한다.
   */
  /**
   * **장면 0x105 의 상태 1 — 자원 적재 0x75fc**(직접 떴다, 그리기 나무 0xedb6 의 edd0 `cmp #1` → 0xee6a). 로딩 판 0x667f9 · 진행 막대
   * 0x54121(판, 7) 뒤 76cc `0x53dbd(판, [this+0xcc])` — StrTIP 첫 줄(73)로 rand(0, 73)(53dde, 경기 장면 상태 7 의 0x39f88 과 같은
   * 함수). 이어서 적재 뒤 7878 `0xbcb49([this+0x24])` 로 진입 분기 0xcb 로 간다. 곧 장면 0x105 를 세울 때마다 한 번, 그 장면의 어느
   * 굴림보다 앞이다. 웹 시즌은 로딩 판을 안 그려 값은 버린다.
   */
  const rollSceneLoadTip = useCallback(() => {
    rollSceneLoadingTip(random)
  }, [random])

  const finishGame = useCallback(
    (summary: TeamGameSummary) => {
      const settled = settledGame.current ?? settleGame(summary)
      settledGame.current = null
      setResumeGame(null)
      // 경기 장면이 끝나면 장면 0x105 를 새로 세운다(0x3874 가 지운 뒤 0x3b14) — 상태 1 의 팁 굴림이 그 장면의 맨 앞이다
      if (settled !== null) rollSceneLoadTip()
      if (settled === null) return
      setGameOptions(null)
      if (settled.jingle !== null) activeSound().play(settled.jingle)
      setScene(settled.next)
    },
    [rollSceneLoadTip, settleGame],
  )

  /** 관중수입 창에서 확인 — 정산된 레코드를 받아 경기 뒤 마무리로 간다 (0xf1) */
  const confirmIncome = useCallback(
    (record: SeasonRecord) => {
      if (save === null) return
      // 0xe9 갱신 0xdea0 끝(e114~e130)은 다음 상태(0xee/0xef/0xf1 · 사이 0xd3)를 걸고 저장만 한다 — phase(SR+0x50)는
      // 경기 끝 0x4ea0c 가 쓴 2 그대로다. 0xf1 진입 0x953c 도 안 바꾼다. 그래서 0xe9·0xf1 에서 끄고 이어하면 진입 분기 0xcb 가
      // 다시 0xe9 로 보내 평가 이벤트·구내매점 감소·트레이드 요청을 또 탄다 — 원본 그대로. phase 는 0xc9(3)·0xd8(4) 진입이 고친다
      const settled: SeasonRecord = record
      commit({ ...save, state: { ...save.state, record: settled } })
      if (settled.games >= SEASON_GAME_COUNT) {
        /*
         * 정규시즌 종료 (0xb818c → 0xb80a8): 1위면 `+0x7a` 를 늘리고 대진을 짠다.
         * 국가대항전은 여기가 아니라 **결산을 닫은 뒤**(`finishSeason` → `afterKoreanSeries`)다.
         *
         * 포스트시즌 경기는 여기서 치르지 않는다 — 원본도 **결산 화면(0xef)** 이
         * 라운드를 하나씩 진행시킨다 (내 팀 차례면 사람이 치고, 아니면 0xc2760 으로 돌린다).
         */
        const end = finishRegularSeason(save.league, settled.teamId)
        commit({
          ...save,
          // 포스트시즌 선발·벤치 차례는 정규시즌이 끝났을 때의 리그 투수 레코드 차례에서 이어 돈다 (3eb7301)
          series: startPostseason(end.ranking, save.league.pitcherOrders),
          ranking: end.ranking,
          state: {
            ...save.state,
            record: {
              ...settled,
              regularSeasonFirsts: settled.regularSeasonFirsts + (end.isRegularSeasonFirst ? 1 : 0),
              inPostseason: true,
              // SR+0xb2 = L+0x32 — 포스트시즌 시작 0xb80a8 이 0 으로 둔다(b811c). 그래서 0xe9 가 (0 ? 0xee : 0xef) 로 가고,
              // 시상 사슬 중에 끄고 이어하면 진입 분기 0xcb 가 phase 로 남은 시상을 다시 잡는다 (`postseasonDayOf`)
              games: 0,
              postseasonChampion: NO_CHAMPION,
            },
          },
        })
        // 원본 시즌 끝 사슬의 첫 칸 (0xee → 시상 셋 → 정규시즌순위 → 결산)
        return setScene(SEASON_END_CHAIN[0].state)
      }
      // 0xe9 → (0xd3 평가 이벤트) → **0xf1 경기 뒤 마무리**. 진입 0x953c: CPU 트레이드 요청 0x93c8 을 굴려
      // this+0x148 에 담고(요청 횟수 SR+0x17a 는 레코드) 배경음 4 를 반복으로 튼다 (0x6ea6d(소리, 4, −1, 1))
      // 0x93c8 은 두 팀 레코드 배열을 칸으로 뽑는다 — 로테이션으로 섞인 레코드 차례로 넘긴다
      const rolled = rollTradeRequest(
        random,
        settled,
        tradeRecordRosterOf(save, settled.teamId, save.roster),
        (team) => tradeRecordRosterOf(save, team, cpuRosterOf(save, team)),
      )
      commit({ ...save, state: { ...save.state, record: rolled.record } })
      setTradeRequest(rolled.request)
      activeSound().playBgm(SEASON_MANAGEMENT_BGM)
      setScene(SEASON_SCENE_STATE.경기뒤마무리)
    },
    [commit, random, save],
  )

  /** 0xf1 키 0x49a4 — 확인이면 포스트시즌 0xef · 경기 수 짝수 0xc9 · 홀수 0xd8 */
  const confirmDayResults = useCallback(() => {
    if (save === null) return
    const next = afterGameNext(save.state.record)
    // 홀수 경기 뒤는 관리 메뉴를 건너뛰고 곧장 0xd8 — 들어옴 0x4cb8 이 phase 를 4 로 둔다
    if (next === SEASON_SCENE_STATE.다음경기) return nextGameEntered(save, false)
    setScene(next)
  }, [nextGameEntered, save])

  const answerTradeRequest = useCallback((accept: boolean) => {
    setTradeRequestAlertOpen(false)
    if (accept) {
      // 7440~7484 — 관리 메뉴(this+0x70)·구단관리(this+0x78) 커서를 칸 1 로 (구단관리 · 트레이드)
      setMenuCursors((cursors) => ({ ...cursors, management: TRADE_REQUEST_MENU_CURSOR, teamMenu: TRADE_REQUEST_MENU_CURSOR }))
      return setScene(SEASON_SCENE_STATE.트레이드영입선수)
    }
    setTradeRequest((request) => ({ ...request, isRequested: false }))
  }, [])

  const cancelTradeRequest = useCallback(() => {
    setTradeRequest((request) => ({ ...request, isRequested: false }))
    setScene(SEASON_SCENE_STATE.구단관리)
  }, [])

  const closeTradeResult = useCallback(() => {
    setTradeRequest((request) => ({ ...request, isRequested: false }))
    setScene(SEASON_SCENE_STATE.관리메뉴)
  }, [])

  /**
   * 결산 화면(0xef)이 포스트시즌을 한 걸음 진행시킨다.
   * 내 팀이 지금 시리즈에 있으면 **사람이 친다**(원본 0xd7 선수단 → 경기),
   * 없으면 내 차례가 오거나 우승이 정해질 때까지 CPU 끼리 돌린다 (0x13da0 → 0xc2760).
   */
  const continuePostseason = useCallback(() => {
    const series = save?.series ?? null
    if (save === null || series === null) return
    const myTeam = save.state.record.teamId
    if (isMyTurn(series, myTeam)) {
      // 포스트시즌 가지 — 윗 시드(대진 칸 0)가 홈이다 (0xb7844 의 리그+0x34 가지)
      const opponent = series.teams[0] === myTeam ? series.teams[1] : series.teams[0]
      const options = optionsFor(opponent, postseasonSideOf(series, myTeam))
      if (options === null) return
      // 날짜 카운터는 시즌 경기 수가 아니라 **이 시리즈의 g**(L+0x32 — 0xb80a8 b811c 0 · 0xb7724 b777a −1 ·
      // 0xb818c b819a +1)이고, 경기 준비 0x6548 의 로테이션(670e~673e)이 g ≠ 0 이면 양 팀 레코드를 한 칸 돌린다.
      // 레코드는 영구로 섞이므로 정규시즌 끝 차례(`baseOrders`)에 앞 시리즈 이월 칸과 g 가 팀마다 얹힌다 — 그 0번을
      // 날짜 칸에 넣는다(`optionsFor` 주석과 같은 방식)
      const postseasonOptions = {
        ...options,
        dayCounter: postseasonStarterSlotOf(series, myTeam),
        opponentDayCounter: postseasonStarterSlotOf(series, opponent),
        opponentPitcherOrder: postseasonPitcherOrderOf(series, opponent),
      }
      // 0xef 키: 내 팀이 X/Y 면 this+0x11c = 1 → 0xd7 (P4 4b) — 정규시즌과 같은 경기 전 흐름이다
      return enterPreGameSquad({ kind: '포스트시즌', options: postseasonOptions })
    }
    // 0xc2760 은 CPU 팀 투수 레코드 +0x2c 를 깎기만 한다 — 회복(0xb617c)은 다음 내 경기 끝 0x4ea0c 에서다
    const cpu = runCpuPostseasonWithStamina(
      series, myTeam, random, save.cpuPitcherStaminas, aceLevels, seasonAbilityContextOf(save.state),
      (team) => cpuLeagueRecordOf(save, team),
    )
    const advanced = cpu.series
    commit({
      ...save,
      cpuPitcherStaminas: cpu.pitcherStaminas,
      series: advanced,
      state: {
        ...save.state,
        record: { ...save.state.record, games: postseasonDayOf(advanced), postseasonChampion: advanced.champion ?? NO_CHAMPION },
      },
    })
  }, [aceLevels, commit, enterPreGameSquad, optionsFor, random, save])

  /**
   * 국가대항전 한 경기 — 원본대로 **사람이 대표팀을 조작한다** (시즌 221).
   * 대진은 대회 화면이 골라 주고, 끝나면 `finishGame` 이 `advanceNationalCupDay` 로 하루를 넘긴다.
   */
  const playCupGame = useCallback(
    (myTeam: number, opponent: number) => {
      const cup = save?.cup ?? null
      if (save === null || cup === null) return
      // 국가대항전 가지 — 대진 칸 0 이 홈이다. `myTeam` 은 원본 0xb7614 가 고른 대한민국(10)이다
      const options = optionsFor(opponent, nationalCupSideOf(cup, myTeam))
      if (options === null) return
      // 내 팀도 시즌 팀이 아니라 **대한민국(10)** 이다 — 경기 준비 0x6548 의 국가대항전 가지:
      //   65c6 [sp+0x18] = 0xb7614(L,n,0) · 65da [sp+0x14] = 0xb7614(L,n,1)
      //   65e2 cmp r5,#0xa — 칸 0 이 10 이 아니면 둘을 맞바꿈 → [sp+0x18] = 내 팀 = 늘 10
      //   664c 0xb6bd4(경기, 내side, [sp+0x18]) — 경기[0x28+내side] = 10
      // 시즌모드는 대표팀 명단을 안 건드려 팀 10 기본 명단 그대로 친다 (P5 1b·2절, 0x1f9a9 호출 없음)
      //
      // 날짜 카운터도 시즌 경기 수가 아니라 **대회 날짜**다. 경기 준비 0x6548 의 로테이션
      // (670e~673e: `S+0xb2` ≠ 0 이면 양 팀에 0xb8c80 → 0xb5ca8)이 보는 `S+0xb2` = `L+0x32` 를
      // 대회 초기화 0xb7bf0 이 0 으로 놓고(b7c42) 하루 끝 0xb818c 가 1 씩 올린다 = cup.day.
      //
      // 대표팀 명단 (S6 2-2, 직접 떴다) — 대회 중 팀 얻기 0x1f570 은 팀 10 을 슬롯 base+0x918 로,
      // **나머지 팀 전부를 상대국 슬롯 base+0x934 하나로** 돌린다. 두 슬롯을 채우는 곳:
      //   b7c72 0x205c0(g, 모드)         ; 대회 초기화 — memset(+0x918, 0x1c) 뒤 마스터 팀 10 깊은 복사
      //   b7c88 0xb6190(팀10)            ; 투수 스태미나 전원 10000
      //   b7ca4 0x20648(g, 모드, b7614(L, 4, 1))  ; 첫날 상대 = 마스터 팀 복사 → +0x934
      //   b81e0 0xb818c 대회 갈래(L+0xac): L+0x32++ · L+0xad-- · 팀10 스태미나 10000 다시 ·
      //   b8216 0x20648(g, 모드, b7614(L, L+0xad, 1), 그게 10 이면 칸 0)  ; **하루마다 다음 상대를 마스터에서 새로**
      // 대한민국 명단은 저장의 `cupRoster`(+0x918, 대회 초기화에서 표로 채움)라 엔트리 편집이 대회 내내 남는다.
      // 상대국은 매일 마스터에서 새로 덮이므로 웹의 붙박이 표와 같다.
      //
      // 선발 — 로테이션 0xb5ca8 은 **팀 레코드를 제자리에서** 한 칸 당긴다(셈이 아니라 상태다):
      //   대한민국: 대회 첫날 새로 만든 슬롯이 L+0x32 ≠ 0 인 날마다 한 칸씩 → 선발 = cup.day % 4 (확정)
      //   상대국:  매일 마스터에서 새로 덮인 슬롯을 그날 한 번만 돌린다 → 선발 = day 0 이면 0번,
      //            그 뒤로는 **늘 1번** — cup.day % 4 를 따르지 않는다 (확정)
      //   → 상대 칸만 `opponentDayCounter` 로 따로 넘긴다 (0 이면 0번, 1 이면 rotationSlotOf(1) = 1번)
      //
      // 대회는 0xd7 을 안 지나고 0xf4 → 0xdd 로 바로 간다 (키 0x4a18) — 마선수도 안 넣는다(0x6548 66ae)
      enterMatchInfo(save, {
        kind: '국가대항전',
        options: {
          ...options,
          ourTeamId: myTeam,
          dayCounter: cup.day,
          opponentDayCounter: cup.day === 0 ? 0 : 1,
          opponentPitcherOrder: nationalCupOpponentPitcherOrderOf(cup.day),
        },
      }, null)
    },
    [enterMatchInfo, optionsFor, save],
  )

  /**
   * 대회 끝 — 결과 팝업을 닫으면(`0x896c`) 보상을 넣고(`0x8a56`/`0x8b10`) **곧장 새 해 `0x6e0c`** 다
   * (`0x8b88: bl 0x6e0c`, S6 1-2). 새 해의 리그 초기화가 국가대항전 플래그 `SR+0x12c` 를 함께 지운다.
   */
  const finishCup = useCallback(
    (finish: NationalCupFinish) => {
      if (save === null) return
      const record = applySeasonReward(save.state.record, finish.reward)
      // 우승(SR+0x144 == 10) 갈래 0x8acc~0x8b04 — 전역 +0x64 += 1000(0..99999) → 0x22c7d(전역, 1000, 2) 획득 GP 통계 →
      // 0x1f1e1 통계 저장. 준우승 갈래(0x8b10~)에는 없다 — 보상표의 gamePoint 가 그 차이다
      if (finish.reward.gamePoint > 0) {
        gainGamePoint(finish.reward.gamePoint)
        recordStat?.({ kind: 'G획득', mode: SEASON_STAT_MODE, amount: finish.reward.gamePoint })
      }
      const next = nextYearOf({
        ...save,
        state: { ...save.state, record: { ...record, nationalCupChampion: finish.champion } },
        cup: null,
        cupRoster: null,
      })
      commit(next.save)
      // 히든 팀은 여기서 열지 않는다 — 0xf3 갱신 0xe684 가 대진판에 있는 동안 열었다(`openCupHiddenTeams`)
      // 대회 연차(짝수 idx)는 마지막 해(9)가 아니라 엔딩 갈래에 닿지 않지만, 같은 0x6e0c 라 같게 둔다
      if (next.scene === SEASON_SCENE_STATE.엔딩) return startEvent(SEASON_FINAL_EVENT_ID, next.scene)
      setScene(next.scene)
    },
    [commit, gainGamePoint, recordStat, save, startEvent],
  )

  /**
   * 팀 트레이닝 — 0xde 연출이 끝난 틀에 굴림 `0xc074` 한 번 (`rollSeasonTraining` — 난수 차례 원본 그대로:
   * 칸 0~3 은 상승 → 감소, **지옥훈련은 감소 → 상승 넷**) → 적용 `0xa2f24` → 결과 팝업(0x741a0, 상태는 0xde 그대로).
   * 서브 아이템은 해당 칸 +2, 자동안마기는 사기 감소 −1 이다. 상승은 999 로 자른다.
   */
  const runTraining = useCallback(
    (slot: number) => {
      if (save === null) return
      const { record, teamAbilities, teamMorale } = save.state
      const myTeam = record.teamId
      const roll = rollSeasonTraining(random, slot, record)
      const applied = applySeasonTraining(teamAbilities[myTeam] ?? [], teamMorale, roll)

      commit({
        ...save,
        state: {
          ...save.state,
          teamAbilities: teamAbilities.map((row, team) => (team === myTeam ? applied.abilities : row)),
          teamMorale: applied.teamMorale,
          // SR+4 = 1 — 적용 0xa2f24 끝 a3000~a3006 (`strb #1, [SR, #4]`) 뒤 0x1fded · 0x22755 · 0x1f1b9 로 저장한다 (직접 떴다)
          record: { ...record, acted: true },
        },
      })
      // 지옥훈련이면 G −= 500 (0xa2fca 리터럴, 0..99999 로 자른다 — J 4-6).
      // 예전에는 시즌 G 칸이 늘 0 이라 이 차감이 통째로 빠져 있었다
      if (slot === HELL_TRAINING_INDEX) spendGamePoint(HELL_TRAINING_GAME_POINT)
      // 결과 팝업 — 현재값은 적용 뒤 팀 레코드를 다시 읽는다(0xc290). 닫을 때 0xc9 로 간다(`closeTrainingResult`)
      setTrainingResult(seasonTrainingResultOf(slot, record, roll, applied))
    },
    [commit, random, save, spendGamePoint],
  )

  /** 결과 팝업 키 0xf2c8 — 확인 · 취소면 0x742a9(닫기) · 상태 0xc9 */
  const closeTrainingResult = useCallback(() => {
    setTrainingResult(null)
    setScene(SEASON_SCENE_STATE.관리메뉴)
  }, [])

  /** 0x4a94 — 확인 팝업 0x16 에 "예": [gfx+0x184] = 장소 · 0xe3 (진입 0x5184 → 0x85074 연출) */
  const enterOuting = useCallback((place: number) => {
    setOutingResultText(null)
    setOutingPlace(place)
    setScene(SEASON_SCENE_STATE.외출연출)
  }, [])

  /**
   * 외출 결과 `0xc81c` (`rollSeasonOuting`) — 0xce0c 가 연출 끝(0x84e58)을 본 틀에 부른다.
   * 사기 난수는 [a, b) 이고 **친선경기(0)·야구교실(3)은 부호를 뒤집는다**(0xc8b0).
   * 서브 아이템(SR+0x5d+p)이 있으면 점프표 0xcbe6c 의 보정을 부호 뒤집기 뒤에 더한다.
   * 끝(0xcd76~0xcda2)에서 결과 팝업 0x17 을 열고 SR+4 = 1 · 저장(0x1fded · 0x22755) — 상태는 0xe3 그대로다.
   */
  const runOuting = useCallback(
    (place: number) => {
      if (save === null) return
      const { record, teamMorale } = save.state
      const outcome = rollSeasonOuting(record, teamMorale, place, random)
      if (outcome === null) return
      commit({
        ...save,
        state: { ...save.state, teamMorale: outcome.teamMorale, record: { ...outcome.record, acted: true } },
      })
      setOutingPlace(place)
      setOutingResultText(outcome.text)
    },
    [commit, random, save],
  )

  /** 0xce0c — 팝업 0x17 이 닫히면(답 0 · 0x14) SR+4 = 1 · 0xc9. SR+4 는 0xc81c 가 이미 켜 두었다 */
  const closeOutingResult = useCallback(() => {
    setOutingResultText(null)
    setOutingPlace(null)
    setScene(SEASON_SCENE_STATE.관리메뉴)
  }, [])

  /**
   * 리그 1위 G 지급 (`0x6900` → `0x87e8`). 받은 칸은 **전역 저장 +0x145 비트**라
   * 시즌을 새로 시작해도 남는다 — 그래서 시즌 저장이 아니라 따로 둔다.
   */
  const awardLeagueFirst = useCallback(
    (award: LeagueFirstAward) => {
      // 0x6a56~0x6a94: G += 금액(99999 상한) → 비트 k 켜기 0x9f709 → 저장 0x1f1b9 — 팝업을 띄우는 그 자리에서 다 한다.
      // 같은 바이트의 k 3~7 은 메인 메뉴 전부 수집 보상(0x292f8)이 켠다 — 저장된 비트를 합친 뒤 켜야 그 비트를 안 지운다
      setRewardRecord((record) => withAwardedBit(withStoredAwardedBits(record, rewardStore?.load()), award.bit))
      gainGamePoint(award.gamePoint)
      // 0x6a98~0x6abc: 이어서 0x22dd5(mgr, k = 0·1·2) — 통계 [mgr+0xc8] +0x106+k 달성 표시 → 통계 저장 0x1f1e1
      recordStat?.({ kind: '달성표시', index: award.bit })
    },
    [gainGamePoint, recordStat, rewardStore],
  )

  /**
   * 결산을 닫았다 (`0x87b4`) — 연차 idx 가 **짝수**면 국가대항전, 홀수면 곧장 새 해 `0x6e0c`(`nextYearOf`)다.
   * 새 해는 머리에서 먼저 **10년차 엔딩 판정 `0xa3084`** 를 본다 (P4 1c).
   * 예전에는 이 머리 분기가 통째로 빠져 있어 **10년차 엔딩에 영영 닿지 못했다**.
   *
   * ⚠️ 안 옮긴 것 — `저장+0xa0+e = 1`(본 엔딩 종류 표시)는 **전역 저장** 칸이라 웹에 자리가 없다.
   * 이벤트 500("시즌모드 10년은 모두 종료") 재생(0xd3)도 시즌 이벤트 흐름이 아직 없어 건너뛰고
   * 곧장 0xf5 로 간다 — **근사다**.
   */
  const finishSeason = useCallback((reward?: SeasonReward | null) => {
    if (save === null) return
    // 0x85ec 꼬리표 9·10 — 보상 팝업이 닫힐 때 인기도·평판·소지금을 더하고(저장 없음) 곧장 0x87b4 (0x86dc~ · 0x8752~)
    const rewarded = reward === undefined || reward === null
      ? save
      : { ...save, state: { ...save.state, record: applySeasonReward(save.state.record, reward) } }
    const { record } = rewarded.state
    if (isSeasonNationalCupYear(record.yearIndex)) {
      commit({
        ...rewarded,
        state: { ...rewarded.state, record: { ...record, nationalCup: true } },
        cup: createNationalCup(),
        // b7c72 0x205c0 — 대표팀 슬롯 +0x918 을 마스터 팀 10 으로 새로 채운다
        cupRoster: tableRosterOf(KOREA_TEAM_ID),
      })
      // 0xf2 진입 0xe5f8: SR+0x12c = 1 · 461 을 틀고 · 대회 초기화 · 저장 · [다음 0xf3] (e600~e64c)
      return startEvent(NATIONAL_CUP_INTRO_EVENT_ID, SEASON_SCENE_STATE.국가대항전)
    }
    const next = nextYearOf(rewarded)
    commit(next.save)
    // 엔딩 갈래는 500 을 틀고 [다음 0xf5] (6e54~6e76)
    if (next.scene === SEASON_SCENE_STATE.엔딩) return startEvent(SEASON_FINAL_EVENT_ID, next.scene)
    setScene(next.scene)
  }, [commit, save, startEvent])

  /**
   * 이벤트 재생 0xd3 이 끝났다 (실행기 0x8cf64 의 끝 → 이전 상태 `this+0x24`).
   *
   * - **본 비트**: 실행기가 마지막 명령에 닿으면 그 이벤트를 본 것으로 켜고 저장한다(8cf92~8cfc2). 선택지로 건너간
   *   이벤트도 각각 켜진다. 연초 목표 내장 이벤트는 켜지 않는다(mgr+0xa ≠ 0).
   * - **목표 창**(SYS sub 1)이 닫히면 `0x7fe90` 이 SR+0x187 = 1 · 저장 (8d928~8d942).
   * - **보상**(명령 7)은 모드 2 갈래로 (`applySeasonEventRewards`) — 393~396 은 연차 보정이 붙는다.
   * - **이어지는 이벤트**: 392 는 끝에서 `0xa37bc` 로 달성 수를 세어 393~396 을 번호로 튼다(8d0d2~8d12c).
   * - 선택지로 다른 이벤트를 번호로 불렀으면 커서 +0x2c 가 마지막으로 부른 레코드 다음을 가리킨다.
   *
   * 재생 화면은 보상을 명령마다 그 자리에서 준다(`giveSeasonEventReward`, 알림 글 0x8beb8 와 함께) — 그때 여기 오는 `rewards` 는 비어 있다.
   * ⚠️ 안 옮긴 것: 이벤트 배경음 40(0x5110 — 웹 배경음은 장면 단위다).
   */
  const finishSeasonEvent = useCallback(
    (rewards: readonly SeasonEventReward[], viewedEventIds: readonly number[], endingEventId: number | null = null) => {
      const playback = eventPlayback
      if (save === null || playback === null) return
      // 첫 종류 21(s_event 500)로 끝났으면 그 이벤트만 본 표시를 안 한다 — 0x8d4ce 는 0x8cf8c 를 안 지나고, 0xd3 끝 0x78f0 의
      // 0x8b0e4 가 떠나온 이벤트 줄만 켠다. [0x1552adc] 는 0xe9ac(ec04)가 지우기만 한다 — 엔딩 0xf5 는 500 을 튼 쪽이 줄에 넣었다
      const fileEvents = viewedEventIds.filter((id) => id !== YEAR_GOAL_EVENT_ID && id !== endingEventId)
      let record = fileEvents.reduce(markEventSeen, save.state.record)
      if ([playback.eventId, ...viewedEventIds].some(opensSeasonGoalWindow)) record = { ...record, yearGoalShown: true }
      const applied = applySeasonEventRewards({ ...save.state, record }, rewards, playback.eventId, random)
      const next: SeasonSave = { ...save, state: applied.state }
      commit(next)
      if (rewards.some((reward) => reward.kind === 10)) {
        gainGamePoint(applied.gamePoint)
        // 0x8c6e4 `0x22c7d(v, 모드)` — 획득 GP 통계
        recordStat?.({ kind: 'G획득', mode: SEASON_STAT_MODE, amount: applied.gamePoint })
      }
      if (applied.event100Awarded) setEvent100Awarded(true)
      // 선택지가 번호로 부른 마지막 이벤트 다음부터 이어 훑는다 (0xae170)
      const lastCalled = viewedEventIds[viewedEventIds.length - 1]
      if (lastCalled !== undefined && lastCalled !== playback.eventId) {
        eventCursor.current = cursorAfterCalling(eventCursor.current, lastCalled)
      }
      const goalRecordOf = recordSourceNow()
      const followUp = seasonEventFollowUpOf(playback.eventId, () =>
        seasonGoalResultEventId(achievedSeasonGoalCount(
          applied.state.record.yearIndex,
          seasonGoalInputOf({
            state: applied.state,
            league: next.league,
            roster: next.roster,
            playerStats: next.playerStats ?? EMPTY_LEAGUE_PLAYER_STATS,
            series: next.series ?? null,
            ...(goalRecordOf === undefined ? {} : { recordOf: goalRecordOf }),
          }),
        )))
      // 실행기 끝 0x8d134~0x8d19c: 370 · 371 은 0x8b04c, 376 은 0x8b370 이 결과 이벤트를 고른다(시즌 갈래)
      const awardFollowUp = seasonAwardFollowUpOf(playback.eventId, next, goalRecordOf, seasonMvpKind.current)
      if (awardFollowUp !== null) return startEvent(awardFollowUp, playback.returnScene)
      if (followUp !== null) return startEvent(followUp, playback.returnScene)
      setEventPlayback(null)
      setScene(playback.returnScene)
    },
    [commit, eventPlayback, gainGamePoint, random, recordSourceNow, recordStat, save, startEvent],
  )

  /**
   * 보상 명령 하나를 그 자리에서 준다 — 0x8c460 모드 2 갈래(`applySeasonEventRewards`). 이벤트 번호는 그 명령이 든 이벤트다
   * (연차 보정 0x8d508 · 이벤트 100 의 전역 +0xbe 가 지금 이벤트를 본다). G 는 지갑으로 · 0x8c6e4 `0x22c7d(v, 모드)` 통계.
   *
   * **본 표시 · 이어하기 자리 · 저장** — 0x8c460 의 끝(0x8cbe0~0x8cd5e)은 모드 2 · 3 · 4 공용이다(직접 떴다):
   * ```
   * 8cbe0  [mgr+0xa] == 0(파일 이벤트) → 0xacf49(지금 이벤트) 본 표시
   * 8cbfa  지금 이벤트 trigger 2~6 이면 SR+4 = 1      ; s_event 는 모두 trigger 0 이라 시즌에서는 안 탄다
   * 8cc1a  0x8b0e4 — 떠나온 이벤트 줄마다 본 표시 → 0x1fded · 0x22755(저장, 1)
   *        (그 안 0x8b12c 의 [[mgr+0xb4]+0x174] == 0x70|0x71 갈래는 나리 외출 상태 번호라 시즌 상태(0xc9~)와 안 겹친다)
   * 8ccc8  시즌(0x7b999 참) — 이벤트 번호로 SR+0x50(phase)을 고친다 (`rewardResumePatchOf(…, '시즌')`)
   * 8cd44  0x1fded · 0x22755(저장, 1) · 0x1f1b9
   * ```
   * 곧 시즌 끝 사슬의 결과 이벤트(393~396 · 373 · 375 · 379 · 401~403)가 보상을 주면 phase 가 다음 단계로 넘어가 저장된다 —
   * 보상 창에서 끄고 다시 들어와도 진입 분기 0xcb 가 그 결과 이벤트를 다시 틀지 않는다(보상이 겹치지 않는다).
   * 연초 목표 내장 이벤트(번호 0, mgr+0xa ≠ 0)는 본 표시를 안 한다. 끝(`finishSeasonEvent`)에서 다시 켜도 같은 값이다.
   */
  const giveSeasonEventReward = useCallback(
    (rewards: readonly SeasonEventReward[], eventId: number, viewedEventIds: readonly number[] = [eventId]) => {
      const current = latestSave.current
      if (current === null) return
      const applied = applySeasonEventRewards(current.state, rewards, eventId, random)
      const seen = [eventId, ...viewedEventIds]
        .filter((id) => id !== YEAR_GOAL_EVENT_ID)
        .reduce(markEventSeen, applied.state.record)
      const patch = rewardResumePatchOf(eventId, '시즌')
      const record = patch === null || seen.phase === patch.resumeCode ? seen : { ...seen, phase: patch.resumeCode }
      commit({ ...current, state: { ...applied.state, record } })
      if (rewards.some((reward) => reward.kind === 10)) {
        gainGamePoint(applied.gamePoint)
        recordStat?.({ kind: 'G획득', mode: SEASON_STAT_MODE, amount: applied.gamePoint })
      }
      if (applied.event100Awarded) setEvent100Awarded(true)
    },
    [commit, gainGamePoint, random, recordStat],
  )

  const confirmSeasonEventChoice = useCallback(
    (_eventId: number, leftEventIds: readonly number[]) => {
      const current = latestSave.current
      if (current === null) return
      const record = leftEventIds.filter((id) => id !== YEAR_GOAL_EVENT_ID).reduce(markEventSeen, current.state.record)
      commit({ ...current, state: { ...current.state, record } })
    },
    [commit],
  )

  /**
   * 이벤트 system 창 답 0 — 0x7fe90(상자): 0x7b998(모드 2)이면 [[상자+0x150]+0x187] = 1, 그리고 0x22755([0x1400054], 1) 저장.
   * 이미 켜져 있어도 원본은 저장한다. 재생이 끝날 때 목표 창 이벤트를 보고 켜는 자리(`finishSeasonEvent`)는 같은 값이라 그대로 둔다.
   */
  const confirmEventSystemWindow = useCallback(() => {
    const current = latestSave.current
    if (current === null) return
    const { record } = current.state
    commit(record.yearGoalShown ? current : { ...current, state: { ...current.state, record: { ...record, yearGoalShown: true } } })
  }, [commit])

  /**
   * 구장 히든 아이템 해금 (`0x81d0` → `0x9f6cc(app, 종류, k, 1)`).
   * 원본 자리가 전역 저장이라 시즌 세이브가 아니라 세션 칸에 쌓는다 (위 `openedStadiumIds` 주석).
   * ⚠️ 안 옮긴 것 — 해금 알림 `0x62368` (StrCOMMON[139] + [141] "시즌모드에서 사용가능합니다").
   */
  const openStadiumItems = useCallback((unlockIds: readonly number[]) => {
    setOpenedStadiumIds((opened) => {
      const added = unlockIds.filter((id) => !opened.includes(id))
      return added.length === 0 ? opened : [...opened, ...added]
    })
  }, [])

  /** 0xe684 → 0x65de4 — 전역 해금표(웹 `openedHiddenIds`, 팀은 10~14 그대로)에 쓴다. 앱이 전역 기록으로 모은다 */
  const openCupHiddenTeams = useCallback((teams: readonly number[]) => {
    setOpenedHiddenIds((opened) => {
      const added = teams.filter((id) => !opened.includes(id))
      return added.length === 0 ? opened : [...opened, ...added]
    })
  }, [])

  /**
   * 엔딩 보너스 팝업 0x2b 닫힘 — 0x8bd8(직접 떴다):
   * ```
   * 8bf0  [팝업+0x248] == 0x2b && 답 [+0x21c] == 0 → 답 = −1
   * 8c0e  e = 0xa3085(SR) ; 보너스 = 0xcbc2e[e] × 1000
   * 8c34  G(+0x64) += 보너스 → 0~99999 ; 0x1f1b9 전역기록 저장
   * 8c54  SR+0x7b = 1 ; 0x1fded · 0x22755(저장, 1)
   * 8c70  0x22c7d(보너스, 2)(모드 2 G 획득 통계) ; 0x1f1e1(통계 저장)
   * ```
   */
  const receiveEndingBonus = useCallback(() => {
    if (save === null || save.state.record.endingBonusReceived) return
    const endingIndex = judgeSeasonEnding(save.state.record)
    const bonus = (ENDING_BONUS_GAME_POINTS[endingIndex ?? 0] ?? 0) * ENDING_BONUS_UNIT
    gainGamePoint(bonus)
    commit({ ...save, state: { ...save.state, record: { ...save.state.record, endingBonusReceived: true } } })
    recordStat?.({ kind: 'G획득', mode: SEASON_STAT_MODE, amount: bonus })
  }, [commit, gainGamePoint, recordStat, save])

  /**
   * 엔딩을 넘긴다 — 키 0x6b3c 의 SR+0x7b ≠ 0 갈래(6b52~6b6e)가 단계 [this+0x140] 를 1 로 올리고 화면 전환(종류 1)을 건 뒤,
   * 0x8bd8 의 8ccc~8d2c 가 팝업 없이 단계 1 이고 전환이 끝나면 **SR+0x1bc = 1** · 저장(0x1fded · 0x22755) · 0xbcb49(0xc9) ·
   * 전환(종류 2). 곧 엔딩 뒤는 메인 메뉴가 아니라 관리 메뉴 0xc9 이고, SR+0x1bc 는 이때 선다 — 그 전에 끄면 phase 6 이라
   * 다시 들어오면 0xf5 로 온다(보너스를 받았으면 SR+0x7b 가 서 있어 팝업 없이).
   * ⚠️ 근사: 웹은 두 화면 전환(1500ms)을 기다리지 않고 곧바로 넘긴다.
   */
  const finishEnding = useCallback(() => {
    if (save === null) return
    if (!save.state.record.endingSeen) {
      commit({ ...save, state: { ...save.state, record: { ...save.state.record, endingSeen: true } } })
    }
    setScene(SEASON_SCENE_STATE.관리메뉴)
  }, [commit, save])

  /**
   * 경기 화면의 이어하기 저장 (`TeamGameScreen.onHalfInningSave`) — 진행 한 판마다 +0x4e = 1 과 블록을 시즌 저장에 쓴다.
   * 첫 진행이 0xdd OK 몫(0x847e — 원본도 OK 가 두 팀·st 를 칸 0xc · 0xd 에 걸고 파일을 쓴 뒤 경기 장면으로 간다),
   * 이어하기 경기의 첫 진행은 장면 진입 0x3a426 몫, 그 뒤는 반 이닝 0x4f928(모드 2 → 칸 0xb · 0xc · 0xd → 0x22754) 몫이다.
   */
  const saveGameProgress = useCallback(
    (progress: TeamGameProgress) => {
      const current = latestSave.current
      // 정산 진입(0x4ea0c) 뒤에는 반 이닝 저장이 없다 — 늦게 온 effect 가 +0x4e 를 되세우지 않게
      if (current === null || settledGame.current !== null) return
      // 반 이닝 저장(0x4f928)은 이닝 넘김 0xb6b6c 뒤다 — 전역 경기 상태 +0x6b 가 지금 이닝이다. 경기 중 나가기(0x40140)는
      // 이 칸을 안 지우므로 나간 그 이닝이 남는다 (`liveGameState`). 이어하기 첫 진행은 블록에서 되복사한 st 의 이닝이다
      setLiveGameInningIndex(progress.game.inning - 1)
      commit({ ...current, isGameInProgress: true, gameSave: { progress, kind: gameKind, ownRotationShift } })
    },
    [commit, gameKind, ownRotationShift],
  )

  /**
   * 0x327b8 모드 2 갈래 — `+0x42(시즌 저장 있음) && +0x4e` 면 곧장 경기. 원본은 장면 0x105 를 세우지 않고 0x104 로 가서
   * 0x3f584 모드 2 갈래가 칸 0xc · 0xd 를 팀·st 로 되복사하고 0x39fdc 모드 2 갈래(0x3a3c0)가 관중·수입 0xa34b8 을 다시 돌린 뒤
   * +0x4e = 1 · 저장, 시뮬 초기화 rand(0, 2) → 인트로 → 판(`resumeTeamGame`).
   * ⚠️ 원본 그대로 이어 세울 때마다 0xa34b8(관중 수·경기 수입을 소지금에 더함)이 한 번 더 돈다 — 수입이 겹친다
   *    (`withSceneSetupIncome`, 정규시즌만).
   * 마선수 레벨은 원본이 경기 중 전역 칸에서 그때그때 읽으므로 지금 값으로 바꿔 끼운다.
   */
  const resumeSavedGame = useCallback((): boolean => {
    const current = latestSave.current
    if (current === null || current.isGameInProgress !== true) return false
    const block = current.gameSave ?? null
    const saved = block === null ? null : seasonGameProgressOf(block.progress)
    if (block === null || saved === null) {
      // ⚠️ 웹 전용: 블록을 경기로 못 읽으면 저장이 없는 것으로 보고 표시를 내린다
      commit({ ...current, isGameInProgress: false, gameSave: null })
      return false
    }
    const options: TeamGameOptions = { ...saved.options, ...(aceLevels === undefined ? {} : { aceLevels }) }
    const restored: TeamGameProgress = { ...saved, options }
    // 장면 0x104 셋업 0x39fdc 모드 2 갈래 — 정규시즌이면 관중·수입 0xa34b8 이 **다시** 돈다(원본 버그: 이어할 때마다
    // 수입이 소지금에 겹친다). 곧이어 +0x4e = 1 · 파일 쓰기(0x3a426 · 0x22755)
    const withIncome = withSceneSetupIncome(current, saved.options.opponentTeamId)
    if (withIncome !== current) commit(withIncome)
    setGameKind(block.kind)
    setOwnRotationShift(block.ownRotationShift)
    setPendingGame(null)
    setEntryEdit(null)
    setIsMatchSettingsOpen(false)
    setGameOptions(options)
    setResumeGame(restored)
    setScene(SEASON_SCENE_STATE.경기직전)
    return true
  }, [aceLevels, commit])

  /** 경기 중 "나가기" — 장면만 내린다(+0x4e · 블록은 그대로). 다음 진입이 `resumeSavedGame` 으로 다시 세운다 */
  const leaveGame = useCallback(() => {
    setGameOptions(null)
    setResumeGame(null)
    setScene(SEASON_SCENE_STATE.관리메뉴)
  }, [])

  const goto = useCallback((next: SeasonSceneState) => {
    // 구단관리 칸 3 코치채용 → this+0x11c = 2, 0xd7 (키 0x4e40)
    if (next === SEASON_SCENE_STATE.선수단) setSquadPurpose(SQUAD_PURPOSE.코치채용)
    setScene(next)
  }, [])
  const clearNotice = useCallback(() => setNotice(''), [])
  const quit = useCallback(() => setScene(SEASON_SCENE_STATE.팀고르기), [])

  return {
    state: save?.state ?? null,
    scene,
    league: save?.league ?? EMPTY_LEAGUE,
    roster: save?.roster ?? EMPTY_ROSTER,
    cpuRosterOf: (teamId: number) => cpuRosterOf(save, teamId),
    recordSource: recordSourceNow,
    tradeRoster: save === null ? EMPTY_ROSTER : tradeRecordRosterOf(save, save.state.record.teamId, save.roster),
    tradeRosterOf: (teamId: number) =>
      save === null ? cpuRosterOf(save, teamId) : tradeRecordRosterOf(save, teamId, cpuRosterOf(save, teamId)),
    playerStats: save?.playerStats ?? EMPTY_LEAGUE_PLAYER_STATS,
    series: save?.series ?? null,
    ranking: save?.ranking ?? [],
    gameOptions,
    squadPurpose,
    preGameAces,
    pendingGame,
    isMatchSettingsOpen,
    matchSettings: (save ?? carriedGlobals.current)?.matchSettings ?? SEASON_DEFAULT_MATCH_SETTINGS,
    entryEdit,
    matchInfoStarterName,
    matchInfoOpponentStarterName,
    gameKind,
    isGameInProgress: save?.isGameInProgress === true,
    resumeGame,
    leagueFirstAwardedBits,
    // 지갑이 주인이다 (`?무한G` 도 지갑 안에서 갈린다) — 위 `gamePoints` 주석 참고
    gamePoints,
    isNextGameFromMenu: nextGameFromMenu,
    openedStadiumIds,
    openedHiddenIds,
    summaryEntry,
    cup: save?.cup ?? null,
    eventPlayback,
    tradeRequest,
    trainingResult,
    outingPlace,
    outingResultText,
    awardWindowTextOf: (sub: number) =>
      save === null || eventPlayback === null
        ? null
        : seasonAwardWindowTextOf(eventPlayback.eventId, sub, save, recordSourceNow(), seasonMvpKind.current),
    isTradeRequestAlertOpen,
    menuCursors,
    notice,
    actions: {
      chooseTeam, goto, updateRecord, updateRoster, removeHallOfFamer, removeCareerPlayer, resetSeason, finishTrade, equipSeasonPlayer,
      buySeasonSubItem, buySeasonGpItem, recoverSeasonPitcherStamina,
      playNextGame,
      openNextGame, confirmNextGame, cancelNextGame, confirmIncome, confirmDayResults,
      answerTradeRequest, cancelTradeRequest, closeTradeResult, moveMenuCursor,
      choosePreGameAce: choosePreGameAceAction, cancelPreGameAce: cancelPreGameAceAction,
      startPendingGame, cancelMatchInfo, toggleMatchSettings, applyMatchSettings,
      openEntryEdit, pressEntryKey: pressEntryKeyAction, pointEntryCursor: pointEntryCursorAction,
      closeEntryAceLocked,
      playCupGame, finishCup, finishGame, constructScene: rollSceneLoadTip, saveGameProgress, enterGameSettlement, resumeSavedGame, leaveGame,
      continuePostseason,
      runTraining, closeTrainingResult, enterOuting, runOuting, closeOutingResult, awardLeagueFirst, spendGamePoint, finishSeason,
      openStadiumItems, openCupHiddenTeams, receiveEndingBonus, finishEnding, finishSeasonEvent, giveSeasonEventReward, confirmSeasonEventChoice, confirmEventSystemWindow, clearNotice, quit,
    },
  }
}

/**
 * 내 팀·상대 팀의 지금 순위 (0부터) — 관중 수 계산의 입력 (0xb7aa1(L, 팀, 0)). 상대는 경기 객체에 선 팀이고
 * (0xa34b8 이 0xb6bdc(st, 0/1) 중 SR[1] 이 아닌 쪽을 고른다) 넘기지 않으면 일정표의 오늘 상대다.
 */
export function seasonRanksOf(league: League, record: SeasonRecord, opponentTeamId = seasonOpponentOf(record)) {
  const ranking = rankingOf(league)
  const rankOf = (team: number) => Math.max(0, ranking.indexOf(team))
  return { myRank: rankOf(record.teamId), opponentRank: rankOf(opponentTeamId) }
}

/**
 * **경기 장면 셋업의 관중·수입** — 0x3f584 → 0x39fdc(장면, 2) 의 모드 2 갈래(0x3a3c0)가 국가대항전(L+0xac = SR+0x12c)도
 * 포스트시즌(L+0x34 = SR+0xb4)도 아니면 `0xa34b8(SR)` 을 부른다(0x3a3e4). 새 경기·이어하기 둘 다 장면을 세우므로
 * **이어할 때마다 한 번 더 돌아 수입이 겹친다**(원본 버그 그대로). 난수 없음. 순위는 경기 **앞** 리그로 본다.
 * 해당이 없으면 받은 저장을 그대로 돌려준다.
 */
function withSceneSetupIncome(current: SeasonSave, opponentTeamId: number): SeasonSave {
  const { record } = current.state
  if (record.nationalCup || record.inPostseason) return current
  return {
    ...current,
    state: {
      ...current.state,
      record: applyGameIncome(record, seasonRanksOf(current.league, record, opponentTeamId)),
    },
  }
}

/** 시즌 순위표(0x9d789)가 훑는 재료 — 리그 투수 레코드 차례와 열 팀 레코드, 선수 기록표 */
export interface SeasonLeagueRecordSource {
  readonly league: League
  readonly myTeamId: number
  /** 내 팀 레코드 (`SeasonSession.roster`) */
  readonly roster: SeasonTeamRoster
  /** CPU 팀 레코드 (`SeasonSession.cpuRosterOf`) */
  readonly cpuRosterOf: (teamId: number) => SeasonTeamRoster
  readonly playerStats: LeaguePlayerStats
  /** 영입한 명전 선수의 기록(이름) — 경기 명단과 같은 칸 (`SeasonSession.recordSource`) */
  readonly recordOf?: SeasonEntryRecordSource
}

/**
 * 시즌 명단 선수의 이번 시즌 타자 줄 — 리그 선수는 붙박이 표 자리(옮겨 왔으면 옛 팀)로, 표 밖 선수(영입한 명전·나리)는
 * 원본 id 의 표 밖 줄로 쌓였다
 */
export function seasonBatterLineOf(stats: LeaguePlayerStats, ownerTeamId: number, player: SeasonPlayer): LeagueBatterLine {
  if (player.id >= HALL_OF_FAME_FIRST_ID) return leagueRecordBatterLineOf(stats, player.id)
  return leagueBatterLineOf(stats, leagueBatterIdOf(tableTeamOf(player, ownerTeamId), player.id))
}

/** 시즌 명단 선수의 이번 시즌 투수 줄 — `seasonBatterLineOf` 와 같은 열쇠 */
export function seasonPitcherLineOf(stats: LeaguePlayerStats, ownerTeamId: number, player: SeasonPlayer): LeaguePitcherLine {
  if (player.id >= HALL_OF_FAME_FIRST_ID) return leagueRecordPitcherLineOf(stats, player.id)
  return leaguePitcherLineOf(stats, leaguePitcherIdOf(tableTeamOf(player, ownerTeamId), player.id))
}

/** 순위표 줄의 이름 — 표 밖 명전 선수는 기록 이름(rec + 1)을 명전 칸에서 찾는다(`recordOf`), 그 밖은 `playerFaceOf` */
function recordNameOf(
  source: SeasonLeagueRecordSource,
  team: number,
  player: SeasonPlayer,
  isPitcher: boolean,
  index: number,
): string {
  if (player.id >= HALL_OF_FAME_FIRST_ID && player.record === undefined) {
    const found = isPitcher ? source.recordOf?.pitcher(player) : source.recordOf?.batter(player)
    if (found !== undefined) return found.name
  }
  return playerFaceOf(team, player, isPitcher, index).name
}

/** 시상 판정의 재료 — 순위표 0x9d789 가 훑는 지금 레코드 (`seasonLeagueRecordsOf`) */
function seasonAwardSourceOf(save: SeasonSave, recordOf: SeasonEntryRecordSource | undefined): SeasonLeagueRecordSource {
  return {
    league: save.league,
    myTeamId: save.state.record.teamId,
    roster: save.roster,
    cpuRosterOf: (team: number) => cpuRosterOf(save, team),
    playerStats: save.playerStats ?? EMPTY_LEAGUE_PLAYER_STATS,
    ...(recordOf === undefined ? {} : { recordOf }),
  }
}

/** 0x8dad4(evt, 0xc 타자 · 0xd 투수) — 시즌은 **1위 팀 == 내 팀** 이면 그 칸이 내 것(evt+0x36c+i) */
function seasonTitlesOf(save: SeasonSave, recordOf: SeasonEntryRecordSource | undefined, isPitcher: boolean) {
  const records = seasonLeagueRecordsOf(seasonAwardSourceOf(save, recordOf), isPitcher).map((record) => ({
    ...record,
    isMine: record.teamId === save.state.record.teamId,
  }))
  return judgeTitles(records, isPitcher ? '시즌투수' : '타자')
}

/**
 * 포스트시즌 중 `SR+0xb2`(= L+0x32, 웹 `record.games`) — 그 시리즈에서 치른 경기 수다. 대진 0xb80a8 이 0(b811c), 시리즈가
 * 끝나는 승 0xb7724 가 −1(b777a), 하루 끝 0xb818c 가 +1(b819a) → 새 시리즈 첫날과 한국시리즈가 끝난 뒤는 0.
 * 진입 분기 0xcb(≠ 0 이면 0xef) · 0xe9(0 ? 0xee : 0xef) · 6850 첫날 스태미나 · 메시지줄(0 이면 45)이 이 값을 본다.
 */
function postseasonDayOf(series: PostseasonSeries): number {
  return series.round === '종료' ? 0 : postseasonGameOf(series)
}

/**
 * 0x8dd60 8dd9a~8ddf0 — 표 0xd4f34(일곱 칸)에서 `rand(0, 7)` 로 종류를 고르고 순위표 0x9d789(…, 종류, 2, 1)를 세워
 * 칸 수 0x9da19 가 0 이면(그 종류 1위가 없으면) **다시 굴린다**(8ddc8 고리). 빈 순위표마다 rand 한 번이 더 든다.
 * ⚠️ 원본은 일곱 종류가 모두 비면 끝없이 돈다 — 웹은 그때만 첫 굴림 하나로 멈춘다(정규시즌을 치른 리그에선 닿지 않는다).
 */
function rollSeasonMvpKind(
  save: SeasonSave,
  recordOf: SeasonEntryRecordSource | undefined,
  random: RandomPort,
): LeaderKind | null {
  const source = seasonAwardSourceOf(save, recordOf)
  const hasLeader = (kind: LeaderKind) => leaderOf(seasonLeagueRecordsOf(source, isPitcherLeaderKind(kind)), kind) !== null
  const anyLeader = SEASON_MVP_LEADER_KINDS.some(hasLeader)
  for (;;) {
    const kind = SEASON_MVP_LEADER_KINDS[random.rand(0, SEASON_MVP_LEADER_KINDS.length)] ?? null
    if (kind === null || !anyLeader || hasLeader(kind)) return kind
  }
}

/** 0x8dd60 — 고른 종류의 1위가 MVP 칸(evt+0x370 팀 · +0x374 이름), 그 팀이 내 팀이면 +0x388 */
function seasonMvpOf(save: SeasonSave, recordOf: SeasonEntryRecordSource | undefined, kind: LeaderKind | null) {
  const leader = kind === null
    ? null
    : leaderOf(seasonLeagueRecordsOf(seasonAwardSourceOf(save, recordOf), isPitcherLeaderKind(kind)), kind)
  return {
    winner: leader === null ? { teamId: NO_TEAM, name: '' } : { teamId: leader.record.teamId, name: leader.record.name },
    isMine: leader !== null && leader.record.teamId === save.state.record.teamId,
  }
}

/**
 * 시상 이벤트가 끝난 뒤 결과 이벤트 — 0x8b04c(시즌 갈래): 타자(evt+0x308 == 0xc)는 칸 0~2, 투수는 칸 0~3 중 내 칸이 있으면
 * 373 · 375, 없으면 372 · 374. 0x8b370(시즌 갈래): evt+0x388 이면 379, 아니면 378. 그 밖 이벤트면 null.
 */
function seasonAwardFollowUpOf(
  eventId: number,
  save: SeasonSave,
  recordOf: SeasonEntryRecordSource | undefined,
  mvpKind: LeaderKind | null,
): number | null {
  if (eventId === SEASON_AWARD_INTRO_EVENT_ID.타자 || eventId === SEASON_AWARD_INTRO_EVENT_ID.투수) {
    const isPitcher = eventId === SEASON_AWARD_INTRO_EVENT_ID.투수
    const hasMine = seasonTitlesOf(save, recordOf, isPitcher).some((slot) => slot.isMine)
    return seasonTitleResultEventId(isPitcher ? '투수' : '타자', hasMine)
  }
  if (eventId === SEASON_AWARD_INTRO_EVENT_ID.MVP) return seasonMvpResultEventId(seasonMvpOf(save, recordOf, mvpKind).isMine)
  return null
}

/**
 * 시상 발표 창 글 — 370 · 371 의 system 3 은 0x8b3bc(문구 표 0xd4e30 — 시즌 투수는 넷째 칸 82 세이브왕까지),
 * 376 의 system 4 는 0x8b23c. 시즌(0x7b999 참)은 MVP 창에 축하 줄 StrUSER_EVT[84] 를 안 붙인다.
 */
function seasonAwardWindowTextOf(
  eventId: number,
  sub: number,
  save: SeasonSave,
  recordOf: SeasonEntryRecordSource | undefined,
  mvpKind: LeaderKind | null,
): string | null {
  if (sub === SYSTEM_TITLE_WINDOW
    && (eventId === SEASON_AWARD_INTRO_EVENT_ID.타자 || eventId === SEASON_AWARD_INTRO_EVENT_ID.투수)) {
    const titles = seasonTitlesOf(save, recordOf, eventId === SEASON_AWARD_INTRO_EVENT_ID.투수)
    return titleWindowTextOf({ titles, wonCount: 0, isMostValuablePlayer: false, mostValuablePlayer: { teamId: NO_TEAM, name: '' } })
  }
  if (sub === SYSTEM_MVP_WINDOW && eventId === SEASON_AWARD_INTRO_EVENT_ID.MVP) {
    const { winner } = seasonMvpOf(save, recordOf, mvpKind)
    return mvpWindowTextOf({ titles: [], wonCount: 0, isMostValuablePlayer: false, mostValuablePlayer: winner })
  }
  return null
}

/**
 * **시즌 순위표가 훑을 레코드 줄들** — 0x9d789 (직접 떴다): 팀 `k = 0..9` 마다 `0x1f9a9(저장, 모드, k)` 의 팀 레코드를 얻어
 * 종류 > 7 이면 타자 배열(0xb53d1, 수 +0x10) · 아니면 투수 배열(0xb51fd, 수 +0xc)을 **레코드 차례대로** 훑고,
 * +0x20 ≤ 0 이거나 마선수(0xb633d)인 줄을 뺀 뒤 순위에 넣는다. 그래서
 * - 트레이드로 옮겨 간 선수는 **지금 팀**의 줄로, 그 팀 레코드 칸 차례에 나온다 — 성적은 레코드를 따라온 값(표 자리 열쇠).
 * - 투수 배열은 로테이션(0xb5ca8)으로 섞인 레코드 차례다(`League.pitcherOrders` — 동점일 때만 갈린다).
 * 웹 `leagueRecordsOf`(entities/awards)는 붙박이 표를 훑어 옮겨 간 선수가 옛 팀 줄로 나왔다 — 시즌모드는 이것을 쓴다.
 * 이름은 엔트리 편집과 같은 `playerFaceOf`(레코드 id 로 0xaa458 표 · 표 밖이면 기록 이름).
 */
export function seasonLeagueRecordsOf(source: SeasonLeagueRecordSource, isPitcher: boolean): readonly LeagueRecord[] {
  const records: LeagueRecord[] = []
  for (let team = 0; team < LEAGUE_TEAM_COUNT; team += 1) {
    const roster = team === source.myTeamId ? source.roster : source.cpuRosterOf(team)
    if (!isPitcher) {
      roster.batters.forEach((player, index) => {
        const line = seasonBatterLineOf(source.playerStats, team, player)
        records.push({
          ...EMPTY_LEAGUE_RECORD,
          teamId: team,
          name: recordNameOf(source, team, player, false, index),
          atBatsOrOuts: line.atBats,
          hits: line.hits,
          homeRuns: line.homeRuns,
          runsBattedIn: line.runsBattedIn,
          // +0x2c 도루 — 순위 종류 10 (0x9d789). 옛 저장은 칸이 없어 0
          batterExtra: line.steals ?? 0,
        })
      })
      continue
    }
    const order = pitcherOrderOf(source.league, team)
    const indexes = roster.pitchers.length === order.length ? order : roster.pitchers.map((_player, index) => index)
    for (const index of indexes) {
      const player = roster.pitchers[index]
      if (player === undefined) continue
      const line = seasonPitcherLineOf(source.playerStats, team, player)
      records.push({
        ...EMPTY_LEAGUE_RECORD,
        teamId: team,
        name: recordNameOf(source, team, player, true, index),
        atBatsOrOuts: line.outs,
        hits: line.runsAllowed,
        saves: line.saves,
        strikeouts: line.strikeouts,
        earnedRuns: line.runsAllowed,
        wins: line.wins,
        losses: line.losses,
      })
    }
  }
  return records
}

/** 순위표 종류가 투수 배열을 훑는가 — 0x9d789 `cmp 종류, #7 ; ble` (9d83e · 9d85c) */
export function isPitcherLeaderKind(kind: number): boolean {
  return kind <= 7
}

/** 목표 판정의 재료가 사는 곳 — 세션 저장의 여러 칸 */
export interface SeasonGoalSource {
  readonly state: SeasonState
  readonly league: League
  readonly roster: SeasonTeamRoster
  readonly playerStats: LeaguePlayerStats
  readonly series: PostseasonSeries | null
  /** 영입한 명전 선수의 기록 — 경기 명단(`entryOrderOf`)과 같은 칸을 보려고 같은 것을 넘긴다 */
  readonly recordOf?: SeasonEntryRecordSource
}

/**
 * 시즌 목표 판정 `0xa37bc` 의 입력 다섯 칸 (P4 2b · 직접 떴다):
 * ```
 * ① 0xb7aa0(L, 팀, 0)      — 포스트시즌 중이면 대진 칸 순위(`goalRankOf`), 아니면 정규시즌 순위
 * ② 0xb7908 / (0xb7908 + 0xb7968) × 100
 * ③ 0xa3700(SR, 1)         — 팀 레코드 타자 0~8번 타율 평균
 * ④ 0xa3764(SR)            — 팀 레코드 투수 전원 방어율 평균
 * ⑤ 인기도 − SR+0x78
 * ```
 * ③④ 의 선수 줄은 리그 선수 기록표(`playerStats`)에서 **경기가 쌓을 때와 같은 열쇠**로 찾는다 —
 * 타자는 저장 명단 차례를 `entryBattersOfOrder` 로 붙박이 표 칸에 맞춘 `팀 × 12 + 칸`, 투수는 `팀 × 8 + 칸`.
 *
 * ⚠️ 한계 (지어내지 않고 남긴다):
 * - 웹 팀 경기 요약(`TeamGameSummary`)이 **사람 경기의 투수 등판 줄**을 싣지 않아 내 팀 투수 줄은 늘 0 이다 —
 *   원본은 사람 경기도 0xa8024·0xa7de8 로 쌓는다. 그래서 지금은 ④ 가 0(달성)으로 나온다.
 * - 트레이드로 옮겨 온 선수는 옛 팀 표 자리(`tableTeamId` · id), 영입한 명전·나리 선수(id ≥ 0xb4 · 0xfe)는 원본 id 의
 *   표 밖 줄(`recordBatters`·`recordPitchers` — 0xa56dc 모드 2 갈래가 마선수만 거른다)로 쌓였다 — 같은 열쇠로 읽는다.
 *   기록을 못 찾은 표 밖 선수(`recordOf` 를 안 넘긴 길)는 경기가 남은 표 칸으로 세우고(`tableSlotsOfOrder`) 그 칸으로
 *   쌓는다 — 여기도 같은 칸을 읽는다 (근사).
 * - 대진 칸의 플레이오프 아랫 시드(준PO 승자)는 한국시리즈가 시작된 뒤에는 시리즈 객체에 남지 않아 모른다 —
 *   목표 판정(392)은 포스트시즌 첫날에 돌아 닿지 않는다.
 */
export function seasonGoalInputOf(source: SeasonGoalSource): SeasonGoalInput {
  const { record } = source.state
  const team = record.teamId
  const ranking = rankingOf(source.league)
  const regularRank = Math.max(0, ranking.indexOf(team))
  const order = seasonEntryOrderOf(source.roster, source.recordOf)
  // 기록을 실은 칸(영입한 명전·나리 선수)은 그 레코드에 쌓인 표 밖 줄(원본 id)로 센다 — 기록을 못 찾은 칸은 빈 줄
  const batterLines = entryBattersOfOrder(team, order).map((batter) => {
    if (batter.rosterSlot === NO_ROSTER_SLOT) {
      return batter.recordId === undefined
        ? EMPTY_LEAGUE_BATTER_LINE
        : leagueRecordBatterLineOf(source.playerStats, batter.recordId)
    }
    // 트레이드로 옮겨 온 선수는 옛 팀 표 자리(원본 id)로 쌓였다 — 같은 열쇠로 읽는다
    return leagueBatterLineOf(source.playerStats, leagueBatterIdOf(batter.tableTeamId ?? team, batter.rosterSlot))
  })
  const pitcherLines = order.pitchers.map((slot) => {
    if (typeof slot === 'number') {
      return slot >= 0 ? leaguePitcherLineOf(source.playerStats, leaguePitcherIdOf(team, slot)) : { outs: 0, runsAllowed: 0 }
    }
    if ('tableSlot' in slot) return leaguePitcherLineOf(source.playerStats, leaguePitcherIdOf(slot.tableTeamId, slot.tableSlot))
    return slot.recordId === undefined
      ? { outs: 0, runsAllowed: 0 }
      : leagueRecordPitcherLineOf(source.playerStats, slot.recordId)
  })
  return {
    rank: goalRankOf(team, regularRank, record.inPostseason ? goalBracketOf(source.series) : null),
    wins: source.league.wins[team] ?? 0,
    losses: source.league.losses[team] ?? 0,
    teamBattingAverage: teamBattingAverageOf(batterLines),
    teamEarnedRunAverage: teamEarnedRunAverageOf(pitcherLines),
    popularityGain: record.popularity - record.popularityAtSeasonStart,
  }
}

/**
 * 올해의 목표 창(SYS sub 1) 시즌모드 갈래의 숫자 — ②~⑤ 는 판정 입력(`seasonGoalInputOf`)과 같고 ① 만 정규시즌 순위다
 * (`seasonGoalWindowRankOf` — 0xb7aa0 셋째 인자 1).
 */
export function seasonGoalWindowNumbersFor(source: SeasonGoalSource): SeasonGoalWindowNumbers {
  const { record } = source.state
  const regularRank = Math.max(0, rankingOf(source.league).indexOf(record.teamId))
  return seasonGoalWindowNumbersOf(
    record.yearIndex,
    seasonGoalInputOf(source),
    seasonGoalWindowRankOf(regularRank, record.games, record.inPostseason),
  )
}

/**
 * 웹 시리즈 객체 → 원본 대진 칸 `L+0x38 + 2i` (0xb80a8: 1위·미정 · 2위·미정 · 3위·4위, 이긴 팀은 다음 라운드 칸 1).
 * 시리즈가 없으면 대진 칸이 빈 것과 같다.
 */
function goalBracketOf(series: PostseasonSeries | null): GoalPostseasonBracket {
  if (series === null) return { champion: null, pairs: [] }
  const [first, second, third, fourth] = series.qualifiers
  const inKoreanSeries = series.round === '한국시리즈' || series.round === '종료'
  const playoffLower = series.round === '플레이오프'
    ? series.teams[1]
    // 한국시리즈 아랫 시드(플레이오프 승자)가 2위가 아니면 그 팀이 곧 준PO 승자다. 2위면 모른다 — 위 주석
    : inKoreanSeries && series.teams[1] !== second ? series.teams[1] : null
  return {
    champion: series.champion,
    pairs: [
      [first ?? null, inKoreanSeries ? series.teams[1] : null],
      [second ?? null, playoffLower],
      [third ?? null, fourth ?? null],
    ],
  }
}
