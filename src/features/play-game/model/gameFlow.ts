import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { rollSimulatorInit } from '@/entities/game/model/simulatorInit'
import { openScenePatternDeck } from '@/entities/batting/model/battedBallOutcome'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'
import { describeOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { atBatRecordCodeOf } from '@/entities/batting/model/swingSkills'
import { specialSwingCountOf } from '@/entities/batting/model/specialSwing'
import {
  applyAtBatOutcome,
  applyOpponentInning,
  createGame,
  endSituationOf,
  isGameOverAt,
  PLAYER_BATTING_ORDER_INDEX,
  PLAYER_SIDE_LAST_BAT,
  isPlayerTurn,
  ourHalfOf,
  resultOf,
} from '@/entities/game/model/gameState'
import type { GameState, PlayerSide } from '@/entities/game/model/gameState'
import { playQuickAtBat } from '@/entities/game/model/quickAtBat'
import type { QuickAtBatBatter, QuickAtBatPitcher } from '@/entities/game/model/quickAtBat'
import {
  changePitcherIfNeeded,
  drainPitcherForPitch,
  drainQuickPitcher,
  simulateHalfInning,
  startingMoundOf,
} from '@/entities/game/model/simulateHalfInning'
import type {
  HalfInningDefense,
  HalfInningMound,
  HalfInningPitcherChange,
} from '@/entities/game/model/simulateHalfInning'
import {
  BATTERS_PER_TEAM,
  PITCHERS_PER_TEAM,
  batterAt,
  quickPitcherOf,
  startingPitcherOf,
  teamBatters,
  teamPitchers,
} from '@/entities/team/model/teamRoster'
import { FULL_STAMINA, staminaPercentOf } from '@/entities/pitcher-career/model/pitcherStamina'
import {
  lineupSlotOf,
  recordLineupPlay,
  rosterLineupOf,
  rosterSlotAt,
  tryQuickCpuPinchHit,
} from '@/entities/game/model/quickLineup'
import type { QuickLineup } from '@/entities/game/model/quickLineup'
import { runnerCountOf } from '@/entities/game/model/baseState'
import { ROTATION_SIZE, rotationSlotOf } from '@/entities/pitcher-career/model/pitcherRotation'
import { opponentOf } from '@/entities/league/model/league'
import type { GameSummary } from '@/entities/game/model/gameSummary'
import { chargeHalfInningLines, chargePitcherLine, outsAddedBetween } from '@/entities/game/model/gamePitcherLines'
import type { GamePitcherLine } from '@/entities/game/model/gamePitcherLines'
import { EMPTY_SEASON_STATS } from '@/entities/career/model/seasonStats'
import type { SeasonStats } from '@/entities/career/model/seasonStats'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { advanceRunners } from '@/entities/game/model/baseState'
import type { BaseState } from '@/entities/game/model/baseState'
import { atBatPenaltyCounts, atBatPopularityPoints, EMPTY_REPUTATION_COUNTS } from '@/entities/career/model/gameEvaluation'
import type { ReputationCounts } from '@/entities/career/model/gameEvaluation'
import {
  backToBackRecordOf,
  completeGameRecordIdsOf,
  gameEndRecordIdsOf,
  passesRecordTeamGate,
} from '@/entities/game/model/gameRecords'
import { EMPTY_BATTER_GAME_LOG, recordBatterAtBat } from '@/entities/game/model/batterGameLog'
import type { BatterGameLog } from '@/entities/game/model/batterGameLog'
import type { LeaguePlateAppearance } from '@/entities/league/model/leaguePlayerStats'
import type { AcePlayer } from '@/shared/config/original/acePlayers'
import { pitcherAbilityOf } from '@/entities/game/model/aceOpponent'
import {
  ACE_BATTER_ROSTER_SLOT,
  ACE_PITCHER_SLOT,
  gameAceBatterOf,
  gameAcePitcherOf,
  NO_GAME_ACES,
  withAceBatterLineup,
  withAcePitcherOrder,
  withAcePitcherStamina,
} from '@/features/play-game/model/gameAces'
import type { GameAcePitcher, GameAceSetup } from '@/features/play-game/model/gameAces'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'
import { battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import {
  defenseAbilitiesOf,
  isBattedBallInPlay,
  recordedOutcomeOf,
  runDefensePlay,
  withPredictedOutcome,
} from '@/features/defense-play/model/runDefensePlay'
import { isBattedBallKind } from '@/features/defense-play/model/playOutcome'
import type { DefensePlayInput, DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { homeRunPlaybackOf } from '@/features/defense-play/model/homeRunPlayback'
import { PICKOFF_RESULT, runPickoffPlay } from '@/features/defense-play/model/pickoffPlay'
import type { PickoffPlayResult } from '@/features/defense-play/model/pickoffPlay'
import { PICKOFF_PLAY_KIND } from '@/entities/defense-controls/model/pickoff'
import type { PickoffBase } from '@/entities/defense-controls/model/pickoff'
import { EMPTY_BATTER_GAME_RECORD, recordPlateAppearance } from '@/entities/batting/model/pinchHitAi'
import { fixturePatternFor } from '@/features/defense-play/model/representativePattern'
import { contactOfOutcome, registerContact, type BattedContact } from '@/entities/batting/model/battedContact'
import type { BurstResolution, BurstSession } from '@/entities/burst-mission/model/burstMissionSession'
import {
  cancelBurst,
  createBurstSession,
  resolveBurst,
  tryTriggerBurst,
} from '@/entities/burst-mission/model/burstMissionSession'
import { burstResultBitsOf } from '@/entities/burst-mission/model/burstResultBits'
import { batterRunnerSafeOfFates } from '@/features/defense-play/model/runnerFates'
import { benchClearingEffectOf, rollsIntoBenchClearing } from '@/entities/game/model/benchClearing'
import { rollBenchClearingEntry, rollBenchClearingTargets } from '@/features/play-game/model/benchClearingScene'
import { DEFAULT_PITCHER_ABILITY } from '@/entities/pitching/model/pitch'
import type { PitcherAbility } from '@/entities/pitching/model/pitch'
import { ACE_PITCHER_REPERTOIRES, ROSTER_PITCHER_REPERTOIRES } from '@/shared/config/original/pitcherRepertoires'
import { pitcherHandOf } from '@/entities/pitching/model/pitcherHand'
import { EMPTY_DECISION_STATE, gameEndDecisionOf } from '@/entities/game/model/winLossSave'
import type { DecisionState } from '@/entities/game/model/winLossSave'
import {
  decisionsAfterPitcherChange,
  decisionsAfterPlay,
  decisionsAfterRuns,
  pitcherOfRecordNamesOf,
} from '@/features/play-game/model/gameDecisions'
import type { MoundBySide, PitcherOfRecordNames } from '@/features/play-game/model/gameDecisions'
import { rollHalfInningFielders } from '@/features/play-game/model/halfInningBoard'
import { pitcherAbilitySumOf, rosterPitcherRoleOf } from '@/entities/pitching/model/pitcherChange'
import type { PitchResolution } from '@/entities/at-bat/model/atBatState'
import type { StealBase } from '@/entities/fielding/model/stealStart'
import { chainSceneConfirm, enterSceneConfirm } from '@/features/play-game/model/sceneConfirm'
import type { SceneConfirmWait } from '@/features/play-game/model/sceneConfirm'
import {
  arrivalApplicationOf,
  arrivesUnhit,
  pitchJudgementOf,
  runPitchArrivalPlay,
  startHumanSteal,
  type PitchArrivalPlay,
} from '@/features/defense-play/model/pitchArrivalPlay'

export interface GameLogEntry {
  readonly id: number
  readonly text: string
  /** 플레이어 본인의 타석인지. 화면에서 강조 표시하는 데 쓴다. */
  readonly isMine: boolean
}

export interface GameProgress {
  readonly game: GameState
  readonly ourTeamId: number
  /** 상대 팀 (원본 TEAMS 인덱스) */
  readonly opponentTeamId: number
  /** 이번 경기에 등판한 마선수. 없으면 평범한 투수다. */
  readonly aceOpponent: AcePlayer | null
  /**
   * 142 경기 준비 `0x1c46c` 가 두 팀 명부에 넣은 마선수 (`gameAces.ts`) — 마타자는 명단 9번(첫 벤치), 마투수는
   * 투수 8번 칸이다. 없으면(국가대항전 · 리그 밖 경기) 아무도 안 실렸다.
   */
  readonly aces?: GameAceSetup
  /**
   * 양 팀 선발 투수의 로스터 칸 — 경기를 세울 때 한 번만 정한다 (= `…PitcherOrder[0]`).
   * 이 화면은 나만의리그 **타자편(모드 4)** 이라 원본 경기 준비 `0x1c46c` 가 두 팀 모두
   * `0xb8c80`(→ `0xb5ca8`) 로 4인 로테이션을 한 칸 돌린다 (P1 1-1) — 무작위가 아니다.
   * 원본은 레코드를 제자리에서 섞어 0번이 선발이 되고, 웹은 그 섞인 차례를 리그가 들고 다닌다
   * (`League.pitcherOrders` — 부르는 쪽이 `startGame` 마지막 인자로 넘긴다).
   */
  readonly ourStartingPitcherIndex: number
  readonly opponentStartingPitcherIndex: number
  /**
   * 양 팀 **투수 레코드 차례** — 칸 p 에 앉은 붙박이 표 칸 (`League.pitcherOrders`). 0번이 선발이고 나머지가 벤치 차례다
   * (경기용 팀 객체 `0xb891c` 의 `team[i] = i`, 교체 0xabfcc 가 `team+0x0c` 를 이 차례로 훑는다).
   * 부르는 쪽이 안 넘기면 날짜 g 로 돈 4인 로테이션(`rotationSlotOf`, 첫 시즌 정규시즌에서만 원본과 같다)이다.
   */
  readonly ourPitcherOrder: readonly number[]
  readonly opponentPitcherOrder: readonly number[]
  /**
   * 양 팀 투수 칸(붙박이 표 칸 0~7)별 **레코드 스태미나** `+0x2c` — 벤치 투수는 이 값으로 올라오고(0xabfcc 도 견준다),
   * 내려간 투수는 그 순간 값을 여기 남긴다. 지금 마운드 값은 `…Mound.stamina` 가 든다. 원본 레코드 값은 경기 사이에
   * 이어진다 — 부르는 쪽이 리그 표를 넘기고 경기 끝 값(`summaryOf` 의 `pitcherStaminas`)을 되적는다. 안 넘기면 모두 10000.
   */
  readonly ourPitcherStaminas: readonly number[]
  readonly opponentPitcherStaminas: readonly number[]
  /**
   * 이 경기를 던진 투수 줄 (`entities/game/model/gamePitcherLines`) — 우리 팀은 반 이닝 엔진 줄 그대로, 상대 팀은
   * 내 타석·동료 타석·주자 판마다 아웃·실점·삼진을 그 순간 마운드 투수에게 쌓는다. 투구 수는 교체·경기 끝에
   * 그 마운드의 `pitches` 를 얹는다. 경기 끝 `summaryOf` 가 리그 기록 재료로 낸다.
   */
  readonly pitcherLines: readonly GamePitcherLine[]
  /**
   * 상대 팀의 지금 타순 칸 (팀 객체 `team+0x32`, 0~8) — **이닝이 바뀌어도 이어진다**.
   *
   * 타석이 끝나면 `0xaf020` 이 `team+0x293 = (team+0x32 + 1) mod 9` 로 대기값을 세우고, 다음 타석
   * 시작 `0xaebe4` 가 그 값을 `team+0x32` 에 확정한다 (`aedee`). 이 칸을 쓰는 곳은 팀 초기화
   * `0xb7c42`·경기 시작 `0x3a55a`·미션 시작 `0xaa888`/`0xaa89e`·확정 `0xaebe4` 넷뿐이라
   * **이닝 전환에서 0 으로 되돌리는 코드가 없다** (E 3b 확정).
   */
  readonly opponentOrderIndex: number
  /**
   * 양 팀 마운드 — 지금 던지는 투수 칸과 그 스태미나(`+0x2c`)·투구 수(`+0x27c`)·실점 B(`+0x280`)·
   * 이미 내려간 투수. 선발 칸(`…StartingPitcherIndex`)에서 시작해 **CPU 교체 AI(0xac428)가 바꾼다**.
   *
   * 모드 4 는 사람이 필요 없는 타석을 간이 엔진 `0xc262c` 로 넘기고, 그 루프는 타석마다 먼저
   * `0xc1ba4` 로 수비 팀 투수 교체를 본다 (P1 1-3·S5 2절). 사람 타석 시작 `0x3d954` 도 수비가 CPU
   * 면 같은 `0xac428` 을 부른다 (`0x3da3e`, Q1 4절). 투구마다 `0xa5e14` 가 스태미나를 깎는다.
   */
  readonly ourMound: HalfInningMound
  readonly opponentMound: HalfInningMound
  /**
   * 상대 투수의 **이번 이닝 실점 A(`+0x284`)** — 반 이닝 교대 `0xa5b00` 이 0 으로 되돌린다.
   * 우리 투수 쪽 A 는 상대 공격을 한 번에 도는 `simulateHalfInning` 이 안에서 센다.
   */
  readonly opponentInningRunsAllowed: number
  /**
   * 양 팀 명단(`team+0xe`)과 타순 칸별 이 경기 기록 — **CPU 대타** `0xac228` 이 보고 바꾼다.
   * 간이 엔진 `0xc1ba4` 는 공격 팀이 누구든 가림막 없이 부르므로(`0xc1c50`) 우리 동료 타석에서도
   * 대타가 나온다. 내 타석은 사람이 잡아 간이 엔진을 안 지나고(0xc2198 → 0xc1e04), 사람 타석
   * 시작 `0x3d954` 는 수비가 CPU 면 투수 교체만 본다 — 그래서 **나는 대타로 안 바뀐다**.
   */
  readonly ourLineup: QuickLineup
  readonly opponentLineup: QuickLineup
  /**
   * `state[0xe]` — 다음 공이 나가기 전까지 CPU 대타를 다시 묻지 않게 막는 칸 (양 팀 공용 한 칸).
   * "경기에 한 번" 이 아니다 — 공마다 투구 처리 `0xa5e14` 가 내린다(a5e7c, a5e72 의 state[0xd] 바로 뒤).
   * 세우는 곳은 `0xac228`(ac33e) 하나다.
   */
  readonly pinchHitUsed: boolean
  /**
   * **상태 0xe 의 OK 대기** — 내 타석 준비(0xd → 0xe)마다 새 객체다 (`sceneConfirm`). 화면(`GameScreen`)이 OK 를 받을 때까지
   * 공을 안 던진다. 0xe 확인 뒤 0xf 진입이 CPU 투수 교체를 내면 0x16 → 0xd → 0xe 로 한 번 더 기다린다(대기 2).
   * 진행기는 OK 뒤 굴림(돌발 0x8f158 · 0xac428)을 들어서는 걸음에서 미리 다 해 둔다 — 대기 동안 다른 굴림이 없어 차례는 같다.
   */
  readonly sceneConfirm?: SceneConfirmWait | null
  readonly myStats: SeasonStats
  /** 사용자 타석 인기도 점수 합 */
  readonly popularityPoints: number
  /** 사용자가 친 병살 수 · 득점권 주자를 두고 아웃된 타석 수 — 경기 후 평판 입력 */
  readonly doublePlays: number
  readonly scoringPositionOuts: number
  /** 평판 가산 칸 누계 (0xa57f8) */
  readonly reputationCounts: ReputationCounts
  /** 사용자 최근 두 타석의 기록 코드 — 스킬 16·17 조건 (0x53100) */
  readonly recentAtBatCodes: readonly number[]
  /** 이 경기에서 달성한 기록 id (한 번 달성할 때마다 하나씩, 0xa77f0) */
  readonly recordIds: readonly number[]
  /** 이어진 연타석 안타 수 */
  readonly consecutiveHits: number
  /**
   * 사람 팀(우리 팀) 연속 홈런 카운터 `ctx+0x162` — 백투백 6·7 판정(`0xa794c`)이 본다.
   * **팀 단위 한 칸**이다: 내 타석·동료 타석의 홈런이 이어서 센다. 홈런이 아닌 결과로 끝난 타석은
   * 공격 팀과 무관하게 0 으로, 상대 팀 홈런도 0 으로 되돌린다. 도루는 건드리지 않는다.
   */
  readonly homeRunStreak: number
  /**
   * 동료 타순(0~8)별 이 경기 기록. 원본은 기록을 팀 단위로 세므로 동료 타석도 G포인트가 된다
   * (0xa77f0 게이트는 공격 팀만 보고, 0xa8024 의 "본인인가" 필터는 개인 통산 성적에만 걸린다).
   */
  readonly teammateLogs: Readonly<Record<number, BatterGameLog>>
  /**
   * 리그 선수 기록표에 넘길 타석 결과 — **동료 여덟 타순과 상대 팀 타자** 것이다.
   * 원본은 사람 경기(0xae24c·0xae3e8)도 CPU 끼리 경기와 **같은 0xa8024** 를 불러 양 팀 선수
   * 레코드에 성적을 쌓는다 (B-2 확정). 내 타석은 `myStats` 가 이미 세므로 여기 넣지 않는다.
   */
  readonly leaguePlateAppearances: readonly LeaguePlateAppearance[]
  /** 우리 투수가 내준 것 — 완투 계열 기록(0xa7de8)이 보는 state+0x88·0x89·0x8a */
  readonly pitching: {
    readonly hitsAllowed: number
    readonly walksAllowed: number
    readonly outsRecorded: number
    /** 우리 투수가 잡은 삼진 수와 이어지는 연속 삼진 — 삼진 계열 기록(16~23) 판정에 쓴다 */
    readonly strikeouts: number
    readonly strikeoutCombo: number
  }
  readonly log: readonly GameLogEntry[]
  readonly nextLogId: number
  /**
   * **재생만 하면 되는** 장면. 매 틱의 `DefenseViewState` 가 들어 있어 화면은 이것만 받아 그리면 된다
   * (라우팅은 앱 쪽 몫이라 여기서 연결하지 않는다).
   *
   * 홈런 비행처럼 사람이 조작할 것이 없는 장면이 여기 들어온다. 사람이 주루를 잡는 인플레이 타구는
   * `pendingDefensePlay` 쪽으로 가고, 다 본 뒤에는 **여기 남기지 않는다** — 남기면 한 번 더 튼다.
   */
  readonly lastDefensePlay: DefensePlayResult | null
  /**
   * **지금 화면이 실시간으로 돌리고 있는 타구.** 차 있으면 이 경기는 "수비 진행 중" 이고,
   * 타석 결과(안타/아웃 코드)만 정해졌을 뿐 **진루·아웃·득점은 아직 하나도 안 먹였다**.
   *
   * 원본은 타구가 뜨면 경기 장면이 상태 0x17 로 넘어가 공이 멈출 때까지 같은 루프를 돌며
   * 매 갱신 눌린 키를 읽는다 (R10 · I 문서). 그 동안 다음 투구는 나가지 않는다 —
   * 웹도 이 칸이 차 있는 동안 다음 타석을 시작하지 않는 것으로 그 자리를 붙든다.
   *
   * 화면이 다 돌고 나면 `resolveDefensePlay` 가 그 결과를 먹이고 이 칸을 비운다.
   * 미리 다 계산해도 되는 자리(미션·테스트)는 `applyPlayerOutcome` 을 부르면 이 칸을 거쳐
   * 가되 한 번에 비워져 나온다 — 밖에서 보면 예전과 똑같다.
   */
  readonly pendingDefensePlay: DefensePlayInput | null
  /**
   * 이번 경기의 돌발미션 상태 (경기 장면이 모드 2·3·4 에서만 만드는 객체, 0x48658).
   * `burst.current` 가 차 있으면 진행 중인 돌발이 있다 — 화면은 이것만 보고 창을 띄우면 된다.
   */
  readonly burst: BurstSession | null
  /**
   * 마지막 타석이 끝나며 난 돌발 판정. 보상 변화량이 들어 있고, 화면이 결과 창을 닫은 뒤
   * 커리어에 얹는다 (`applyBurstRewards`). 판정이 안 났으면 null 이다.
   */
  readonly lastBurstResolution: BurstResolution | null
  /**
   * 환경설정 "주루" 가 **수동**인가 (설정 레코드 +0xbd, 원본 기본은 자동).
   *
   * 갈림길은 `0xae690` — 매 틱 도는 경기 장면 슬롯 2(`0x524c0`) 안 `0x5262e` 가 설정 +0xbd 를
   * 넣어 부른다: `반환 = (경기[0x31 + 공격측] == 1) || (설정+0xbd != 0)`. 그 값이 0 이면
   * `0x52660` 의 자동 진루 제어기(`0xaf8c0` = vt8 = `0xaf918`)를 **통째로 안 돌린다**.
   * 곧 **사람이 공격 중이고 설정이 수동일 때만** 자동 진루가 멎는다.
   *
   * ⚠️ 이 화면은 나만의리그 **타자편** 이라 사람이 늘 공격이다 — 설정이 그대로 먹는다.
   * ⚠️ 수동이라고 주자가 굳는 것이 아니다. 밀려 뛰는 포스 진루는 자동 제어기와 무관하게 간다.
   */
  readonly runningModeManual: boolean
  /**
   * **승·패·세 투수 칸** state+0x44/0x50/0x5c (S1). 득점마다(0xa5c34)·투수 교체마다(0xa60c0) 고친다.
   * 경기 끝 결과 판(상태 0x18, 0x4fe9c)이 이 셋을 그대로 읽어 세 줄로 그린다 (`pitchersOfRecordOf`).
   */
  readonly decisions: DecisionState
  /**
   * **벤치 클리어링 연출 중**(상태 0x1e). 사구 타석이 20/99 굴림에 걸리면 진입(0x3a5f0)의 굴림 45 번까지 쓰고
   * 여기 사구 결과를 붙든 채 멈춘다 — 밀어내기 주루·정산·다음 타석은 화면이 연출을 끝내고
   * `resolveBenchClearing` 을 부를 때 비로소 돈다 (원본도 출구 0xae24c 뒤에야 0x17 로 간다).
   */
  readonly pendingBenchClearing: { readonly outcome: AtBatOutcome } | null
  /**
   * **1회초 판**(상태 0x18 교대 가지가 OK 를 기다림) — 섰으면 그 판, 아니면 null. 화면은 첫 타석 앞에 띄운다.
   * 모드 4 에서 판이 설 수 있는 것은 이 하나뿐이다 (`withFirstInningBoard` 머리말).
   */
  readonly halfInningBoard: { readonly serial: number; readonly inning: number; readonly half: GameState['half'] } | null
  /**
   * **내 타순 칸의 필살타법 남은 횟수** — 팀 객체 `s8 team[+0x29 + 타순]` (H2 1-1·1-2).
   *
   * `UNFILLED_SPECIAL_SWING_COUNT`(−1) 는 "아직 안 채움" 이다. 타석 교대·교체 처리 `0xaebe4` 가 타석마다
   * `0xaea30(팀) < 0` 일 때만(aef34~aef3c) 채운다 — 값은 `specialSwingCountOf`(표 0xd84f0 · 스킬 23 +1,
   * aefd4~af00a)라 난수도 경기 상황도 안 보고 **선수 레코드만** 본다. 그래서 첫 내 타석 전에 채우든 화면이
   * 읽는 순간 채우든 값이 같다 — 웹은 읽는 쪽(`mySpecialSwingRemainingOf`)이 채운다.
   * 다시 −1 로 되돌리는 곳은 교체(대타 0xaede0 등)뿐인데 나는 대타로 안 바뀌므로 경기 내내 한 번만 찬다.
   * 줄이는 곳은 스윙 틱 `0x4e136` 하나다 (`spendMySpecialSwing`).
   * ⚠️ −1 로 처음 깔아 두는 자리(팀 초기화)는 찾지 못했다 — 0 으로 깔리면 필살이 아예 안 나가므로 −1 로 본다.
   */
  readonly specialSwingRemaining: number
  /**
   * **이번 투구에 출발한 주자들의 루** — state[0x14 + 루] (도루 메시지 0x583 → `0xa9bd4`).
   * 공이 나는 동안(상태 0x11) 사람 키 '3'·'2'·'1' 로 쌓이고(`startSteal`, 난수 없음), 공이 도착하면
   * (`arrivePitch`) 도루 판(종류 5)을 열거나 그냥 지워진다. 인플레이 타구면 타구 판의 리드(0x3d7b8)가 이 칸을 본다.
   */
  readonly stealingFrom: readonly StealBase[]
}

/** `team[+0x29 + 타순]` 의 "아직 안 채움" 값 — `0xaebe4` 가 음수를 보고 채운다 */
export const UNFILLED_SPECIAL_SWING_COUNT = -1

/**
 * 이 화면이 돌리는 경기는 나만의리그 **타자편** = 원본 게임 모드 4 다 (0x327b8 모드표, H-1).
 * 기록달성 판정이 모드를 보므로 상수로 둔다.
 */
const MY_LEAGUE_BATTER_MODE = 4

/**
 * 자동 진행이 끝나지 않는 상황을 막는 안전장치.
 * 한 경기에 나올 수 있는 이벤트 수를 크게 웃도는 값이면 충분하다.
 */
const MAXIMUM_AUTO_STEPS = 500

const MAXIMUM_LOG_LENGTH = 40
/** 타석 기록 링버퍼 용량 (0xa908c) — 스킬 16·17 은 이 버퍼의 **가장 오래된** 두 칸을 본다 */
const RECENT_AT_BAT_COUNT = 10

/**
 * 리그 팀 수. StrHOWTO[7] "기본 10개 팀과 히든 5팀" — 히든 5팀(국가대표 4팀·외인구단, 원본 10~14)은
 * 리그 상대가 아니다. 상대는 자기 팀을 뺀 기본 팀에서 고른다.
 */

/** 리그 경기의 양 팀 투수 차례·칸별 레코드 스태미나 (`startGame` 마지막 인자) */
export interface GamePitcherSetup {
  /** 내 팀 투수 레코드 차례 — 0번이 선발 */
  readonly ourOrder?: readonly number[]
  readonly opponentOrder?: readonly number[]
  /** 붙박이 표 칸(0~7)별 레코드 `+0x2c`. 빠진 칸은 10000 */
  readonly ourStaminas?: readonly number[]
  readonly opponentStaminas?: readonly number[]
}

/** 날짜만큼 돈 4인 로테이션 차례 (0xb5ca8 을 g 번 — 0~3 칸은 `(g + i) % 4`, 4번 뒤는 그대로). 첫 시즌 정규시즌에서만 원본과 같다 */
function rotatedRosterOrderOf(dayCounter: number): readonly number[] {
  const first = rotationSlotOf(dayCounter)
  return ALL_PITCHER_SLOTS.map((slot) => (slot < ROTATION_SIZE ? (first + slot) % ROTATION_SIZE : slot))
}

/** 칸별 스태미나 표 — 빠진 칸은 10000 */
function staminaTableOf(given: readonly number[] | undefined): readonly number[] {
  return ALL_PITCHER_SLOTS.map((slot) => given?.[slot] ?? FULL_STAMINA)
}

/**
 * 상대는 원본 일정표(0xd89cb)가 정한다 — 무작위로 고르지 않는다.
 * 부르는 쪽이 `nextOpponentOf` 로 구해서 넘긴다. 안 넘기면 일정표 첫날 상대를 쓴다.
 */
export function startGame(
  random: RandomPort,
  ourTeamId = 0,
  battingOrder = PLAYER_BATTING_ORDER_INDEX + 1,
  opponentTeamId = opponentOf(0, ourTeamId),
  // 사람이 맡는 측 — 원본 설정 레코드 +8 (0x30f44). 일반모드는 반반이지만 나만의리그 화면은
  // 늘 후공으로 돌려 왔으므로 기본값만 측 1 로 두고 박아 두지는 않는다.
  playerSide: PlayerSide = PLAYER_SIDE_LAST_BAT,
  /**
   * 리그 날짜 카운터 g (`리그+0x32` = `시즌+0xb2`, 커리어의 `gamesPlayed`) — 4인 로테이션이 본다.
   * 안 넘기면 0 = 시즌 첫 경기라 두 팀 모두 로스터 0번이 선발이다 (원본 `g == 0` 이면 안 돌린다).
   */
  dayCounter = 0,
  /**
   * 환경설정 "주루" 가 수동인가 (설정 +0xbd). 안 넘기면 자동 — 지금까지와 한 톨도 다르지 않다.
   *
   * ⚠️ **근사**: 원본은 이 칸을 매 틱 다시 읽지만(`0x5261c`), 웹은 경기를 세울 때 한 번 받아
   *    들고 다닌다. 경기 중에 설정을 바꾸는 길은 `useCareerSession` 이 이 칸을 갈아 끼워 잇는다.
   */
  runningModeManual = false,
  /**
   * 양 팀 투수 레코드 차례와 칸별 시작 스태미나 — 리그 경기(타자편 모드 4)는 리그가 들고 다니는 차례
   * (`leagueStarterSlotOf`·`postseasonPitcherOrderOf`, 경기 준비 0x1c46c 가 g ≠ 0 이면 두 팀을 0xb8c80 → 0xb5ca8 로 한 칸
   * 돌린 뒤)와 레코드 `+0x2c` 표를 넘긴다. 안 넘기면 날짜 g 의 4인 로테이션 · 10000 이다 (예전 그대로).
   */
  pitchers?: GamePitcherSetup,
  /**
   * 142 경기 준비 `0x1c46c`(1c62e~1c660)가 두 팀 명부에 넣은 마선수 — `0xb88c8` 마투수 → 투수 8번 칸,
   * `0xb8870` 마타자 → 명단 9번(첫 벤치, 옛 9번은 맨 끝). 안 넘기면 아무도 안 싣는다(예전 그대로).
   */
  aces?: GameAceSetup,
  /**
   * 내 팀 명단 — 저장의 나리 팀 레코드 타자 배열 차례(`entities/career/model/nariTeamRecord` 의 `nariQuickLineupOf`)다.
   * 경기 장면 0x39fdc 의 `0xb891c` 가 `team[0xe + i] = i` 로 레코드 차례를 그대로 타순·벤치로 세운다(벤치 수 `+0x28c` =
   * 타자 수 − 9). 142 가 넣은 마타자(`ACE_BATTER_ROSTER_SLOT`)도 이미 들어 있어 `aces.ours.batter` 로 다시 넣지 않는다.
   * 안 넘기면 붙박이 표 차례에 마타자를 넣는다(예전 그대로).
   */
  ourRecordLineup?: QuickLineup,
): GameProgress {
  const ourAces = aces?.ours ?? NO_GAME_ACES
  const opponentAces = aces?.opponent ?? NO_GAME_ACES
  const ourPitcherOrder = withAcePitcherOrder(pitchers?.ourOrder ?? rotatedRosterOrderOf(dayCounter), ourAces.pitcher)
  const opponentPitcherOrder = withAcePitcherOrder(
    pitchers?.opponentOrder ?? rotatedRosterOrderOf(dayCounter),
    opponentAces.pitcher,
  )
  // 마투수는 저장 레코드째(+0x2c = 10000) 8번 칸에 복사된다 (0xb521c)
  const ourPitcherStaminas = withAcePitcherStamina(staminaTableOf(pitchers?.ourStaminas), ourAces.pitcher)
  const opponentPitcherStaminas = withAcePitcherStamina(staminaTableOf(pitchers?.opponentStaminas), opponentAces.pitcher)
  const ourStarter = ourPitcherOrder[0] ?? 0
  const opponentStarter = opponentPitcherOrder[0] ?? 0
  const initial: GameProgress = {
    game: createGame(battingOrder - 1, playerSide),
    ourTeamId,
    opponentTeamId,
    // 정규 경기에 마선수가 무작위로 나오는 코드는 원본에 없다 — 마선수 대결은 이벤트 match 명령으로만 (누락 탐색 8차)
    aceOpponent: null,
    ...(aces === undefined ? {} : { aces }),
    // 모드 4 는 경기 준비 0x1c46c 에서 **두 팀 모두** 0xb8c80 로 4인 로테이션을 한 칸 돌린다
    // (P1 1-1 의 `else (모드 4): if g != 0: 0xb8c80(내 팀)` + 그 앞줄의 상대 팀). 무작위가 아니다.
    opponentStartingPitcherIndex: opponentStarter,
    ourStartingPitcherIndex: ourStarter,
    ourPitcherOrder,
    opponentPitcherOrder,
    ourPitcherStaminas,
    opponentPitcherStaminas,
    pitcherLines: [],
    // 경기 시작 0x3a55a 가 0 으로 세운다 — 그 뒤로는 이닝을 넘어 이어진다
    opponentOrderIndex: 0,
    // 선발이 막 올라온 마운드 — 레코드 +0x2c 그대로 선다 (부르는 쪽이 리그 표를 안 넘기면 10000)
    ourMound: startingMoundOf(ourStarter, ourPitcherStaminas[ourStarter] ?? FULL_STAMINA),
    opponentMound: startingMoundOf(opponentStarter, opponentPitcherStaminas[opponentStarter] ?? FULL_STAMINA),
    opponentInningRunsAllowed: 0,
    // 마타자는 첫 벤치 칸(9번)에 앉는다 — 타석에 서는 길은 CPU 대타(0xac228)뿐이다 (0xb8870)
    ourLineup: ourRecordLineup ?? withAceBatterLineup(rosterLineupOf(BATTERS_PER_TEAM), ourAces.batter),
    opponentLineup: withAceBatterLineup(rosterLineupOf(BATTERS_PER_TEAM), opponentAces.batter),
    pinchHitUsed: false,
    myStats: EMPTY_SEASON_STATS,
    popularityPoints: 0,
    doublePlays: 0,
    scoringPositionOuts: 0,
    reputationCounts: EMPTY_REPUTATION_COUNTS,
    recentAtBatCodes: [],
    recordIds: [],
    consecutiveHits: 0,
    homeRunStreak: 0,
    teammateLogs: {},
    leaguePlateAppearances: [],
    pitching: { hitsAllowed: 0, walksAllowed: 0, outsRecorded: 0, strikeouts: 0, strikeoutCombo: 0 },
    log: [],
    nextLogId: 1,
    lastDefensePlay: null,
    pendingDefensePlay: null,
    burst: createBurstSession(MY_LEAGUE_BATTER_MODE),
    lastBurstResolution: null,
    runningModeManual,
    // 경기 상태 초기화 0xb6814 — 셋 다 측 2(없음)
    decisions: EMPTY_DECISION_STATE,
    pendingBenchClearing: null,
    halfInningBoard: null,
    specialSwingRemaining: UNFILLED_SPECIAL_SWING_COUNT,
    stealingFrom: [],
  }
  // 상태 9 갱신 0x3f584 의 공통 꼬리 0x3fa0e — 시뮬 초기화 0xc0dac 의 rand(0, 2) 한 번 (모든 모드, 1회초 판 0x18 보다 앞)
  // 상태 7 장면 초기화 0x3e340 의 3ed76 → 0xb08e8 — 이 경기 장면의 패턴 덱을 섞는다(상태 9 의 시뮬 초기화보다 앞)
  openScenePatternDeck(random)
  rollSimulatorInit(random)
  return advanceUntilPlayerTurn(withFirstInningBoard(initial, random), random)
}

/**
 * **1회초 판** — 인트로 0xc 의 끝(0x39e3c)은 모드 1 이 아니면 늘 0x18 로 보내고, 0x18 틱 0(0x4f928)은
 * 앞 장면이 0x21 이 아니고 `0xc2198(sim, 1)` 이 거짓(다음 장면을 사람이 잡음)일 때만 판을 세운다.
 * 모드 4 의 0xc1e04 칸(점프표 0xd90c0 칸 3 = **0xc1ed6**, 디스어셈 확인):
 * ```
 * c1ed6: 0xc1d38(sim) — 모드 4: 0xae945(공격 팀) 지금 타자가 0xb6389(내 선수)인가
 *        거짓 → 1 (자동)
 *        참   → st[0x31 + st[9]] == 0(공격 팀이 사람 팀) 이면 0 (사람 장면) · 아니면 1
 * ```
 * 경기 첫 장면은 1회초(측 0 공격) 1번 타자다 → **선공이고 내가 1번 타자**면 사람 장면이라 판이 선다.
 * 그 밖의 반 이닝은 앞 장면이 늘 0x21(자동)이다 — 남의 타석은 모두 자동이고, 0x21 이 내 차례에서 멈추며
 * 오는 0x18 은 4fab6 이 자동 OK 로 넘긴다(판 없음). 내 타석으로 반 이닝이 끝나도 다음은 상대 공격(자동)이다.
 *
 * 판이 서면 틱 0 의 0x3fac4 가 전역 rand 36 개를 쓴다 — 첫 타석 준비 0x3d954(CPU 투수 교체 0xac428 · 돌발 0x8f158)보다 앞.
 */
function withFirstInningBoard(progress: GameProgress, random: RandomPort): GameProgress {
  if (!isPlayerTurn(progress.game)) return progress
  rollHalfInningFielders(random)
  return {
    ...progress,
    halfInningBoard: { serial: 1, inning: progress.game.inning, half: progress.game.half },
  }
}

/**
 * 플레이어 타석의 결과를 반영하고, 다시 플레이어 차례가 올 때까지 자동 진행한다.
 *
 * **원본은 CPU 끼리의 경기에만 간이 엔진(0xc11f0)을 쓰고 사람 경기는 수비 시뮬레이션을 돌린다.**
 * 그래서 여기서는 맞은 공(안타·아웃·홈런으로 끝난 타석)이면 `features/defense-play` 진행기에 **쏜 패턴 그대로**를
 * 넘겨 돌리고, 아웃·득점·루 상황은 물론 **기록할 결과**(안타 루타·아웃·홈런)도 판 끝 정산(0xa8024 —
 * `playOutcome`)이 낸 것으로 갈아 끼운다. 넘겨받은 결과는 타석을 끝내기 위한 임시 값이다.
 * 삼진·볼넷·사구는 수비가 개입할 것이 없어 지금까지의 길(0xc11f0 과 같은 규칙)을 그대로 쓴다.
 *
 * 패턴은 `options.pattern` 이나, `resolvePitch` 가 결과 객체에 묶어 둔 것(`contactOfOutcome`)을 쓴다.
 * ⚠️ 둘 다 없으면(시험·옛 호출 — 원본에 없는 길) 결과에 맞는 패턴을 원본 표에서 골라 쓴다 (`fixturePatternFor`).
 * `isUncatchable` 은 필살타법 성공 타구 — 야수가 포구를 건너뛴다 (0x51800, S13 6절).
 *
 * ⚠️ 사람이 주루를 조작하는 화면은 이것을 쓰지 않는다 — `startPlayerOutcome` 으로 타석 결과만
 * 먼저 정하고, 화면이 틱을 다 돌린 뒤 `resolveDefensePlay` 로 주자 처리를 먹인다.
 * 여기는 그 둘을 한 줄로 이어 붙인 **얇은 껍데기**다 (미션·테스트처럼 끼어들 사람이 없는 자리용).
 */
export function applyPlayerOutcome(
  progress: GameProgress,
  outcome: AtBatOutcome,
  random: RandomPort,
  options: PlayerOutcomeOptions = {},
): GameProgress {
  let started = startPlayerOutcome(progress, outcome, random, options)
  // 벤치 클리어링도 끼어들 사람이 없으면 100틱을 다 본 것으로 친다 — 틱 10 의 굴림 8 번까지 나간다
  if (started.pendingBenchClearing !== null) {
    return resolveBenchClearing(started, { reachedTargetTick: true }, random)
  }
  const pending = started.pendingDefensePlay
  if (pending === null) return started
  // 미리 다 돌려 버린다 — `runDefensePlay` 는 스테퍼를 끝까지 도는 얇은 껍데기다.
  // 이 갈래는 아직 아무것도 안 보여 줬으므로 돌린 결과를 그대로 재생거리로 넘긴다 (예전 그대로).
  const result = runDefensePlay(pending)
  // 판 끝 정산(0xa8024)이 낸 결과로 적는다 — 넘겨받은 결과는 타석을 끝낸 임시 값이다
  return finishPlayerOutcome({ ...started, pendingDefensePlay: null }, recordedOutcomeOf(pending, result), random, result, result)
}

export interface PlayerOutcomeOptions {
  readonly pattern?: BattedBallPattern
  readonly isUncatchable?: boolean
  /**
   * 이 타석 투구 중에 난 **연속 파울 기록**(32·33, `0xa7dbc`) — 타석 쪽 집계
   * (`features/play-at-bat/model/atBatPitchTally`)의 `foulRecordIds` 를 그대로 넘긴다.
   * 원본은 파울이 난 그 순간 `0x51408` v=7 갈래에서 지급하므로 타석 결과보다 **먼저** 얹는다 —
   * 인플레이 타구로 주자 처리가 뒤로 미뤄져도 이 기록은 이 자리에서 들어간다.
   * 사람 타석에서만 나온다(간이 엔진 동료 타석에는 파울 판정 0x51408 이 없다).
   */
  readonly foulRecordIds?: readonly number[]
  /**
   * 이 공이 도착하며 연 주자 판(`arrivePitch`). 낫아웃(종류 9 · `'batterRuns'`)이면 그 판의 advance 가 곧 이 삼진
   * 타석의 진루다. 그 밖(볼넷·사구·삼진 + 도루·폭투)은 `arrivePitch` 가 이미 주자 판으로 먹였으니
   * 재생 칸만 지킨다 — 이 타석 결과가 재생 칸을 비우면 판이 화면에 안 나온다.
   */
  readonly arrivalPlay?: PitchArrivalPlay | null
  /**
   * 이 공의 **번트 종류** 장면 +0xfdc (0 스윙 · 1~3 번트 — `BattingStage.onPitchResolved` 넷째 인자). 타구 판 시작 리드
   * (0x3d7b8)가 도루 안 한 주자에게 +3 틱을 더한다(`DefensePlayInput.buntKind`). 안 넘기면 0.
   * `useCareerSession.handlePitchResolved` 가 타석 화면의 넷째 인자를 그대로 싣는다.
   */
  readonly buntKind?: number
}

/**
 * **내 타석에서 상대 투수가 공 하나를 던졌다** — 원본은 공이 손을 떠날 때(상태 0x11 진입 0x3de10 의
 * 0x3dec6) `0xa5e14(ctx, 구질 = game+0xfc8)` 를 부른다 (P1 3-1):
 *   P+0x28·ctx+0x16c·수비팀+0x27c += 1 · state[0xd] = 0(0xa5e72) ·
 *   c = 0x66ef0(구질), 0xb62b4(현재 타자, 22) || 0xb62b4(P, 18) 이면 ×2, 0xb62b4(P, 10) 이면 −1 → 0xaeb08
 * 웹은 이 중 마운드 칸(투구 수 `+0x27c` · 스태미나 `+0x2c` · `justChanged`)만 든다 — 동료 간이 타석
 * (`drainQuickPitcher`)과 같은 칸이다. 시즌 누계 P+0x28·반 이닝 투구 수 ctx+0x16c·타석 투구 수 ctx+0x161 은
 * 타자편 진행기에 칸이 없다.
 *
 * 공마다 부른다 — 판정이 난 공(`PitchOutcomeDetail.pitchTypeNumber`)마다 한 번. 견제는 공이 아니라 안 부른다.
 * 깎은 스태미나는 다음 타석 시작의 CPU 교체(0xac428)와 동료 간이 타석이 본다. 난수는 쓰지 않는다.
 *
 * `batterIntimidates` = 타석에 선 내 선수가 타자 스킬 22 압도를 **장착**했는가.
 * 상대 투수 스킬 18·10 은 웹 로스터에 스킬 비트가 없어 늘 거짓이다 (`drainPitcherForPitch`).
 */
export function throwOpponentPitch(
  progress: GameProgress,
  pitchTypeNumber: number,
  options: { readonly batterIntimidates: boolean },
): GameProgress {
  if (progress.game.isFinished) return progress
  const mound = progress.opponentMound
  return {
    ...progress,
    opponentMound: {
      ...mound,
      stamina: drainPitcherForPitch(opponentQuickDefenseOf(progress), mound, pitchTypeNumber, options.batterIntimidates),
      pitches: mound.pitches + 1,
      justChanged: false,
    },
    // 같은 0xa5e14 가 state[0xe](CPU 대타 막음)도 내린다 (a5e7c)
    pinchHitUsed: false,
  }
}

/**
 * 타석 결과만 먼저 정한다 — **인플레이 타구면 주자 처리를 뒤로 미룬다.**
 *
 * 인플레이 타구는 진행기에 넘길 `DefensePlayInput` 만 만들어 `pendingDefensePlay` 에 얹고
 * 경기 상태는 **한 톨도 건드리지 않은 채** 돌려준다. 그 동안 다음 타석이 시작되지 않는 것이
 * 이 칸의 뜻이다 (원본 상태 0x17 이 도는 동안 투구가 안 나가는 것과 같은 자리).
 * 주자 처리·기록·돌발 판정은 화면이 다 돌고 `resolveDefensePlay` 를 부를 때 한 번에 한다.
 *
 * 삼진·볼넷·사구·홈런은 수비가 개입할 것이 없어 여기서 곧장 끝낸다 (0xc11f0 과 같은 규칙).
 * 사구는 그 앞에서 벤치 클리어링을 굴린다 (`withBenchClearing`).
 */
export function startPlayerOutcome(
  progress: GameProgress,
  outcome: AtBatOutcome,
  random: RandomPort,
  options: PlayerOutcomeOptions = {},
): GameProgress {
  if (progress.game.isFinished) return progress
  progress = withFoulRecords(progress, options.foulRecordIds)
  // 사구면 상태 0x12 끝(0x4e74c)에서 벤치 클리어링을 굴린다 — 밀어내기 주루·정산보다 앞이다
  const cleared = withBenchClearing(progress, outcome, random)
  if (cleared !== progress) {
    // 들어갔다 — 진입 0x3a5f0 이 공격 9명을 흩뿌리며 45 번 굴리고, 연출이 끝날 때까지 붙든다
    rollBenchClearingEntry(random)
    return { ...cleared, pendingBenchClearing: { outcome } }
  }
  // 페어 타구면 쏜 패턴이 따라온다 — 넘겨받았거나(`options.pattern`) 타석 결과 객체에 묶여 있다(`contactOfOutcome`)
  const pattern = options.pattern ?? contactOfOutcome(outcome)?.pattern
  if (isBattedBallKind(outcome) && pattern !== undefined) {
    return {
      ...withoutSteal(progress),
      pendingDefensePlay: withPredictedOutcome(defensePlayInputOf(progress, outcome, pattern, random, options)),
    }
  }
  if (!isBattedBallInPlay(outcome)) {
    const arrival = options.arrivalPlay ?? null
    // 낫아웃 — 폭투·포일 판의 진루(타자주자 포함)를 이 삼진 타석의 진루로 먹인다 (0x3e0d0 state[0x1a])
    if (arrival !== null && arrivalApplicationOf(arrival) === 'batterRuns') {
      return finishPlayerOutcome(withoutSteal(progress), outcome, random, arrival.result, arrival.result)
    }
    // ⚠️ 패턴 없이 들어온 홈런(시험·옛 호출)은 날아가는 그림만 따로 만든다 — 점수는 타석 쪽 규칙(전원 득점)이다
    const playback =
      homeRunPlaybackOf({ outcome, bases: progress.game.bases, pattern: options.pattern }) ?? arrival?.result ?? null
    return finishPlayerOutcome(withoutSteal(progress), outcome, random, null, playback)
  }
  // ⚠️ 패턴 없이 들어온 안타·아웃(시험·옛 호출) — 원본에 없는 길이다. 결과에 맞는 패턴을 원본 표에서 골라 판을 돌린다
  //    (`fixturePatternFor`). 실제 타석(`resolvePitch`)은 늘 패턴을 싣는다
  return {
    ...withoutSteal(progress),
    pendingDefensePlay: {
      ...defensePlayInputOf(progress, outcome, fixturePatternFor(outcome), random, options),
      outcomeIsGiven: true,
    },
  }
}

/** 파울 각 공 판의 임시 결과 칸 — 판이 파울로 닫히면 쓰지 않고, 잡히면 판 끝 정산(뜬공 아웃)이 갈아 끼운다 */
const FOUL_PLAY_OUTCOME: AtBatOutcome = { kind: '아웃', detail: '뜬공아웃' }

/**
 * **내 타석의 파울 각 공 판** — 원본은 맞은 공이면 각과 무관하게 메시지 0x11 → 0x13 → 0x17 판을 돈다(a769b8e 머리말).
 * 타석은 아직 안 끝났다: 판이 파울로 닫히면(`DefensePlayResult.foulEnded`) `resolveDefensePlay` 가 경기 상태를 그대로 두고
 * 세션이 스트라이크(0x35108 → 0xb6b58)를 올려 같은 타석 다음 공으로, 낙구 전에 잡히면 판 끝 정산(뜬공 아웃 13)이 타석을 끝낸다.
 * 이 공이 나는 동안 출발한 도루 주자도 판에 싣는다(판이 파울로 닫히면 0xa975c 가 판 앞 자리로 되돌린다).
 * 팀경기 우리 타석(`teamGameFlow.startBatterFoulPlay`)과 같은 길이다. 판을 만드는 데 난수를 쓰지 않는다.
 */
export function startPlayerFoulPlay(
  progress: GameProgress,
  contact: BattedContact,
  random: RandomPort,
  options: {
    /** state[4] — 이 공을 먹이기 전의 스트라이크 (판 끝 결과 코드 11 · 판 뒤 스트라이크가 본다) */
    readonly strikes: number
    /** 장면 +0xfdc — 번트 종류 (판 시작 리드 · 판 끝 결과 코드 11) */
    readonly buntKind?: number
  },
): GameProgress {
  if (progress.game.isFinished) return progress
  const outcome = registerContact(FOUL_PLAY_OUTCOME, contact)
  return {
    ...withoutSteal(progress),
    pendingDefensePlay: withPredictedOutcome({
      // 필살타법 성공 굴림(0x517e6)은 쏜 공의 재료(`contact.specialSwing`)로 판 시작이 필살수비 · 폴 굴림 뒤에 한다
      ...defensePlayInputOf(progress, outcome, contact.pattern, random, { buntKind: options.buntKind }),
      strikes: options.strikes,
    }),
  }
}

/**
 * 화면이 다 돌린 수비 플레이를 **그때** 경기 상태에 먹인다.
 *
 * `result.advance`(진루·아웃·득점)와 `result.voidedRuns`(3아웃으로 날아간 보류 득점)가 여기서
 * 비로소 경기 상태가 된다. 이미 눈으로 다 본 플레이라 `lastDefensePlay` 에는 넣지 않는다 —
 * 넣으면 화면이 같은 장면을 한 번 더 재생한다.
 */
export function resolveDefensePlay(
  progress: GameProgress,
  result: DefensePlayResult,
  random: RandomPort,
  options: { readonly foulRecordIds?: readonly number[] } = {},
): GameProgress {
  const pending = progress.pendingDefensePlay
  if (pending === null) return progress
  // 파울로 닫힌 판 — 판 끝 판정 B 0xae3e8 ae568 이 정산 0xa8024 를 건너뛰고 0xf(같은 타석 다음 공)로, 0x35108 이
  // 0xa975c(주자를 판 앞 자리로)를 부른다 — 경기 상태는 그대로다. 스트라이크(0xb6b58)와 연속 파울(0xa7dbc)은 타석 칸을 든 세션이 센다
  if (result.foulEnded === true) return { ...progress, pendingDefensePlay: null }
  // 이 타석에서 앞서 난 연속 파울 기록(32·33) — 파울 각 공을 낙구 전에 잡아(파울 뜬공 아웃) 판이 타석을 끝낼 때 넘겨받는다
  progress = withFoulRecords(progress, options.foulRecordIds)
  // 기록은 판 끝 정산(0xa8024)이 낸 결과다 — `pending.outcome` 은 타석을 끝낸 임시 값이다(`battedContact`)
  return finishPlayerOutcome({ ...progress, pendingDefensePlay: null }, recordedOutcomeOf(pending, result), random, result, null)
}

/**
 * **벤치 클리어링 연출이 끝났다** — 출구 0xae24c (100틱 뒤 화면 전환이 끝났거나 OK·'5' 로 건너뜀).
 *
 * `reachedTargetTick` = 틱 10 의 갱신이 돌았는가. 돌았으면 그때 수비 8명 목표를 굴린 8 번이 나갔다
 * (`benchClearingScene` 머리말) — 화면은 굴림을 직접 하지 않고 여기로 알린다. 그 뒤 사구는 보통 길 그대로다.
 */
export function resolveBenchClearing(
  progress: GameProgress,
  scene: { readonly reachedTargetTick: boolean },
  random: RandomPort,
): GameProgress {
  const pending = progress.pendingBenchClearing
  if (pending === null) return progress
  if (scene.reachedTargetTick) rollBenchClearingTargets(random)
  const cleared = { ...progress, pendingBenchClearing: null }
  const playback = homeRunPlaybackOf({ outcome: pending.outcome, bases: cleared.game.bases })
  return finishPlayerOutcome(cleared, pending.outcome, random, null, playback)
}

/**
 * **사구 뒤 벤치 클리어링** (`entities/game/model/benchClearing`, R10 6절).
 * 내 타석이라 수비는 늘 CPU 다 → 들어가면 상대 투수 투구 수(`+0x27c`) +10 (0x3ab82).
 * 시즌 평판 S[1](코드 1)은 게이트상 내 팀이 수비일 때만 남아 여기서는 안 오른다 — 타자편은 S 칸도 안 든다.
 * 홈런더비가 아니므로 사구면 늘 한 번 굴린다 — **사구 타석만 난수를 하나 더 쓴다.**
 * 들어가면 부르는 쪽이 연출(상태 0x1e)을 붙든다 — `startPlayerOutcome` · `resolveBenchClearing`.
 */
function withBenchClearing(progress: GameProgress, outcome: AtBatOutcome, random: RandomPort): GameProgress {
  const entered = rollsIntoBenchClearing(
    {
      isHitByPitch: outcome.kind === '사구',
      isHomeRunDerby: false,
      burstInProgress: progress.burst !== null && progress.burst.current !== null,
    },
    random,
  )
  if (!entered) return progress
  const effect = benchClearingEffectOf(false)
  return appendLog(
    {
      ...progress,
      opponentMound: {
        ...progress.opponentMound,
        pitches: progress.opponentMound.pitches + effect.defensePitchCountGain,
      },
    },
    `${progress.game.inning}회${progress.game.half} 벤치 클리어링`,
    true,
  )
}

/**
 * 연속 파울 기록을 얹는다 — 공격 계열(32·33)이라 0xa77f0 게이트는 사람 공격(내 타석)에서 통과한다.
 */
function withFoulRecords(progress: GameProgress, foulRecordIds: readonly number[] | undefined): GameProgress {
  const passed = gatedOffenseRecords(foulRecordIds ?? [])
  return passed.length === 0 ? progress : { ...progress, recordIds: [...progress.recordIds, ...passed] }
}

/**
 * 진행기에 넘길 한 타구 — 능력치·난수·모드·수비 주체까지 다 여기서 채운다.
 * 이 객체를 만드는 데는 난수를 **한 번도 쓰지 않는다** (굴림은 전부 진행기 안에서 돈다).
 */
function defensePlayInputOf(
  progress: GameProgress,
  outcome: AtBatOutcome,
  pattern: BattedBallPattern,
  random: RandomPort,
  options: PlayerOutcomeOptions,
): DefensePlayInput {
  return {
    // 타석을 끝낸 임시 결과 — 진행기는 보지 않는다(결과는 판 끝 정산이 낸다)
    outcome,
    trajectory: battedBallTrajectory(pattern),
    bases: progress.game.bases,
    outs: progress.game.outs,
    // 수비는 상대 팀이다 — 로스터의 수비 자리 코드로 아홉 칸을 채운다
    defenseAbilities: opponentDefenseAbilitiesOf(progress),
    runAbility: runnerRunAbilityOf(progress),
    // 이 공이 나는 동안 출발한 도루 주자 — 판 시작 리드(0x3d7b8)가 다음 루로 15·14 + rand(0,9) 틱 몰아 돌린다
    stealingFrom: progress.stealingFrom,
    // 난수를 넘겨야 펌블(0xb41d0)·악송구(0xa1828)·필살수비(0x66b30/0x66be4) 굴림이 돈다
    random,
    // 나만의리그 타자편 = 전역 모드 4 (0x1552d10) — 필살수비 기준이 절반이다
    gameMode: MY_LEAGUE_BATTER_MODE,
    // 내 타석이므로 수비는 언제나 CPU 다 → 협살(AI 상태 8)이 돈다
    defenseIsCpu: true,
    // 타자편은 사람이 늘 공격이다 — `0xae690` 의 앞 항이 늘 거짓이라 설정 +0xbd 혼자가 답을 정한다
    offenseIsCpu: false,
    runningMode: progress.runningModeManual ? '수동' : '자동',
    // 필살타법이 성공한 타구면 야수가 쥐지 않는다 (0x51800) — 타석 쪽이 확률 굴림을 하면 넘겨 준다
    isUncatchable: options.isUncatchable,
    // 장면 +0xfdc — 번트면 도루 안 한 주자의 판 시작 리드가 +3 틱 (0x3d7b8)
    buntKind: options.buntKind ?? 0,
  }
}

/**
 * 타석 하나를 경기 상태에 먹이고 다음 내 차례까지 자동 진행한다 — 예전 `applyPlayerOutcome` 의 몸통이다.
 *
 * `defensePlay` 가 있으면 그 결과로 진루·아웃·득점을 갈아 끼운다. `playback` 은 화면에 재생시킬 것 —
 * 실시간으로 이미 다 보여 준 플레이는 null 이고, 홈런은 여기서 비행 틱을 따로 만든다.
 */
function finishPlayerOutcome(
  progress: GameProgress,
  outcome: AtBatOutcome,
  random: RandomPort,
  defensePlay: DefensePlayResult | null,
  /**
   * 화면에 재생시킬 틱 묶음. 홈런 비행이거나, 미리 다 돌려 버린 갈래의 그 결과다.
   * **실시간으로 이미 다 보여 준 플레이는 null** — 넣으면 같은 장면을 한 번 더 튼다.
   */
  playback: DefensePlayResult | null,
): GameProgress {
  const nextGame = applyAtBatOutcome(progress.game, outcome, defensePlay?.advance)
  const runsBattedIn = nextGame.ourScore - progress.game.ourScore
  const outsInPlay =
    defensePlay?.advance.outsAdded ??
    advanceRunners(progress.game.bases, outcome, progress.game.outs).outsAdded
  const isWalkOff = nextGame.isFinished && runsBattedIn > 0 && nextGame.ourScore > nextGame.opponentScore
  const points = atBatPopularityPoints({ outcome, runsBattedIn, outsInPlay, isWalkOff })
  const penalties = atBatPenaltyCounts({
    outcome,
    outsInPlay,
    runsBattedIn,
    isWalkOff,
    hadSecondBaseRunner: progress.game.bases.second,
  })

  // 기록 판정은 동료 타석과 같은 함수를 쓴다 — 원본은 기록을 팀 단위로 센다 (0xa77f0)
  const recorded = recordBatterAtBat(
    { stats: progress.myStats, consecutiveHits: progress.consecutiveHits },
    outcome,
    runsBattedIn,
  )
  const myStats = recorded.log.stats
  const consecutiveHits = recorded.log.consecutiveHits
  // 백투백 6·7 — 정산 0xa8024 의 홈런 갈래(@a8606)가 0xa794c 를 부른다. 공격 팀이 사람 팀(우리)이다
  const backToBack = backToBackRecordOf({
    streak: progress.homeRunStreak,
    humanOffense: true,
    isHomeRun: outcome.kind === '홈런',
  })
  const recordIds = [...recorded.recordIds, ...backToBack.recordIds]

  // 돌발 판정은 타석이 끝나는 자리에서 한다 (0x4e6d4 → 0x8f414). 결과비트가 0 이거나
  // 목표 5번이면 판정이 나지 않고 돌발이 남지만, 다음 타석은 늘 자동진행(0x21)이라 그 진입(0x8f628)에서
  // 판정 없이 내려간다 (`withoutPendingBurst`).
  const resolution =
    progress.burst === null
      ? null
      : resolveBurst(
          progress.burst,
          burstResultBitsOf({
            // 사구도 B5(출루)·B11 을 켠다 — burstResultBitsOf 가 '사구' 를 받는다 (0xa882a · 0xa8bf4)
            outcome,
            runsBattedIn,
            outsBefore: progress.game.outs,
            outsAdded: outsInPlay,
            inningEnded: progress.game.outs + outsInPlay >= OUTS_PER_INNING,
            humanTeamWalkOff: isWalkOff,
            // B5 — 안타 없이 살아 나간 타자주자(야수 선택)도 출루다 (0xa87ba r5)
            batterRunnerSafe: defensePlay === null ? undefined : batterRunnerSafeOfFates(defensePlay.runnerFates),
            // B6 — 번트 타구(state[0x13]) && (희생 [sp+8] || 득점) (a88e0 · a88f8). ⚠️ B7(a88fc 고리)은 아직 안 싣는다
            isBunt: defensePlay?.buntBall === true,
            runnersAdvanced: defensePlay?.sacrifice === true,
          }),
        )

  const afterMyAtBat: GameProgress = appendLog(
    {
      ...progress,
      game: nextGame,
      // 득점 처리 0xa5c34 — 내 타석에서 난 점수도 한 점씩 승·패·세 칸을 고친다
      decisions: decisionsAfterPlay(progress.decisions, progress.game, nextGame, moundsOf(progress)),
      // 내 타석에서 난 점수도 상대 투수 실점 A·B 에 붙는다. 공을 하나라도 던졌으니 교체 직후
      // 표시(state[0xd])도 내려가 있다 (0xa5e72).
      // 투구 수·스태미나는 공이 손을 떠날 때마다 `throwOpponentPitch` 가 이미 깎았다 (0xa5e14).
      opponentMound: {
        ...progress.opponentMound,
        runsAllowed: Math.min(MAXIMUM_PITCHER_COUNTER, progress.opponentMound.runsAllowed + runsBattedIn),
        justChanged: false,
      },
      opponentInningRunsAllowed: Math.min(
        MAXIMUM_PITCHER_COUNTER,
        progress.opponentInningRunsAllowed + runsBattedIn,
      ),
      // 내 타석도 같은 정산 0xa8024 가 타순 칸 기록(안타·홈런·타석)을 세운다
      ourLineup: recordLineupPlay(progress.ourLineup, progress.game.battingOrderIndex, outcome),
      // 같은 정산이 상대 마운드 투수 레코드에 아웃(결과 코드 5·0xd)·실점·탈삼진을 쌓는다 (0xa8cca · 0xa8ee4 · 0xa8d1c)
      pitcherLines: chargePitcherLine(progress.pitcherLines, progress.opponentTeamId, progress.opponentMound.pitcherSlot, {
        outs: outsAddedBetween(progress.game, nextGame),
        runsAllowed: runsBattedIn,
        strikeouts: outcome.kind === '삼진' ? 1 : 0,
      }),
      lastDefensePlay: playback,
      burst: resolution === null ? progress.burst : resolution.session,
      // 아직 안 보여 준 판정을 지우지 않는다 — 지우는 것은 창을 닫을 때뿐이다.
      // (판정은 이제 내 타석 끝에서만 나므로 앞 판정이 안 보인 채 남을 일은 없다 — 안전하게 둔다)
      lastBurstResolution:
        resolution !== null && resolution.judgement !== null ? resolution : progress.lastBurstResolution,
      myStats,
      consecutiveHits,
      homeRunStreak: backToBack.streak,
      recordIds: [...progress.recordIds, ...recordIds],
      popularityPoints: progress.popularityPoints + points,
      recentAtBatCodes: [...progress.recentAtBatCodes, atBatRecordCodeOf(outcome)].slice(-RECENT_AT_BAT_COUNT),
      doublePlays: progress.doublePlays + penalties.doublePlays,
      scoringPositionOuts: progress.scoringPositionOuts + penalties.scoringPositionOuts,
      reputationCounts: addReputationCounts(progress.reputationCounts, {
        outcome,
        runsBattedIn,
        isWalkOff,
        ourScoreBefore: progress.game.ourScore,
        opponentScore: progress.game.opponentScore,
      }),
    },
    `${progress.game.inning}회${progress.game.half} 나 — ${describeOutcome(outcome)}${
      runsBattedIn > 0 ? ` (${runsBattedIn}타점)` : ''
    }${
      // 3아웃으로 날아간 보류 득점(state[0])은 점수판에 안 올라가므로 기록으로만 남긴다
      defensePlay !== null && defensePlay.voidedRuns > 0 ? ` (${defensePlay.voidedRuns}점 무효)` : ''
    }`,
    true,
  )

  return advanceUntilPlayerTurn(afterMyAtBat, random)
}

/**
 * 수비 아홉 칸의 능력치 — **상대 팀** 로스터에서 만든다.
 *
 * 나만의리그 타자편은 전역 모드 4 라 팀 능력치 보정(비트마스크 0x306 = 모드 1·2·8·9)이
 * 붙지 않는다 → 로스터에 적힌 밑값을 그대로 쓴다.
 * 칸 0(투수)은 오늘 상대 선발의 능력치 칸 2 다 (`defenseAbilitiesOf` 주석 — ⚠️ 원본 그대로).
 */
function opponentDefenseAbilitiesOf(progress: GameProgress): readonly number[] {
  // 수비 칸 0 은 지금 마운드에 선 투수다 — 교체되면 바뀐다
  const ace = moundAcePitcherOf(progress, false)
  const pitcher = teamPitchers(progress.opponentTeamId)[progress.opponentMound.pitcherSlot]
  return defenseAbilitiesOf(
    teamBatters(progress.opponentTeamId).map((player) => ({
      position: player.position,
      defense: player.ability[2],
    })),
    ace === undefined ? pitcher?.ability[2] : ace.breaking,
  )
}

/** 원본 0~999 를 타석 화면의 0~100 눈금으로 — 팀 경기 `currentPitcherAbility` 와 같은 나눗셈 */
const STAGE_PITCHER_DIVISOR = 10

/**
 * **내 타석에서 공을 던지는 상대 투수**의 타석 화면용 능력치 — 지금 마운드(`opponentMound.pitcherSlot`) 투수.
 *
 * 원본 사람 타석은 수비 팀의 현재 투수 `0xae83c(팀)` → `0xb89dc(팀, team[0])`(team[0] = 등판 칸,
 * P1 E-6)을 본다 — 공이 나갈 때(0x3de10 의 0x3de38·0xa5e14 의 0xa5e2a)도 같은 함수다. 그 칸은 CPU 교체
 * `0xac428`(사람 타석 시작 0x3da3e·간이 엔진 0xc1ce2)이 바꾸므로 교체 뒤에는 바뀐 투수가 던진다.
 * 모드 4 는 팀 능력치 보정(마스크 0x306)이 없어 로스터 밑값 그대로다 (`opponentDefenseAbilitiesOf` 와 같다).
 * 투구 AI 는 `gameAbility`(피로 앞 밑값)와 `staminaPercent`(지금 마운드 +0x2c / 100)로 피로를 먹인다 (`cpuPitchStatsOf`).
 * 폼·구질·마구는 같은 레코드의 +0xb · +0x1c · +0x18 (`ROSTER_PITCHER_REPERTOIRES`, 전역 번호 팀 × 8 + 칸).
 *
 * ⚠️ 마선수 등판(`aceOpponent`)은 부르는 쪽이 `pitcherAbilityOf` 로 따로 고른다 — 정규 리그 경기엔 없다.
 */
export function opponentPitcherAbilityOf(progress: GameProgress): PitcherAbility {
  const slot = progress.opponentMound.pitcherSlot
  // 142 가 상대 명부 8번 칸에 넣은 마투수가 마운드에 서면 그 레코드가 던진다 — 레벨 배율(0xb6414)·체력%(0xaebb0)
  const ace = moundAcePitcherOf(progress, false)
  if (ace !== undefined) {
    return pitcherAbilityOf(ace.player, progress.aces?.levels ?? {}, staminaPercentOf(progress.opponentMound.stamina))
  }
  const pitcher = teamPitchers(progress.opponentTeamId)[slot]
  const repertoire = ROSTER_PITCHER_REPERTOIRES[progress.opponentTeamId * PITCHERS_PER_TEAM + slot]
  if (pitcher === undefined) return DEFAULT_PITCHER_ABILITY
  return {
    control: Math.round(pitcher.ability[0] / STAGE_PITCHER_DIVISOR),
    velocity: Math.round(pitcher.ability[1] / STAGE_PITCHER_DIVISOR),
    breaking: Math.round(pitcher.ability[2] / STAGE_PITCHER_DIVISOR),
    // 투구 AI·스윙 판정(0x34968·0x4dbac·0xab214 의 ab548·ab582)은 0xb570c 를 투수 체력% 0xaebb0 로 부른다 — 모드 4 는
    // 모드 가지(0xb574a 나리 질병·부상·사기)가 내 팀 육성 선수에만 붙고 팀·코치 정액이 없어, 피로 앞 값이 로스터 밑값이다
    gameAbility: {
      beforeFatigue: { control: pitcher.ability[0], velocity: pitcher.ability[1], breaking: pitcher.ability[2] },
    },
    staminaPercent: staminaPercentOf(progress.opponentMound.stamina),
    ...(repertoire === undefined
      ? {}
      : { repertoire: { form: repertoire.form, pitchMask: repertoire.pitchMask, magicId: repertoire.magicId } }),
  }
}

/**
 * **지금 상대 마운드 투수의 소개 판 재료** (상태 0xe 의 0x44944 — 투수 `0xae83c(수비 팀)`).
 * - 이름 · 보직 `+0xb & 3`(로스터 칸 표) · 손 0xb63c0(폼 & 1 · 마투수 표 `pitcherHandOf`) — 레코드는 붙박이 표 칸 또는 142 가
 *   8번 칸에 넣은 마투수다. 마선수 대결 투수(`aceOpponent`)는 이름만 안다.
 * - 체력 막대 재료 — 공마다 깎는 셈(`drainPitcherForPitch`)이 쓰는 용량 X 의 칸 그대로(사기 `defense.morale` · 첫 투수 = 이미
 *   내려간 투수가 없다).
 * - `pitcherSlot` — 리그 기록표의 그 투수 칸(마투수·대결 투수면 null — 표에 칸이 없다).
 */
export function opponentMoundOf(progress: GameProgress): {
  readonly name?: string
  readonly role?: number
  readonly throwsLeft?: boolean
  readonly pitcherSlot: number | null
  readonly staminaAbility: number
  readonly teamMorale: number
  readonly isFirstPitcher: boolean
  readonly stamina: number
} {
  const mound = progress.opponentMound
  const defense = opponentQuickDefenseOf(progress)
  const stamina = {
    staminaAbility: defense.staminaAbilityAt(mound.pitcherSlot),
    teamMorale: defense.morale ?? 100,
    isFirstPitcher: mound.usedSlots.length === 0,
    stamina: mound.stamina,
  }
  if (progress.aceOpponent !== null) return { name: progress.aceOpponent.name, pitcherSlot: null, ...stamina }
  const ace = moundAcePitcherOf(progress, false)
  const aceIndex = progress.aces?.opponent?.pitcher
  if (ace !== undefined && aceIndex !== undefined) {
    const form = ACE_PITCHER_REPERTOIRES[aceIndex]?.form
    return {
      name: ace.player.name,
      ...(form === undefined ? {} : { throwsLeft: pitcherHandOf(form, true) === 1 }),
      pitcherSlot: null,
      ...stamina,
    }
  }
  const pitcher = teamPitchers(progress.opponentTeamId)[mound.pitcherSlot]
  const repertoire = ROSTER_PITCHER_REPERTOIRES[progress.opponentTeamId * PITCHERS_PER_TEAM + mound.pitcherSlot]
  const role = rosterPitcherRoleOf(mound.pitcherSlot)
  return {
    ...(pitcher === undefined ? {} : { name: pitcher.name }),
    ...(role === undefined ? {} : { role }),
    ...(repertoire === undefined ? {} : { throwsLeft: pitcherHandOf(repertoire.form, false) === 1 }),
    pitcherSlot: mound.pitcherSlot,
    ...stamina,
  }
}

/**
 * 주자들의 주루 능력치.
 *
 * ⚠️ **근사**: 원본은 주자마다 제 레코드로 `0xb570c(팀, 3, 선수, 90)` 을 불러 속도를 따로 잡지만
 * (I-controls 3a), 이 진행기는 주자 전원에 한 값만 받는다. 지금 타석에 선 칸의 주루를 넘긴다 —
 * 누상 주자가 누구인지 `GameState` 가 들고 있지 않은 것도 `stealBase` 와 같은 한계다.
 */
function runnerRunAbilityOf(progress: GameProgress): number {
  return teamBatterAt(progress, true, rosterSlotAt(progress.ourLineup, progress.game.battingOrderIndex)).run
}

/**
 * 명단 칸의 선수 — 마타자 칸(`ACE_BATTER_ROSTER_SLOT`)이면 142 가 넣은 마타자, 아니면 로스터 붙박이 선수.
 */
function teamBatterAt(progress: GameProgress, isOurs: boolean, rosterSlot: number): QuickAtBatBatter {
  if (rosterSlot === ACE_BATTER_ROSTER_SLOT) {
    const aces = isOurs ? progress.aces?.ours : progress.aces?.opponent
    const ace = aces === undefined ? undefined : gameAceBatterOf(aces.batter, progress.aces?.levels)
    if (ace !== undefined) return ace
  }
  return batterAt(isOurs ? progress.ourTeamId : progress.opponentTeamId, rosterSlot)
}

/** 그 팀 명부 8번 칸의 마투수 (142 가 넣은 것) — 없으면 undefined */
function teamAcePitcherOf(progress: GameProgress, isOurs: boolean): GameAcePitcher | undefined {
  const aces = isOurs ? progress.aces?.ours : progress.aces?.opponent
  return aces === undefined ? undefined : gameAcePitcherOf(aces.pitcher, progress.aces?.levels)
}

/** 지금 마운드가 마투수(8번 칸)면 그 선수 */
function moundAcePitcherOf(progress: GameProgress, isOurs: boolean): GameAcePitcher | undefined {
  const mound = isOurs ? progress.ourMound : progress.opponentMound
  return mound.pitcherSlot === ACE_PITCHER_SLOT ? teamAcePitcherOf(progress, isOurs) : undefined
}

/**
 * 평판 가산 칸 누계 (0xa57f8 의 사건 코드, P7 B1·B2 확정).
 *
 * 역전·동점 득점은 원본이 **득점 처리 0xa5c34 에서 1점마다** 판정한다. 그 함수는 점수를 올리기 직전에
 * `L[측] = 올리기 전 내 점수` 를 적어 두고(0xb6a9c), 올린 뒤 아래를 본다:
 *   - 동점 득점 (G+0x110): `상대 점수 == 내 점수`
 *   - 역전 득점 (G+0x114): `L(상대) >= L(나) && 상대 점수 < 내 점수` → 정수라 `상대 점수 == 올리기 전 내 점수`
 * 타석 하나로 r 점이 들어오면 내 점수가 `before+1 … before+r` 로 차례로 오르므로, 그 구간에
 * 상대 점수가 걸리는지만 보면 같은 결과가 된다.
 *
 * 번트 안타(G+0xf4)는 웹에 번트가 없어 늘 0 이다.
 */
function addReputationCounts(
  counts: ReputationCounts,
  play: {
    outcome: AtBatOutcome
    runsBattedIn: number
    isWalkOff: boolean
    ourScoreBefore: number
    opponentScore: number
  },
): ReputationCounts {
  const { outcome, runsBattedIn, isWalkOff, ourScoreBefore, opponentScore } = play
  const isHit = outcome.kind === '안타' || outcome.kind === '홈런'
  const after = ourScoreBefore + runsBattedIn
  return {
    grandSlams: counts.grandSlams + (outcome.kind === '홈런' && runsBattedIn === GRAND_SLAM_RUNS ? 1 : 0),
    walkOffs: counts.walkOffs + (isWalkOff && isHit ? 1 : 0),
    buntHits: counts.buntHits,
    // G+0xfc 는 볼넷만이다 — 사구 갈래(0xa8b90)는 코드 13 으로 G+0x100 을 올리고, 평판식은 0xfc 만 읽는다
    walks: counts.walks + (outcome.kind === '볼넷' ? 1 : 0),
    goAheadRuns:
      counts.goAheadRuns + (opponentScore >= ourScoreBefore && opponentScore <= after - 1 ? 1 : 0),
    tyingRuns:
      counts.tyingRuns + (opponentScore > ourScoreBefore && opponentScore <= after ? 1 : 0),
  }
}

/** 만루 홈런 — 그 플레이 득점이 4 점 (0xa8696) */
const GRAND_SLAM_RUNS = 4

/** 한 이닝 아웃 수 — 돌발 결과비트 B5 가 "이닝이 안 끝났는가" 를 볼 때 쓴다 */
const OUTS_PER_INNING = 3

/** 타순 칸 수 — 상대 타순 슬롯(team+0x32)은 0~8 로 돈다 */
const BATTING_ORDER_SIZE = 9

/**
 * 타석 준비에서 돌발미션 발동을 굴린다 (장면 상태 0xf → 0x8f158).
 *
 * ## 굴리는 타석은 **사람 장면(0xd → 0xe → 0xf)을 지나는 타석뿐** — 타자편은 내 타석뿐이다 (2026-10-05 디스어셈 전수)
 * ```
 * 0x8f158(발동)  부르는 곳 1곳 — 리터럴 0x50d8c ← 0x50c42: 메시지 1 "확인" 의 인자 0xe 갈래(0x50c26~0x50c56).
 *               상태 0xe(등판·확인) → 0xf 로 넘기며 굴리고, 뜨면 0x1b. 0xe 는 0xd 에서만 오고 0xd 는 A·B·C
 *               (0xae24c·0xae3e8·0xae3a0)의 "다음 타자" 로만 온다 — 모두 사람 장면이다.
 * 0x8f414(판정)  부르는 곳 2곳 — 0x4e7ca(상태 0x12 갱신 0x4e6d4 끝) · 0x52a8e(상태 0x17 인플레이 끝 0x528b0).
 * 0x8f628(내림)  부르는 곳 2곳 — 0x21 진입 0x3abf0 · 0x18 진입 0x3ac90(반 이닝 뒤집힐 때) (`cancelBurst`).
 * 간이 엔진 0xc262c · 0x21 갱신 0x48480 의 호출 그래프(8단, 풀의 함수 포인터 포함)에는 셋 다 없다.
 * ```
 * 모드 4 에서 어느 타석이 사람 장면인가 — 0xc1e04 점프표 0xd90c0 칸 3 = 0xc1ed6:
 * 0xc1d38(공격 팀 지금 타자가 0xb6389 내 선수인가) 거짓 → 1(자동). 그래서 **동료 타석·상대 반 이닝은 늘 0x21** 이다.
 * 내 타석이 끝나는 자리(0x4e7ae · 0x528b0 → 0x35108 → 0x350d4)도 `0xc1e04` 가 참(다음이 자동)이면 다음 상태
 * +0x1b6c 를 **0x21** 로 덮는다 — 다음 타자는 늘 동료나 상대라 내 타석 뒤에는 늘 0x21 진입(0x8f628)이 온다.
 *
 * ⚠️ K 4절 1-6 의 "매 타석 시작 때" 는 **0xf 를 지나는 타석마다** 라는 뜻이다. 예전 웹은 이것을 동료·상대 타석까지로
 * 읽어 세 자리(내 타석·동료 `playTeammateAtBat`·상대 `onAtBatStart`)에서 굴리고 판정했다 — 원본에 없는 굴림이었다.
 *
 * 상대 마선수(b0=10~22): 마투수 행(0xae83d)은 142 가 상대 명부 8번에 넣은 마투수가 마운드에 섰을 때 걸린다. 마타자 행(0xae89d)은
 * 지금 타자를 보는데 내 타석의 타자는 나라 걸리지 않는다.
 */
function burstContextOf(
  progress: GameProgress,
  situation: {
    readonly isHumanTeamBatting: boolean
    readonly bases: BaseState
    readonly outs: number
    readonly opponentBattingSlot: number
    readonly hitsInGame: number
    readonly homeRunsInGame: number
    readonly strikeoutsInGame: number
  },
) {
  const ace = progress.aceOpponent
  // 142 가 상대 명부에 넣은 마투수가 지금 마운드면 그 레코드가 마선수다 (b0 = 마투수 행)
  const moundAce = moundAcePitcherOf(progress, false)
  return {
    ...situation,
    // 원본 이닝은 0-기준이다 (game+0x6b) — 웹 `inning` 은 1-기준이라 하나 뺀다
    inning: progress.game.inning - 1,
    ourScore: progress.game.ourScore,
    opponentScore: progress.game.opponentScore,
    opponentAceBatterId: ace !== null && ace.role === '타자' ? ace.id : null,
    opponentAcePitcherId: ace !== null && ace.role === '투수' ? ace.id : (moundAce?.player.id ?? null),
  }
}

function triggerBurstForMyAtBat(progress: GameProgress, random: RandomPort): GameProgress {
  const session = progress.burst
  if (session === null) return progress

  const next = tryTriggerBurst(
    session,
    burstContextOf(progress, {
      isHumanTeamBatting: true,
      bases: progress.game.bases,
      outs: progress.game.outs,
      // 상대 타순 슬롯(team+0x32)은 우리 공격 중에도 상대 팀 칸을 가리킨다 — 다음 상대 타자 자리다
      opponentBattingSlot: progress.opponentOrderIndex,
      hitsInGame: progress.myStats.hits,
      homeRunsInGame: progress.myStats.homeRuns,
      strikeoutsInGame: progress.pitching.strikeouts,
    }),
    random,
  )
  return next === session ? progress : { ...progress, burst: next }
}

/** 상대 공격과 동료 타석을 플레이어 차례가 돌아올 때까지 자동으로 소화한다. */
function advanceUntilPlayerTurn(
  progress: GameProgress,
  random: RandomPort,
): GameProgress {
  let current = progress
  // 이번 부름에서 자동진행(0x21)으로 한 타석이라도 돌렸는가 — 0x21 이 멈출 때만 0xc22b4 를 부른다
  let autoPlayed = false

  for (let step = 0; step < MAXIMUM_AUTO_STEPS; step += 1) {
    if (current.game.isFinished) return current
    // 내 타석이 오면 그 자리가 곧 타석 준비(0xf)다 — 돌발을 굴리고 넘긴다.
    // 자동진행이 내 차례에서 멈췄으면(경기 끝이 아니므로) 먼저 0xc0ee8·0xc22b4 를 지난다 (0x48558~0x48564)
    if (isPlayerTurn(current.game)) {
      return prepareMyAtBat(autoPlayed ? withAutoStopLateInningSetup(current, random) : current, random)
    }
    autoPlayed = true
    // 내 차례가 아니면 원본은 자동진행(0x21)이다 — 진입 0x3abf0 이 남은 돌발을 판정 없이 내린다 (0x8f628).
    // 동료·상대 타석은 0xf 를 안 지나므로 돌발을 굴리지도 판정하지도 않는다 (`burstContextOf` 머리말)
    current = withoutPendingBurst(current)
    // 우리가 공격하는 반 이닝은 측이 정한다 — '초' 고정이 아니다 (측 0 선공 · 측 1 후공)
    current = current.game.half === ourHalfOf(current.game)
      ? playTeammateAtBat(current, random)
      : playOpponentInning(current, random)
  }
  throw new Error('경기 자동 진행이 끝나지 않았습니다 — 진행 규칙을 확인하세요')
}

/**
 * **자동진행이 멈출 때의 `0xc22b4(sim)`** — 상태 0x21 갱신 `0x48480` 이 `0xc2198(sim, 1)` 거짓(내 차례)을 보면
 * `+0x1784 = 0` · 다음 상태 0x18 을 걸고, **경기 끝(0xb68fc)이 아니면** `0xc0ee8(sim)` → `0xc22b4(sim)` 를 부른다
 * (0x48538~0x48564). `0xc0ee8` 은 명단 확정(0xaebe4)·마선수 칸·카운트 지우기(0xb6764)·플레이 칸 지우기(0xb68bc) —
 * 간이 타석이 타석째로 끝나 웹에서는 이미 그 상태라 할 일이 없고 굴림도 없다. `0xc22b4` 는 **모드 4 만**:
 * ```
 * c22c0  st[1] != 4 → 끝                         ; 나만의리그 타자편만 (팀경기·투수편은 아무것도 안 한다)
 * c22d4  st[0x6b](이닝) < st[0x69](8) → 끝        ; 9회부터
 * c22dc  st[9](공격 측) != 1 → 끝                  ; 말 공격
 * c230a  d = 점수(측 0) − 점수(측 1) ; (u32)d > 3 → 끝   ; 후공이 0~3점 뒤지거나 동점
 * c2310  t = st[6](아웃) + 주자 수 ; t < d → 끝
 * c2318  n = rand(0, t + 1)                       ; 주자 수를 다시 정한다
 * c232e  st[6] = max(0, t − n)                    ; 남은 몫이 아웃
 * c2338  0xa9250 주자 지우기
 * c2342  루 i = 0(1루)·1·2: n == 3 − i 이면 세움(n−1) · 아니면 rand(0, n + 1) == 0 일 때 세움(n−1)
 * c237a  0xa9a9c(주자관리, 공격 팀, 수비 팀, 1루, 2루, 3루)  ; 앞 타자들로 주자를 세운다 (굴림 없음)
 * ```
 * 곧 9회 이후 말 공격에서 뒤진(또는 동점) 후공 팀의 내 타석 앞, `아웃 + 주자` 를 주자·아웃으로 다시 나눠
 * 끝내기 판을 차린다. n 이 0 일 때 rand(0, 1) 은 늘 0 이라 주자를 세우고 n 이 −1 이 되는 것까지 원본 그대로다.
 */
/**
 * 원본 `0xbfa54 rand(a, b)` 그대로 — a == b 면 a, a > b 면 `b + x % (a − b)`, 아니면 `a + x % (b − a)` (bfa6a~bfa88).
 * `randomIntegerBelow` 는 a ≤ b 만 맞으므로, n 이 −1 까지 내려가 rand(0, 0)·rand(0, −1) 이 나오는 0xc22b4 는 이것으로 굴린다.
 */
function originalRandRange(random: RandomPort, a: number, b: number): number {
  return a > b ? randomIntegerBelow(random, b, a) : randomIntegerBelow(random, a, b)
}

/** 경기 상태 초기화 0xb6814 가 `state+0x69`(마지막 정규 이닝, 0-기준)에 넣는 값 — 9회 */
const LAST_REGULAR_INNING_INDEX = 8

export function withAutoStopLateInningSetup(progress: GameProgress, random: RandomPort): GameProgress {
  const game = progress.game
  if (game.inning - 1 < LAST_REGULAR_INNING_INDEX) return progress
  if (game.half !== '말') return progress
  // 말 공격이 내 차례이므로 우리가 측 1(후공)이다 — 측 0 점수 = 상대, 측 1 = 우리
  const deficit = game.opponentScore - game.ourScore
  if (deficit < 0 || deficit > 3) return progress
  const total = game.outs + runnerCountOf(game.bases)
  if (total < deficit) return progress
  let runners = randomIntegerBelow(random, 0, total + 1)
  const outs = Math.max(0, total - runners)
  const placed: boolean[] = []
  for (let base = 0; base <= 2; base += 1) {
    if (runners === 3 - base) {
      placed.push(true)
      runners -= 1
    } else if (originalRandRange(random, 0, runners + 1) === 0) {
      placed.push(true)
      runners -= 1
    } else {
      placed.push(false)
    }
  }
  const bases: BaseState = { first: placed[0] === true, second: placed[1] === true, third: placed[2] === true }
  return { ...progress, game: { ...game, outs, bases } }
}

/**
 * 내 타석 준비 — 상태 0xe 확인(메시지 1) → 0xf 진입 `0x3d954` 차례 (디스어셈 0x50c18~0x50c56).
 * ```
 * 0x50c26  0xbcb48(…, 0xf)  — 0xf 를 **예약만** 한다 (다음 틱에 옮김)
 * 0x50c42  돌발 객체가 있으면 0x8f158 — 뜨면 예약을 0x1b(돌발 창)로 덮는다
 * (다음 틱) 0xf 진입 0x3d954: 수비 팀이 CPU(3d9e4) → 돌발 진행 중(0x8eb94, 3d9fc)이면 건너뜀,
 *           아니면 CPU 투수 교체 0xac428(3da3e). 바뀌면 0x16 → 0xd → 0xe → 메시지 1 → **0x8f158 을 다시** → 0xf 진입
 * ```
 * 그래서 돌발 굴림이 상대 투수 교체보다 **앞**이고, 돌발이 뜨면 교체는 보지 않는다. 교체가 나면 돌발을 한 번 더 굴린 뒤
 * 0xf 진입을 다시 지난다 (팀 경기 `readyAtBat`·`enterPitchSelection` 과 같은 차례).
 */
function prepareMyAtBat(progress: GameProgress, random: RandomPort): GameProgress {
  // 0xd → 0xe (0x39e14) — 사람 OK 를 기다린다 (0x532b0)
  let current = triggerBurstForMyAtBat({ ...progress, sceneConfirm: enterSceneConfirm() }, random)
  // 0xf 진입은 교체가 날 때마다 다시 온다 — 바뀐 쪽 막음 칸(state[0xd])이 서 있어 두 번째 판정에서 멈춘다
  for (let entry = 0; entry < MAXIMUM_SUBSTITUTION_CALLS; entry += 1) {
    if (current.game.isFinished) return current
    if (current.burst !== null && current.burst.current !== null) return current
    const changed = changeOpponentPitcher(current, random)
    if (changed === current) return current
    // 22 → 0x16 → 0xd → 0xe — OK 를 한 번 더 기다린다
    current = triggerBurstForMyAtBat({ ...changed, sceneConfirm: chainSceneConfirm(changed.sceneConfirm) }, random)
  }
  return current
}

/**
 * 자동진행(0x21) 진입 0x3abf0 의 `0x8f628` — 판정 못 받고 남은 돌발을 내린다. 굴림 없음.
 * 내 타석에서 뜬 돌발이 결과비트 0 으로 살아남았을 때만 일이 있다 (`cancelBurst` 머리말).
 */
function withoutPendingBurst(progress: GameProgress): GameProgress {
  if (progress.burst === null) return progress
  const burst = cancelBurst(progress.burst)
  return burst === progress.burst ? progress : { ...progress, burst }
}

/**
 * 상대 공격은 이닝 득점 확률표가 아니라 원본처럼 타석을 3아웃까지 돌려 점수를 읽는다 (0xc11f0).
 *
 * 모드 4 도 사람이 필요 없는 타석은 간이 엔진으로 넘긴다 (0x48530 → 0xc262c, P1 1-3).
 * 상대 타순은 `opponentOrderIndex`(team+0x32)에서 시작해 **이어진다** — 이닝마다 1번부터가 아니다
 * (E 3b 확정: 이닝 전환에서 이 칸을 0 으로 되돌리는 코드가 없다). 타순은 아홉 칸을 돈다
 * (`0xaf020` 의 `mod 9`) — 로스터 열두 명 중 뒤 셋(벤치)은 타순에 안 선다.
 */
function playOpponentInning(progress: GameProgress, random: RandomPort): GameProgress {
  // 상대 반 이닝은 모드 4 에서 늘 자동진행(0x21, 0xc1ed6)이라 상태 0xf 를 안 지난다 —
  // 돌발을 굴리지도(0x8f158) 판정하지도(0x8f414) 않는다 (`burstContextOf` 머리말)
  const half = simulateHalfInning(
    progress.opponentOrderIndex,
    (order) => teamBatterAt(progress, false, order % BATTING_ORDER_SIZE),
    startingPitcherOf(progress.ourTeamId, progress.ourStartingPitcherIndex),
    progress.game.inning,
    random,
    { strikeoutCombo: progress.pitching.strikeoutCombo, strikeouts: progress.pitching.strikeouts },
    // 자동진행도 타석마다 0xc2198 → 경기 끝 판정 0xb68fc — 상대가 홈(말)이면 끝내기 · 홈 10점 콜드에서 3아웃 전에 멈춘다
    {
      endsGame: ({ runs, outs }) =>
        isGameOverAt(endSituationOf({ ...progress.game, opponentScore: progress.game.opponentScore + runs }, outs)),
    },
    // 우리 투수도 CPU 가 던진다 — 타석마다 0xc1ba4 → 0xac428 교체, 투구마다 0xa5e14 소모
    quickDefenseOf(
      progress.ourTeamId,
      progress.ourMound,
      progress.game.ourScore - progress.game.opponentScore,
      progress.ourPitcherOrder,
      progress.ourPitcherStaminas,
      teamAcePitcherOf(progress, true),
    ),
    // 상대 타자는 명단에서 고르고, 타석마다 CPU 대타(0xac228)를 먼저 본다
    {
      lineup: progress.opponentLineup,
      batterOf: (rosterSlot) => teamBatterAt(progress, false, rosterSlot),
      pinchHitUsed: progress.pinchHitUsed,
    },
  )
  const runs = half.runs
  const game = applyOpponentInning(progress.game, runs)
  const decisions = opponentHalfDecisionsOf(progress, half.runs, half.pitcherChanges ?? [])
  // 상대 타석도 정산 0xa8024 를 지난다 — 공격 팀이 사람이 아니라 백투백 카운터는 결과와 무관하게 0 이 된다
  const homeRunStreak = half.plateAppearances.reduce(
    (streak, appearance) =>
      backToBackRecordOf({ streak, humanOffense: false, isHomeRun: appearance.outcome.kind === '홈런' }).streak,
    progress.homeRunStreak,
  )

  return appendLog(
    {
      ...progress,
      game,
      opponentOrderIndex: half.nextBattingOrderIndex % BATTING_ORDER_SIZE,
      ourMound: half.mound ?? progress.ourMound,
      // 우리 투수 줄 — 반 이닝 엔진이 던진 투수마다 낸 줄 (투구 수 포함)
      pitcherLines: chargeHalfInningLines(progress.pitcherLines, progress.ourTeamId, half.pitcherLines),
      // 내려간 투수는 그 순간 값을 레코드에 남긴다
      ourPitcherStaminas: withOutgoingStaminas(progress.ourPitcherStaminas, half.pitcherChanges ?? []),
      decisions,
      // 상대 공격이 끝나면 우리 공격 반 이닝이 시작된다 — 교대 0xa5b00 이 A 를 0 으로 되돌린다
      opponentInningRunsAllowed: 0,
      opponentLineup: half.lineup ?? progress.opponentLineup,
      pinchHitUsed: half.pinchHitUsed ?? progress.pinchHitUsed,
      homeRunStreak,
      pitching: {
        hitsAllowed: progress.pitching.hitsAllowed + half.hits,
        walksAllowed: progress.pitching.walksAllowed + half.walks,
        outsRecorded: progress.pitching.outsRecorded + half.outs,
        strikeouts: progress.pitching.strikeouts + half.strikeouts,
        strikeoutCombo: half.strikeoutCombo,
      },
      // 삼진 계열 기록도 우리 팀 것이다 (0xa77f0 은 수비 팀이 사람 팀인지 본다)
      recordIds: [...progress.recordIds, ...half.recordIds],
      // 상대 팀 타석도 원본은 같은 0xa8024 로 상대 선수 레코드에 쌓는다 (B-2)
      leaguePlateAppearances: [
        ...progress.leaguePlateAppearances,
        ...half.plateAppearances.map((appearance) => ({
          teamId: progress.opponentTeamId,
          // 실제로 선 선수의 로스터 칸 — 대타가 들어오면 타순 칸과 갈린다
          battingOrderIndex: appearance.rosterSlot ?? appearance.battingOrderIndex % BATTING_ORDER_SIZE,
          outcome: appearance.outcome,
          runsBattedIn: appearance.runsBattedIn,
        })),
      ],
    },
    `${progress.game.inning}회${progress.game.half} 상대 공격 — ${runs}점${half.pinchHits
      .map((pinch) => ` (${(pinch.battingOrderIndex % BATTING_ORDER_SIZE) + 1}번 CPU 대타)`)
      .join('')}`,
    false,
  )
}

/** 한 타석 앞에서 `0xc1ba4` 를 다시 부르는 상한 — 대타 한 번 · 투수 한 번 · 마지막 빈 부름 */
const MAXIMUM_SUBSTITUTION_CALLS = 3

/** 동료 타석도 원본은 같은 간이 타석 엔진을 쓴다 — 우리 팀 명단의 실제 능력치가 들어간다 */
function playTeammateAtBat(progress: GameProgress, random: RandomPort): GameProgress {
  // 0xc262c 는 타석마다 먼저 0xc1ba4 를 부른다 — CPU 대타(공격 = 우리 팀, 0xc1c50) 뒤 CPU 투수 교체
  // (우리가 공격 중이니 **상대 투수**, 0xc1ce2). 하나라도 바뀌면 0xc262c 가 공 없이 돌아갔다가(c266c) 같은
  // 타석으로 0xc1ba4 를 다시 지난다 — 바뀐 쪽은 state[0xe]·state[0xd] 로 빠지고 안 바뀐 쪽은 다시 판정한다
  for (let call = 0; call < MAXIMUM_SUBSTITUTION_CALLS; call += 1) {
    const substituted = changeOpponentPitcher(applyOurCpuPinchHit(progress, random), random)
    if (substituted === progress) break
    progress = substituted
  }
  // 동료 타석은 자동진행(0x21) 안의 간이 타석이라 상태 0xf 를 안 지난다 — 돌발 굴림(0x8f158)·판정(0x8f414) 없음
  const opponentDefense = opponentQuickDefenseOf(progress)
  const mound = progress.opponentMound
  const pitched = perPitchDrainOf(opponentDefense, mound)
  const play = playQuickAtBat(
    teamBatterAt(progress, true, rosterSlotAt(progress.ourLineup, progress.game.battingOrderIndex)),
    // 간이 엔진이 보는 투수 체력은 체력%(0xaebb0)다 — 마운드의 살아 있는 값을 넘긴다
    { ...opponentDefense.pitcherAt(mound.pitcherSlot), stamina: staminaPercentOf(mound.stamina) },
    { inning: progress.game.inning },
    random,
    { beforePitch: pitched.beforePitch },
  )
  const outcome = play.outcome
  // 동료 타석은 원본도 간이 엔진(0xc262c)이 돌린다 — **간이 엔진에는 희생플라이가 없다** (E-2 확정).
  // 사람 타석과 달리 수비 시뮬레이션이 돌지 않으므로 `quickEngine` 갈래를 쓴다.
  const game = applyAtBatOutcome(
    progress.game,
    outcome,
    advanceRunners(progress.game.bases, outcome, progress.game.outs, { quickEngine: true }),
  )
  const runsBattedIn = game.ourScore - progress.game.ourScore
  const slot = progress.game.battingOrderIndex
  const recorded = recordBatterAtBat(
    progress.teammateLogs[slot] ?? EMPTY_BATTER_GAME_LOG,
    outcome,
    runsBattedIn,
  )
  // 간이 엔진 타석도 0xa8024 를 지난다 — 동료 홈런도 같은 팀 카운터로 이어 센다 (0xa794c)
  const backToBack = backToBackRecordOf({
    streak: progress.homeRunStreak,
    humanOffense: true,
    isHomeRun: outcome.kind === '홈런',
  })

  return appendLog(
    {
      ...progress,
      game,
      // 간이 엔진 득점(0xc0fb4·0xc1054)도 같은 0xa5c34 를 부른다
      decisions: decisionsAfterPlay(progress.decisions, progress.game, game, moundsOf(progress)),
      teammateLogs: { ...progress.teammateLogs, [slot]: recorded.log },
      ourLineup: recordLineupPlay(progress.ourLineup, slot, outcome),
      pitcherLines: chargePitcherLine(progress.pitcherLines, progress.opponentTeamId, mound.pitcherSlot, {
        outs: outsAddedBetween(progress.game, game),
        runsAllowed: runsBattedIn,
        strikeouts: outcome.kind === '삼진' ? 1 : 0,
      }),
      opponentMound: {
        ...mound,
        // 공마다 이미 깎았다 (위 `beforePitch`, 0xc262c 의 c26c8)
        stamina: pitched.stamina(),
        runsAllowed: Math.min(MAXIMUM_PITCHER_COUNTER, mound.runsAllowed + runsBattedIn),
        pitches: mound.pitches + play.pitches,
        // 투구마다 state[0xd] 가 내려간다 (0xa5e72)
        justChanged: false,
      },
      // 같은 0xa5e14 가 state[0xe](CPU 대타 막음)도 내린다 (a5e7c)
      pinchHitUsed: false,
      opponentInningRunsAllowed: Math.min(
        MAXIMUM_PITCHER_COUNTER,
        progress.opponentInningRunsAllowed + runsBattedIn,
      ),
      recordIds: [...progress.recordIds, ...recorded.recordIds, ...backToBack.recordIds],
      homeRunStreak: backToBack.streak,
      // 동료 타석도 우리 팀 선수 레코드에 쌓인다 — 타순 칸이 곧 로스터 칸이다 (`batterAt` 과 같은 자리)
      leaguePlateAppearances: [
        ...progress.leaguePlateAppearances,
        {
          teamId: progress.ourTeamId,
          battingOrderIndex: rosterSlotAt(progress.ourLineup, slot),
          outcome,
          runsBattedIn,
        },
      ],
    },
    `${progress.game.inning}회${progress.game.half} ${progress.game.battingOrderIndex + 1}번 — ${describeOutcome(outcome)}${
      runsBattedIn > 0 ? ` (${runsBattedIn}점)` : ''
    }`,
    false,
  )
}

/** 원본 실점 카운터 A·B 는 99 에서 자른다 (P7 E1) */
const MAXIMUM_PITCHER_COUNTER = 99

/** 팀 투수 여덟 칸 (`team+0x0c`) — 벤치는 여기서 마운드와 이미 쓴 투수를 뺀 나머지다 */
const ALL_PITCHER_SLOTS: readonly number[] = Array.from({ length: PITCHERS_PER_TEAM }, (_unused, slot) => slot)

/**
 * 간이 타석의 공 하나를 던지기 앞 — `0xc262c` 의 공 고리는 c26be 0xa5c2d → **c26c8 0xa5e14(소모)** → c26d4 경로 굴림
 * 차례라, 공 하나가 보는 체력%(0xaebb0)는 그 공의 소모까지 먹은 값이다 (반 이닝 엔진 `beforePitch` 와 같다, d9d376c).
 * 갈고리는 난수를 쓰지 않는다.
 */
function perPitchDrainOf(
  defense: HalfInningDefense,
  mound: HalfInningMound,
): { readonly beforePitch: () => QuickAtBatPitcher; readonly stamina: () => number } {
  let stamina = mound.stamina
  return {
    beforePitch: () => {
      stamina = drainQuickPitcher(defense, { ...mound, stamina }, 1)
      return { ...defense.pitcherAt(mound.pitcherSlot), stamina: staminaPercentOf(stamina) }
    },
    stamina: () => stamina,
  }
}

/** 칸 하나의 레코드 스태미나를 바꾼 표 */
function withStaminaAt(table: readonly number[], slot: number, stamina: number): readonly number[] {
  return table.map((value, index) => (index === slot ? stamina : value))
}

/** 반 이닝 안의 교체마다 내려간 투수 값을 표에 되적는다 */
function withOutgoingStaminas(
  table: readonly number[],
  changes: readonly { readonly outgoingPitcherSlot: number; readonly outgoingStamina: number }[],
): readonly number[] {
  return changes.reduce((current, change) => withStaminaAt(current, change.outgoingPitcherSlot, change.outgoingStamina), table)
}

/** 경기 끝 칸별 레코드 스태미나 — 표에 지금 마운드 값을 얹는다 */
function finalStaminasOf(table: readonly number[], mound: HalfInningMound): readonly number[] {
  return withStaminaAt(table, mound.pitcherSlot, mound.stamina)
}

/**
 * 한 팀의 수비 쪽 재료 (`HalfInningDefense`) — `leagueDay.defenseOf` 와 같은 모양이다.
 *
 * `bothTeamsAreCpu` 는 **거짓**이다: 모드 3·4 경기 준비 `0x3a20a` 가 `0xb6c18(state, 내 팀, 0)`·
 * `(state, 상대, 1)` 로 내 팀을 사람 팀으로 적는다 (R8 · S11). 그래도 마무리 투입 굴림 `0xac360` 은
 * **벤치에 마선수가 있을 때만(0xb8a8d)** 돈다 — 로스터 투수에는 마선수가 없어 이 경기에서는 안 굴러간다.
 *
 * 보직(`+0xb & 3`, 0xb6dec)은 로스터 칸 표 `rosterPitcherRoleOf`(칸 0~3 선발 · 4~6 중간 · 7 마무리)로 넘긴다 —
 * 판정 0xac428 이 마운드 보직을, 새 투수 고르기 0xabfcc 가 벤치 보직을 본다. 안 넘기면 모두 선발로 보여
 * 9회 이후 마무리 상황마다 매 타자 투수가 바뀐다(58066a1 뒤의 회귀).
 *
 * ⚠️ 팀 사기(`0x66e44` 의 `V[+2]`)는 이 화면이 들고 있지 않아 100 으로 본다 — **근사다**.
 */
function quickDefenseOf(
  teamId: number,
  mound: HalfInningMound,
  lead: number,
  /** 투수 레코드 차례 — 벤치를 이 차례로 훑는다 (`GameProgress.…PitcherOrder`) */
  order: readonly number[] = ALL_PITCHER_SLOTS,
  /** 칸별 레코드 스태미나 — 벤치 투수는 이 값으로 올라온다 */
  staminas?: readonly number[],
  /** 142 가 명부 8번 칸에 넣은 마투수 (`order` 에 8 이 들어 있다) */
  ace?: GameAcePitcher,
): HalfInningDefense {
  const roster = teamPitchers(teamId)
  const isAce = (slot: number) => ace !== undefined && slot === ACE_PITCHER_SLOT
  return {
    mound,
    pitcherSlots: order,
    ...(staminas === undefined ? {} : { staminaAt: (slot: number) => staminas[slot] ?? FULL_STAMINA }),
    pitcherAt: (slot) => (isAce(slot) && ace !== undefined ? ace.quick : quickPitcherOf(roster[slot % roster.length])),
    // 투수 능력치 순서는 제구·구속·변화·**체력** (칸 3)
    staminaAbilityAt: (slot) =>
      isAce(slot) && ace !== undefined ? ace.staminaAbility : roster[slot % roster.length].ability[3],
    lead,
    bothTeamsAreCpu: false,
    roleAt: rosterPitcherRoleOf,
    // 마무리 갈래(ac0be)의 정렬 열쇠 0xb5b50 = 0xb570c(팀, k, P, 1, 90, 1) 네 칸 합. 모드 4 는 0xb574a 가지가 내 육성
    // 선수(0xb6388)에만 붙고 팀 능력치(0x306)·코치(모드 2) 정액이 없어 로스터 밑값을 0..999 로 자른 합이다
    abilitySumAt: (slot) =>
      isAce(slot) && ace !== undefined
        ? pitcherAbilitySumOf([ace.control, ace.velocity, ace.breaking, ace.staminaAbility].map(clampAbility))
        : pitcherAbilitySumOf(roster[slot % roster.length].ability.map(clampAbility)),
    // 마선수 0xb633c(+0xa 비트6) — 마투수 8번 칸. 마운드면 특수 문턱(ac4f2), 벤치에 있으면 0xb8a8d 가 참이라
    // 마무리 굴림 0xac360 을 지나고, 0xabfcc 는 고르지 않는다 (`leagueDay.defenseOf` 와 같다). 보직은 칸 8 이 표 밖이라 없다
    isSpecialPitcherAt: isAce,
  }
}

/** 0xb5b06 — 경기용 능력치를 0..999 로 자른다 */
const clampAbility = (value: number) => Math.min(999, Math.max(0, value))

/** 우리가 공격 중일 때 상대 팀 수비 — 리드는 상대 점수 − 우리 점수 */
function opponentQuickDefenseOf(progress: GameProgress): HalfInningDefense {
  return quickDefenseOf(
    progress.opponentTeamId,
    progress.opponentMound,
    progress.game.opponentScore - progress.game.ourScore,
    progress.opponentPitcherOrder,
    progress.opponentPitcherStaminas,
    teamAcePitcherOf(progress, false),
  )
}

/**
 * 동료 간이 타석 시작의 **CPU 대타** `0xac228` — 공격 팀(우리)을 두고 한 번 물어본다 (`0xc1c50`).
 *
 * 들어오면 그 타순 칸의 이 경기 기록도 들어온 선수 것(벤치라 비어 있다)으로 바뀐다 — 원본은
 * 24바이트 기록을 선수와 함께 옮긴다 (`aed02~aed16`). 그래서 동료 기록(`teammateLogs`)도 그
 * 칸을 비운다.
 */
function applyOurCpuPinchHit(progress: GameProgress, random: RandomPort): GameProgress {
  if (progress.game.isFinished) return progress
  const slot = progress.game.battingOrderIndex
  const pinch = tryQuickCpuPinchHit(
    progress.ourLineup,
    slot,
    { alreadyUsedThisGame: progress.pinchHitUsed, runnerCount: runnerCountOf(progress.game.bases) },
    random,
  )
  if (pinch === null) return progress
  const teammateLogs = { ...progress.teammateLogs }
  delete teammateLogs[slot]
  return appendLog(
    {
      ...progress,
      ourLineup: pinch.lineup,
      // state[0xe] = 1 (ac33e) — 다음 공(0xa5e14 a5e7c)이 나갈 때까지 다시 묻지 않는다
      pinchHitUsed: true,
      teammateLogs,
    },
    `${progress.game.inning}회${progress.game.half} ${slot + 1}번 CPU 대타`,
    false,
  )
}

/**
 * 우리 공격 타석 하나를 시작하기 전에 **상대 투수**를 바꿀지 본다 — `0xac428` 한 번.
 *
 * 부르는 자리는 원본 둘이다: 동료 타석(간이 엔진 `0xc1ba4` 의 `0xc1ce2`)과 내 타석 시작
 * (`0x3d954` 의 `0x3da3e` — 수비가 CPU 이고 `0x66864` 가 참일 때. 리그 경기는 미션이 아니라 참이다).
 * 바꾸면 카운터(+0x27c·+0x280·+0x284)가 한꺼번에 0 이 된다 (교체 0xaec64).
 */
function changeOpponentPitcher(progress: GameProgress, random: RandomPort): GameProgress {
  if (progress.game.isFinished) return progress
  const before = progress.opponentMound
  const after = changePitcherIfNeeded(opponentQuickDefenseOf(progress), before, {
    // 원본 이닝은 0-기준이다 (state+0x6b)
    inningIndex: progress.game.inning - 1,
    lead: progress.game.opponentScore - progress.game.ourScore,
    runnerCount: runnerCountOf(progress.game.bases),
    inningRunsAllowed: progress.opponentInningRunsAllowed,
    random,
  })
  if (after === before) return progress
  return appendLog(
    {
      ...progress,
      opponentMound: after,
      // 내려간 투수의 +0x2c 는 레코드에 남는다 — 다음 경기(리그 표)로 이어진다
      opponentPitcherStaminas: withStaminaAt(progress.opponentPitcherStaminas, before.pitcherSlot, before.stamina),
      // 그 투수의 투구 수(+0x27c)를 줄에 얹는다 — 교체 0xaec64 가 0 으로 돌린다
      pitcherLines: chargePitcherLine(progress.pitcherLines, progress.opponentTeamId, before.pitcherSlot, {
        pitches: before.pitches,
      }),
      opponentInningRunsAllowed: 0,
      // 교체 자리에서 세이브 후보를 잡는다 (0xa60c0 — 수비 측 = 상대)
      decisions: decisionsAfterPitcherChange(progress.decisions, progress.game, {
        our: progress.ourMound.pitcherSlot,
        opponent: after.pitcherSlot,
      }),
    },
    `${progress.game.inning}회${progress.game.half} 상대 투수 교체`,
    false,
  )
}

/** 측별 지금 마운드 투수 칸 — 승·패·세 칸이 "그 순간 마운드에 선 투수" 로 적는다 */
function moundsOf(progress: GameProgress): MoundBySide {
  return { our: progress.ourMound.pitcherSlot, opponent: progress.opponentMound.pitcherSlot }
}

/**
 * 상대 공격 반 이닝(간이 엔진)의 승·패·세 칸 — 교체 자리를 경계로 점수를 나눠 한 점씩 먹인다.
 * 교체 전 점수는 이전 투수, 교체 뒤 점수는 새 투수가 마운드에 있을 때 난 것이다 (0xc26a2 → 0xa60c0).
 */
function opponentHalfDecisionsOf(
  progress: GameProgress,
  runs: number,
  changes: readonly HalfInningPitcherChange[],
): DecisionState {
  let decisions = progress.decisions
  let ourSlot = progress.ourMound.pitcherSlot
  let counted = 0
  const scoredGame = (scored: number): GameState => ({
    ...progress.game,
    opponentScore: progress.game.opponentScore + scored,
  })
  for (const change of changes) {
    decisions = decisionsAfterRuns(decisions, scoredGame(counted), change.runsBefore - counted, {
      our: ourSlot,
      opponent: progress.opponentMound.pitcherSlot,
    })
    counted = change.runsBefore
    ourSlot = change.pitcherSlot
    decisions = decisionsAfterPitcherChange(
      decisions,
      scoredGame(counted),
      { our: ourSlot, opponent: progress.opponentMound.pitcherSlot },
      change.outs,
      change.runnerCount,
    )
  }
  return decisionsAfterRuns(decisions, scoredGame(counted), runs - counted, {
    our: ourSlot,
    opponent: progress.opponentMound.pitcherSlot,
  })
}

/**
 * 결과 판 세 줄(승리투수·패전투수·세이브)의 이름 — 상태 0x18 그리기 0x4fe9c 가 state+0x44/0x50/0x5c 를
 * 거르지 않고 그대로 읽는다. 측 2(없음)면 그 줄은 빈다.
 */
export function pitchersOfRecordOf(progress: GameProgress): PitcherOfRecordNames {
  return pitcherOfRecordNamesOf(progress.decisions, progress.game.playerSide, (isOurTeam, slot) =>
    slot === ACE_PITCHER_SLOT && teamAcePitcherOf(progress, isOurTeam) !== undefined
      ? teamAcePitcherOf(progress, isOurTeam)?.player.name
      : teamPitchers(isOurTeam ? progress.ourTeamId : progress.opponentTeamId)[slot]?.name,
  )
}

function appendLog(progress: GameProgress, text: string, isMine: boolean): GameProgress {
  const entry: GameLogEntry = { id: progress.nextLogId, text, isMine }

  return {
    ...progress,
    log: [entry, ...progress.log].slice(0, MAXIMUM_LOG_LENGTH),
    nextLogId: progress.nextLogId + 1,
  }
}

/**
 * 내 타순 칸의 필살 남은 횟수 `0xaea30(팀)` — 아직 안 채웠으면 `0xaebe4` 가 채울 값으로 읽는다.
 *
 * ```
 * aef28  B = 0xae89c(팀) ; B+0x18 == 0 → 0xae9e8(팀, 0)
 * aef36  0xaea30(팀) ≥ 0 → 그대로
 * aef3e  마타자(0xb633d) → s8 0xd84fa[레벨] · 아니면 u8 0xd84f0[B+0x18]   ; 내 선수는 마선수가 아니다
 * aefec  0xb62b4(B, 0x17) 무자비(장착 비트) → +1
 * ```
 */
export function mySpecialSwingRemainingOf(
  progress: GameProgress,
  batter: {
    /** 고른 필살 번호 (선수 +0x18) */
    readonly swingNumber: number
    /** 타자 스킬 23 무자비 장착 */
    readonly hasRuthlessSkill: boolean
  },
): number {
  if (progress.specialSwingRemaining >= 0) return progress.specialSwingRemaining
  return specialSwingCountOf({
    swingNumber: batter.swingNumber,
    isAceBatter: false,
    hasRuthlessSkill: batter.hasRuthlessSkill,
  })
}

/**
 * 필살 스윙이 나간 틱 `0x4e136` — `0xae9e8(팀, 남은 − 1)`. 줄인 값은 타석 그림(`BattingStage.onSpecialSwingUsed`)이
 * `remainingAfterSpecialSwing` 으로 이미 계산해 넘긴다. 난수 없음.
 */
export function spendMySpecialSwing(progress: GameProgress, remaining: number): GameProgress {
  if (progress.specialSwingRemaining === remaining) return progress
  return { ...progress, specialSwingRemaining: remaining }
}

/**
 * **도루 출발** — 공이 나는 동안(상태 0x11) 사람 키 '3'·'2'·'1'(`0x53610` → 메시지 0x583 → `0xa9bd4`).
 *
 * `base` 는 **대상 주자가 선 루**다. 주자를 출발만 시킨다 — 성공·실패는 공이 도착한 뒤(`arrivePitch`) 여는
 * 도루 판(종류 5)에서 포수 송구와 주자 도착이 겨뤄 정한다(`features/defense-play/model/stealPlay`).
 * 간이 엔진 표 0xd9064 는 CPU 끼리 경기 전용이라 여기서는 안 쓴다. 3루 주자도 홈으로 뛴다(0xb6228).
 * 받아들이는 문턱은 `canStartSteal`(0xa97a0 · 0xa9924 앞길 검사) — 같은 투구에 앞 주자가 이미 출발했으면 겹도루.
 * **난수 없음.**
 *
 * 원본은 상태 0x11(공이 나는 동안)에만 키를 받는다 — 화면(`GameScreen`)이 타석 화면의 비행 판정
 * (`BattingStage.flightProbeRef`, 스윙·번트 키와 같은 `isFlying`)으로 거른 뒤에만 부른다.
 */
export function startSteal(progress: GameProgress, base: StealBase): GameProgress {
  const { game } = progress
  if (game.isFinished || !isPlayerTurn(game) || progress.pendingDefensePlay !== null) return progress
  const stealingFrom = startHumanSteal(game.bases, progress.stealingFrom, base)
  if (stealingFrom === progress.stealingFrom) return progress
  return { ...progress, stealingFrom }
}

/** 지금 출발시킬 수 있는 루 — 화면의 도루 키 안내용 (`canStartSteal`) */
export function stealableBasesOf(progress: GameProgress): readonly StealBase[] {
  const { game } = progress
  if (game.isFinished || !isPlayerTurn(game) || progress.pendingDefensePlay !== null) return []
  return ([1, 2, 3] as const).filter(
    (base) => startHumanSteal(game.bases, progress.stealingFrom, base) !== progress.stealingFrom,
  )
}

/** 공 도착 한 걸음의 결과 */
export interface PitchArrivalStep {
  readonly progress: GameProgress
  /** 열린 주자 판 (종류 9 폭투·포일 · 종류 5 도루). 없으면 null */
  readonly play: PitchArrivalPlay | null
  /** 판에서 반 이닝·경기가 끝나 이 타석이 끊겼다 — 타석 결과를 먹이지 말고 타석을 새로 시작한다 */
  readonly interrupted: boolean
}

/**
 * **공 도착** — 상태 0x12 진입 `0x3dfac` (`features/defense-play/model/pitchArrivalPlay`).
 *
 * 내 타석의 공 하나가 판정된 뒤 타석 결과를 먹이기 **앞**에 부른다. `outcomeAfter` 는 이 공을 먹인 뒤의 타석 결과
 * (볼넷·삼진·사구면 그 결과, 아니면 null) — 투구 판정 v(0x9d57c)를 고르는 데 쓴다.
 * - 맞힌 공(파울·타구)은 0x3dfac 를 안 지난다. 파울이면 출발이 풀리고, 타구면 출발 칸을 타구 판이 읽는다.
 * - 못 맞힌 공: `rollPassedBall` 1번 → 종류 9(폭투·포일) / 종류 5(도루) / 없음.
 *   판이 열리면 그 advance 를 견제와 같은 주자 판 꼴(타순 그대로)로 먹이고 재생 칸(`lastDefensePlay`)에 넣는다.
 *   낫아웃(종류 9 + 삼진 + 타자주자)만은 여기서 안 먹인다 — `startPlayerOutcome` 의 `arrivalPlay` 로 넘기면 그 판의
 *   advance 가 곧 삼진 타석의 진루가 된다.
 * - 기록: 도루 판의 8(도루 성공)은 사람 공격이라 0xa77f0 게이트를 지나고 24(도루 저지)는 버려진다.
 * - 판정 칸은 판 **앞**에서 먹는다(0x3dfac 의 스위치 0x3e11a — `pitchArrivalPlay` 머리말): 볼넷·사구 + 도루면 종류가
 *   2(밀어내기)로 덮여 도루 판이 없고, 삼진 + 도루면 판은 아웃 + 1 로 열린다(삼진 아웃은 판 뒤 보통 길이 더해 합이 같다).
 *   판에서 3아웃이 나는 것은 카운트만 오른 공뿐이라 끊긴 타석의 볼넷·삼진은 없다(`interrupted`).
 *
 * 난수: `rollPassedBall` 1번(매 못 맞힌 공) → 판이 열리면 그 안의 굴림 (`runPitchArrivalPlay`).
 */
export function arrivePitch(
  progress: GameProgress,
  pitch: { readonly resolution: PitchResolution; readonly outcomeAfter: AtBatOutcome | null },
  random: RandomPort,
): PitchArrivalStep {
  const before = progress.game
  if (before.isFinished || !isPlayerTurn(before) || progress.pendingDefensePlay !== null) {
    return { progress, play: null, interrupted: false }
  }
  if (!arrivesUnhit(pitch.resolution)) {
    const next = pitch.resolution.kind === '타구' ? progress : withoutSteal(progress)
    return { progress: next, play: null, interrupted: false }
  }
  const cleared = withoutSteal(progress)
  const play = runPitchArrivalPlay(
    {
      gameMode: MY_LEAGUE_BATTER_MODE,
      pitchJudgement: pitchJudgementOf(pitch.resolution, pitch.outcomeAfter),
      stealingFrom: progress.stealingFrom,
      bases: before.bases,
      outs: before.outs,
      // 우리 공격이니 수비는 상대 팀 — 타구 진행기와 같은 아홉 칸
      defenseAbilities: opponentDefenseAbilitiesOf(progress),
      runAbilities: runAbilitiesOnBaseOf(progress),
      defenseIsCpu: true,
      // 타자편은 사람이 늘 공격이다 — 환경설정 "주루" 혼자가 자동 진루 제어기를 켠다 (0xae690)
      offenseIsCpu: false,
      runningMode: progress.runningModeManual ? '수동' : '자동',
    },
    random,
  )
  if (play === null) return { progress: cleared, play: null, interrupted: false }
  if (arrivalApplicationOf(play) === 'batterRuns') return { progress: cleared, play, interrupted: false }

  let next = withRunnerOnlyPlay(cleared, play.result)
  const recordIds = gatedOffenseRecords(play.recordIds)
  if (recordIds.length > 0) next = { ...next, recordIds: [...next.recordIds, ...recordIds] }
  next = appendLog(next, `${before.inning}회${before.half} ${describeArrivalPlay(play)}`, true)
  const interrupted =
    next.game.isFinished || next.game.inning !== before.inning || next.game.half !== before.half
  if (interrupted && !next.game.isFinished) next = advanceUntilPlayerTurn(next, random)
  return { progress: next, play, interrupted }
}

function describeArrivalPlay(play: PitchArrivalPlay): string {
  const runs = play.result.advance.runsScored
  const tail = runs > 0 ? ` (${runs}점)` : ''
  if (play.kind === 9) return `폭투·포일${tail}`
  if (play.result.caughtFrom.length > 0) return `도루 실패 — 아웃${tail}`
  if (play.result.stolenFrom.length > 0) return `도루 성공${tail}`
  return `도루${tail}`
}

function withoutSteal(progress: GameProgress): GameProgress {
  return progress.stealingFrom.length === 0 ? progress : { ...progress, stealingFrom: [] }
}

/**
 * 루별 주자 주루 — ⚠️ **근사**: 웹 `GameState` 는 루에 선 주자가 누구인지 모른다. 1루 주자 = 직전 타자 ·
 * 2루 = 그 앞 · 3루 = 그 앞으로 타순을 거꾸로 세어 꺼낸다 (예전 도루 표 굴림과 같은 근사).
 */
function runAbilitiesOnBaseOf(progress: GameProgress): Partial<Record<0 | 1 | 2 | 3, number>> {
  const runOf = (slotsBack: number) => {
    const slot = (progress.game.battingOrderIndex - slotsBack + BATTING_ORDER_SIZE) % BATTING_ORDER_SIZE
    return teamBatterAt(progress, true, rosterSlotAt(progress.ourLineup, slot)).run
  }
  return { 0: runnerRunAbilityOf(progress), 1: runOf(1), 2: runOf(2), 3: runOf(3) }
}

/**
 * 주자만 움직인 판(견제 종류 4 · 도루 종류 5 · 폭투 종류 9)의 advance 를 먹인다 — 타석이 끝난 것이 아니라
 * 타순 커서는 그대로다. 득점은 상대 투수 실점 A·B 에 붙는다(득점 처리 0xa5c34). 재생 칸에 판을 넣는다.
 */
function withRunnerOnlyPlay(progress: GameProgress, result: DefensePlayResult): GameProgress {
  const before = progress.game
  let next: GameProgress = { ...progress, lastDefensePlay: result }
  const advance = result.advance
  const changed =
    advance.outsAdded > 0 ||
    advance.runsScored > 0 ||
    advance.bases.first !== before.bases.first ||
    advance.bases.second !== before.bases.second ||
    advance.bases.third !== before.bases.third
  if (!changed) return next
  // 결과 코드는 precomputed 가 있으면 안 읽는다
  const game: GameState = {
    ...applyAtBatOutcome(before, RUNNER_PLAY_OUTCOME_PLACEHOLDER, advance),
    battingOrderIndex: before.battingOrderIndex,
  }
  const runs = game.ourScore - before.ourScore
  next = {
    ...next,
    game,
    decisions: decisionsAfterPlay(next.decisions, before, game, moundsOf(next)),
    // 주자 판(견제·도루)도 정산 0xa8024 를 지난다 — 아웃·실점을 지금 상대 마운드 투수에게
    pitcherLines: chargePitcherLine(next.pitcherLines, next.opponentTeamId, next.opponentMound.pitcherSlot, {
      outs: outsAddedBetween(before, game),
      runsAllowed: runs,
    }),
    opponentMound: {
      ...next.opponentMound,
      runsAllowed: Math.min(MAXIMUM_PITCHER_COUNTER, next.opponentMound.runsAllowed + runs),
    },
    opponentInningRunsAllowed: Math.min(MAXIMUM_PITCHER_COUNTER, next.opponentInningRunsAllowed + runs),
  }
  return next
}

/**
 * **CPU 투수의 견제** — 내 타석에서 상대(CPU) 투수 AI 가 목표점 대신 견제를 골랐다.
 *
 * ## 원본 길 (모드 4 에서도 돈다 — 확정)
 * - CPU 조작 객체(vtable `0xd0a60`, 슬롯 3 = `0x53874`)가 수비일 때 이벤트 0xf 에 메시지 **0x644**(`0x53850`),
 *   0x10 에 **0x645**(`0x53824`, `[+0x18] > 5`)를 보낸다. 모드는 안 본다.
 * - 경기 장면 메시지 처리기 `0x509a0` 은 비교 나무다: `0x50b1e~0x50b24` 0x5de+0x66 = **0x644 → 0x51212**
 *   (`0x344dc` 구질), `0x50ae0~0x50ae6` 0x6a9−0x64 = **0x645 → 0x5121c**(`0x345fc` 목표점). 여기도 모드 갈림이 없다.
 * - `0x345fc` 의 모드 갈림은 `0x3460e` `+0x1104 == 7`(홈런더비) 하나뿐 → 모드 4 에서는 목표 종류 4 가
 *   `0x34848` 견제(rand(1,4) 를 주자 있는 루까지 반복 → 메시지 0x10)로 간다 (I-controls 4a-2).
 * - 메시지 0x10 → `0x50f28` → 플레이 종류 4 · 상태 0x17 → 판 끝 `0xae3e8`: 아웃 ≤ 2 면 **같은 타석 다음 공(0xf)**,
 *   정산 `0xa8024` 는 불리지만 종류 4 라 타석 칸(+0x14)이 안 오른다.
 *
 * 여기는 **그 루가 정해진 뒤**다 — 루 굴림은 타석 화면(`selectPitch` 의 `cpuPickoff`)이 이미 했다.
 * 볼카운트·타순·투구 수·스태미나는 그대로다(공을 안 던졌다 — `throwOpponentPitch` 를 안 부른다).
 * 수비는 상대 팀, 주루는 환경설정 "주루"(`0xae690` 둘째 항, 타자편은 사람이 늘 공격).
 * 난수는 견제 판 안의 **악송구 굴림(0xa1828) 1번 · 악송구면 +2번**뿐이다.
 *
 * 내 타석이 아니거나(경기 끝·수비 진행 중) 그 루가 비었으면 아무 일도 없다 — 같은 객체를 돌려준다
 * (`0x34848` 은 주자 있는 루가 나올 때까지 굴리므로 빈 루가 들어오면 부르는 쪽 잘못이다).
 *
 * ⚠️ 미해결·근사 (`teamGameFlow.cpuPickoff` 와 같은 자리)
 * - 견제사·진루·득점이 나면 루·아웃·점수·반 이닝 교대와 상대 투수 실점 A·B 에는 먹이지만, 0xa8024 의 나머지 칸
 *   (평판 16칸·리그 기록·돌발 판정 0x8f414)이 견제 판에서 어떻게 도는지는 손대지 않았다.
 * - 원본은 0xf 에 다시 들어서며 `0x3d954` 가 CPU 투수 교체(0xac428)를 다시 부른다 — 웹은 공마다도 안 다시 부르는
 *   기존 근사라 견제 뒤에도 안 부른다 (반 이닝이 바뀌어 내 타석이 끊긴 때만 `advanceUntilPlayerTurn` 이 부른다).
 * - 3아웃으로 내 타석이 끊기면 타순 커서를 안 민다(타석이 안 끝났다) — 다음 이닝 나부터 다시 선다.
 */
export function cpuPickoff(progress: GameProgress, base: PickoffBase, random: RandomPort): GameProgress {
  const before = progress.game
  if (before.isFinished || !isPlayerTurn(before) || progress.pendingDefensePlay !== null) return progress
  if (!(base === 1 ? before.bases.first : base === 2 ? before.bases.second : before.bases.third)) return progress

  const result: PickoffPlayResult = runPickoffPlay({
    targetBase: base,
    bases: before.bases,
    outs: before.outs,
    // 우리 공격이니 수비는 상대 팀이다 — 타구 진행기와 같은 아홉 칸·같은 주루 근사
    defenseAbilities: opponentDefenseAbilitiesOf(progress),
    runAbility: runnerRunAbilityOf(progress),
    random,
    // 타자편은 사람이 늘 공격이다 — 환경설정 "주루" 혼자가 자동 진루 제어기를 켠다 (0xae690)
    offenseIsCpu: false,
    runningMode: progress.runningModeManual ? '수동' : '자동',
    // 수비는 CPU 다 — 슬롯 2 의 0xae6c8 첫 항(경기[0x31 + 수비측] == 1)이 서서 받은 야수의 0xafa60 이 매 틱 돈다 (d80918a)
    defenseIsCpu: true,
  })

  // 정산 0xa8024 — 종류 4 라 타석 칸(+0x14)이 안 오르고 안타·홈런 가지도 안 선다 (pinchHitAi 게이트)
  const slot = lineupSlotOf(before.battingOrderIndex)
  const records = [...progress.ourLineup.records]
  records[slot] = recordPlateAppearance(records[slot] ?? EMPTY_BATTER_GAME_RECORD, {
    isHit: false,
    isHomeRun: false,
    playKind: PICKOFF_PLAY_KIND,
  })
  // 득점 처리 0xa5c34 는 1점마다 수비 팀 실점 A·B 와 승·패·세 칸을 고친다 (내 타석 정산과 같은 칸)
  let next = withRunnerOnlyPlay({ ...progress, ourLineup: { ...progress.ourLineup, records } }, result)
  const runs = next.game.ourScore - before.ourScore

  const call = result.resultCode === PICKOFF_RESULT.OUT ? '견제사' : result.errantThrow ? '악송구' : '세이프'
  next = appendLog(
    next,
    `${before.inning}회${before.half} 상대 ${base}루 견제 — ${call}${runs > 0 ? ` (${runs}점)` : ''}`,
    true,
  )
  // 같은 타석이 이어지면(상태 0xf) 그대로 돌려준다. 반 이닝이 바뀌었거나 끝났으면 다음 내 차례까지 넘긴다
  return isPlayerTurn(next.game) && !next.game.isFinished ? next : advanceUntilPlayerTurn(next, random)
}

/** `applyAtBatOutcome` 은 `precomputed` 를 받으면 결과 코드를 안 읽는다 — 주자 판에는 타석 결과가 없어 자리만 채운다 */
const RUNNER_PLAY_OUTCOME_PLACEHOLDER: AtBatOutcome = { kind: '아웃', detail: '땅볼아웃' }

/** 사람 팀(우리)이 공격 중인 정산의 0xa77f0 게이트 — 타자편 사람 쪽 플레이는 늘 이 방향이다 */
function gatedOffenseRecords(recordIds: readonly number[]): number[] {
  return recordIds.filter((id) => passesRecordTeamGate(id, { offenseIsHuman: true, defenseIsHuman: false }))
}

export function summaryOf(progress: GameProgress): GameSummary {
  return {
    result: resultOf(progress.game),
    ourScore: progress.game.ourScore,
    opponentScore: progress.game.opponentScore,
    stats: progress.myStats,
    popularityPoints: progress.popularityPoints,
    recordIds: [
      ...progress.recordIds,
      ...gameEndRecordIdsOf(progress.game.ourScore - progress.game.opponentScore),
      ...completeGameRecordIdsOf({
        // 나만의리그 타자편 = 원본 모드 4 → 0xa7de8 이 완투 계열을 아예 주지 않는다 (R8 6절)
        mode: MY_LEAGUE_BATTER_MODE,
        won: progress.game.ourScore > progress.game.opponentScore,
        // 타자편에는 사용자가 투구 코스를 찍는 순간이 없다 → state+0x8c 는 늘 0
        pitchCourseConfirmed: false,
        inningsPlayed: progress.game.inning,
        outsRecorded: progress.pitching.outsRecorded,
        hitsAllowed: progress.pitching.hitsAllowed,
        walksAllowed: progress.pitching.walksAllowed,
        runsAllowed: progress.game.opponentScore,
      }),
    ],
    doublePlays: progress.doublePlays,
    scoringPositionOuts: progress.scoringPositionOuts,
    reputationCounts: progress.reputationCounts,
    ourTeamId: progress.ourTeamId,
    opponentTeamId: progress.opponentTeamId,
    // 마타자(명단 밖 저장 레코드)는 리그 선수 기록표에 없다 — CPU 끼리 경기(`leagueDay`)와 같이 뺀다
    leaguePlateAppearances: progress.leaguePlateAppearances.filter(
      (appearance) => appearance.battingOrderIndex !== ACE_BATTER_ROSTER_SLOT,
    ),
    pitchersOfRecord: pitchersOfRecordOf(progress),
    // 리그 투수 기록 재료 — 투수 줄(상대 마운드의 투구 수를 얹어)과 경기 끝 판정 0xa7de8
    leaguePitchers: {
      lines: chargePitcherLine(progress.pitcherLines, progress.opponentTeamId, progress.opponentMound.pitcherSlot, {
        pitches: progress.opponentMound.pitches,
      }),
      decision: gameEndDecisionOf(progress.decisions),
      sideTeams:
        progress.game.playerSide === 0
          ? [progress.ourTeamId, progress.opponentTeamId]
          : [progress.opponentTeamId, progress.ourTeamId],
    },
    // 양 팀 레코드 +0x2c — 경기에서 깎인 값이 리그 표로 이어진다 (하루 끝 0xb617c 회복은 부르는 쪽)
    // 로스터 칸(0~7)만 리그 표로 잇는다 — 8번(마투수)은 다음 142 의 0xb88c8 이 저장 레코드(+0x2c 포함)로 다시 덮는다
    pitcherStaminas: {
      ours: finalStaminasOf(progress.ourPitcherStaminas, progress.ourMound).slice(0, PITCHERS_PER_TEAM),
      opponent: finalStaminasOf(progress.opponentPitcherStaminas, progress.opponentMound).slice(0, PITCHERS_PER_TEAM),
    },
  }
}

