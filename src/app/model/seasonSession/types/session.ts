import type { SeasonState } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonSceneState, SeasonMenuCursors } from '@/entities/season-mode/model/seasonStateMachine'
import type { League, PostseasonSeries } from '@/entities/league/model/league'
import type { SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit'
import type { SeasonRecordAces, SeasonEntryRecordSource, SeasonEntryCellSource, SeasonEntryLists } from '@/entities/season-mode/model/seasonEntry'
import type { LeaguePlayerStats } from '@/entities/league/model/leaguePlayerStats'
import type { TeamGameOptions, TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import type { SeasonSummaryEntry } from '@/entities/season-mode/model/seasonRewards'
import type { NationalCup } from '@/entities/national-cup/model/nationalCup'
import type { SquadPurpose, PreGameAces } from '@/entities/season-mode/model/preGameFlow'
import type { MatchInfoStadiumState } from '@/widgets/batting-stage/lib/renderScenery'
import type { MatchProgressSettings } from '@/features/play-team-game/model/matchSettings'
import type { TradeRequest } from '@/entities/season-mode/model/tradeRequest'
import type { SeasonTrainingResult } from '@/widgets/season/lib/seasonTrainingResult'
import type { EntryEditorState } from '@/entities/season-mode/model/entryEditor'
import type { SeasonActions } from '@/app/model/seasonSession/types/actions'

/**
 * 시즌 모드 한 판 (원본 게임 모드 2, 장면 0x105).
 *
 * 화면(`pages/season`)은 상태를 하나도 안 들고 있고, 어느 화면 다음에 무엇이 오는지는
 * `entities/season-mode` 의 상태 기계가 전부 안다. 이 훅은 그 둘을 잇고 **저장**만 맡는다.
 *
 * 경기는 사람이 팀 경기 화면(`features/play-team-game`)에서 친다 — 경기정보 0xdd OK 가 `gameOptions` 를 세우고, 경기가 끝나면
 * 화면이 요약(`summaryOf`)을 `finishGame` 에 넘긴다. `playNextGame` 은 경기 전 화면(0xd7·0xdd)을 건너뛰고 곧장 경기 옵션을 세우는 **디버그·시험용** 지름길이다 (원본에 없는 길).
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
  /**
   * 내 팀 레코드에 남은 마선수 (`SeasonSave.recordAces`) — 0xe8(0x5870)이 레코드를 그대로 보여 8 · 9번에 남은 마선수 줄이 든다
   * (U-105 r154). 0xdf · 0xe5 진입이 지운 뒤나 없으면 undefined
   */
  readonly myRecordAces: SeasonRecordAces | undefined
  /**
   * 내 팀 투수 **레코드 칸 k → 명단 첨자** (`tradeRoster` 를 늘어세운 그 차례) — 선수영입 자리 고르기(0xdf 목적 3)가 레코드
   * 차례로 보이고 0xc554 가 레코드 칸 k 에 끼워넣으므로, 명단에 걸 때 첨자로 되돌린다
   */
  readonly pitcherRecordOrder: readonly number[]
  /** 영입한 명전 선수의 기록을 찾아 준다(기록연감 명전 칸) — 순위표 이름·경기 명단이 같은 것을 본다. 없으면 undefined */
  readonly recordSource: () => SeasonEntryRecordSource | undefined
  readonly tradeRosterOf: (teamId: number) => SeasonTeamRoster
  /**
   * 엔트리 목록 창(0x5c984) 칸 재료 — 그 팀 레코드의 시즌 줄 · 체력 (`seasonEntryCellSourceOf`). 저장이 없으면 undefined.
   * 0xdf · 0xe5 · 0xe6 · 0xe8 처럼 세션 밖 화면이 명단을 그릴 때 넘긴다
   */
  readonly entryCellSourceOf: (teamId: number) => SeasonEntryCellSource | undefined
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
   * 원본 자리는 **전역기록** `0x1f1d9 + 0xe0 + 종류×4 + (칸−4)` 다 (S3 7절 · K 5절) — 시즌 레코드가 아니라
   * 전역 저장(0x1f1b9)에 있어 시즌을 새로 시작해도 남는다. 웹은 시즌 저장에 실어 넘겨받는다(`SeasonSave.openedStadiumIds`).
   */
  readonly openedStadiumIds: readonly number[]
  /**
   * 시즌모드가 이번 세션에 연 **전역 해금표 `app+0xc0`** 칸 — 결산 0x6900 의 0x29 "오토봇 배트"와 국가대항전 히든 팀(0x65de4).
   * 앱이 곧바로 기록연감 해금 목록(`useCollection` — 저장된다)에 합치므로 새로 고친 뒤에는 그 목록이 주인이다
   * (결산 0x29 검사 · 국가대항전 화면이 둘을 합쳐 본다).
   */
  readonly openedHiddenIds: readonly number[]
  /**
   * 지금 결산 0xef 진입(`0x6900`) — 결산이 아니거나 진입 효과가 아직 안 돌았으면 null. 결산 화면은 `serial` 이 바뀔 때
   * 한 번 진입 몫(0x29 해금 알림 창 또는 리그 1위 G 하나)을 띄운다 (`SeasonSummaryEntry`).
   */
  readonly summaryEntry: SeasonSummaryEntry | null
  /** 진행 중인 국가대항전. 없으면 null (원본 L+0xa8~ 칸) */
  readonly cup: NationalCup | null
  /**
   * 상태판이 그리는 **팀 사기** — 상태판 0x7d34c 의 7d76a~7d78e 가 시즌모드면 `0x1f570(저장, SR[1])` +2 를 그때그때 읽는다.
   * 국가대항전 중(S+0x12c ≠ 0)이면 그 칸이 상대국 슬롯 base+0x934(1f5a0)라 리그 사기가 아니라 **그날 상대국 표값**이다(원본 버그) —
   * 대회 중 상태판이 서는 곳은 461 이벤트 재생 0xd3(대화창 0x8b5ac → 0x7d34c)이고, 그 칸은 그 앞 대회 초기화 b7ca4 가 마스터에서 막 베꼈다.
   */
  readonly statusBoardMorale: number
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
  /**
   * 0xdd 진입 0x6548 이 세운 무대로 0x5fd04 가 떠 둔 경기정보 바탕(`MatchInfoStadiumBackdrop`) — 홈(측 1) 팀 구장(대표팀이면
   * rand(0, 10)) · 표 0xd377c 줄 · 하늘 줄(SR+0xb2) · 두 팀 아이콘. 0xe0 에서 돌아올 때는 다시 안 뜬다. 0xdd 밖이면 null
   */
  readonly matchInfoStage: MatchInfoStadiumState | null
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
  /**
   * 0xe9(0xdea0)가 쌓은 평가 내장 이벤트 — 기록 줄(구내매점을 줄이기 전 레코드로 지은 글)과 0x8a6fc 에서 구내매점이 끝났는가.
   * 0xe9 에 들어온 틀에 만든다. 그 장면이 아니면 null
   */
  readonly incomeEvaluation: SeasonIncomeEvaluation | null
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

/** 0xe9 의 평가 내장 이벤트 재료 (`seasonGameEvaluationLineOf` · `settleGameIncome`) */
export interface SeasonIncomeEvaluation {
  readonly line: string
  readonly storeExpired: boolean
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

/** 같은 경기 화면을 쓰는 세 갈래 — 끝났을 때 정산하는 곳이 다르다 */
export type SeasonGameKind = '정규' | '포스트시즌' | '국가대항전'

/** 시즌 경기에 싣는 환경설정 세 칸 (`useSeasonSession` 의 `gameSettingsNow`) */
export type SeasonGameSettingOptions = Pick<TeamGameOptions, 'gaugeSettingOn' | 'runningModeManual' | 'throwModeManual'>
