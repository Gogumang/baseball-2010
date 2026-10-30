import type { RandomPort } from '@/shared/api/random/randomPort'
import { PLAYER_BATTING_ORDER_INDEX, type PlayerSide, PLAYER_SIDE_LAST_BAT, createGame, isPlayerTurn } from '@/entities/game/model/gameState'
import { opponentOf } from '@/entities/league/model/league'
import { type GameAceSetup, NO_GAME_ACES, withAceBatterLineup } from '@/features/play-game/model/gameAces'
import { type QuickLineup, rosterLineupOf } from '@/entities/game/model/quickLineup'
import { type TeamRecordEquipment, BATTERS_PER_TEAM, teamBatters } from '@/entities/team/model/teamRoster'
import { FRESH_HELD_CPU_MAGIC } from '@/entities/pitching/model/magicPitchGame'
import { EMPTY_SEASON_STATS } from '@/entities/career/model/seasonStats'
import { EMPTY_REPUTATION_COUNTS } from '@/entities/career/model/gameEvaluation'
import { SCENE_RESULT_CODE_START } from '@/features/defense-play/model/sceneResultCode'
import { createBurstSession } from '@/entities/burst-mission/model/burstMissionSession'
import { EMPTY_DECISION_STATE } from '@/entities/game/model/winLossSave'
import { openScenePatternDeck } from '@/entities/batting/model/battedBallOutcome'
import { rollSimulatorInit } from '@/entities/game/model/simulatorInit'
import { rollHalfInningFielders } from '@/features/play-game/model/halfInningBoard'
import { fielderRecordsAfterBoard } from '@/entities/fielding/model/fielderRecords'
import { advanceUntilPlayerTurn } from '@/features/play-game/model/gameFlow/autoPlay/advance'
import { opponentFielderSeatOf } from '@/features/play-game/model/gameFlow/defense/opponentFielders'
import { MY_LEAGUE_BATTER_MODE, UNFILLED_SPECIAL_SWING_COUNT } from '@/features/play-game/model/gameFlow/types/constants'
import type { GameProgress } from '@/features/play-game/model/gameFlow/types/progress'

/**
 * 리그 팀 수. StrHOWTO[7] "기본 10개 팀과 히든 5팀" — 히든 5팀(국가대표 4팀·외인구단, 원본 10~14)은
 * 리그 상대가 아니다. 상대는 자기 팀을 뺀 기본 팀에서 고른다.
 */

import { gamePitchingOf, type GamePitcherSetup } from '@/features/play-game/model/gameFlow/setup/startGame/gamePitching'

export type { GamePitcherSetup }

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
   * ⚠️ 근사(남김 — 웹 구조 · 결과는 같다): 원본은 이 칸을 매 틱 다시 읽지만(`0x5261c`), 웹은 경기를 세울 때 한 번 받아
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
  /** 내 선수의 주력 (`GameProgress.myRunAbility`) — 첫 내 차례 앞 동료 타석의 도루 판정부터 본다 */
  myRunAbility?: number,
  /** 두 팀 레코드 사기 = 지금 나리 사기 0xa3a24 (`GameProgress.teamMorale`). 안 넘기면 팀마다 표값 */
  teamMorale?: number,
  /** 상대 팀 레코드 +2 의 앞 값 (`GameProgress.opponentStaleMorale`) — 상대 레코드가 이 경기에서 아직 안 덮였을 때만 본다. 안 넘기면 없다 */
  opponentStaleMorale?: number,
  /** 상대 팀 레코드 장비 니블 (`GameProgress.opponentEquipment`) — 안 넘기면 Xls 행 그대로 */
  opponentEquipment?: TeamRecordEquipment,
): GameProgress {
  const initial = initialProgressOf({
    ourTeamId,
    battingOrder,
    opponentTeamId,
    playerSide,
    runningModeManual,
    pitching: gamePitchingOf(pitchers, aces, dayCounter),
    aces,
    ourRecordLineup,
    optional: { myRunAbility, teamMorale, opponentStaleMorale, opponentEquipment },
  })
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
  const fielderRolls = rollHalfInningFielders(random)
  return {
    ...progress,
    halfInningBoard: { serial: 1, inning: progress.game.inning, half: progress.game.half, fielderRolls },
    // 같은 틱의 0x3fac4 3fe0a~3fe4c — 판의 수비 팀(내 팀이 공격이니 상대) 레코드 차례로 야수 아홉의 +0xec 를 적는다
    fielderRecords: fielderRecordsAfterBoard(progress.fielderRecords, teamBatters(progress.opponentTeamId), (index) =>
      opponentFielderSeatOf(progress, index),
    ),
  }
}

interface InitialProgressArgs {
  readonly ourTeamId: number
  readonly battingOrder: number
  readonly opponentTeamId: number
  readonly playerSide: PlayerSide
  readonly runningModeManual: boolean
  readonly pitching: ReturnType<typeof gamePitchingOf>
  readonly aces: GameAceSetup | undefined
  readonly ourRecordLineup: QuickLineup | undefined
  readonly optional: OptionalSessionFields
}

interface OptionalSessionFields {
  readonly myRunAbility: number | undefined
  readonly teamMorale: number | undefined
  readonly opponentStaleMorale: number | undefined
  readonly opponentEquipment: TeamRecordEquipment | undefined
}

/** 부르는 쪽이 넘긴 칸만 싣는다 */
function optionalSessionFieldsOf(optional: OptionalSessionFields): Partial<GameProgress> {
  const { myRunAbility, teamMorale, opponentStaleMorale, opponentEquipment } = optional
  return {
    ...(myRunAbility === undefined ? {} : { myRunAbility }),
    ...(teamMorale === undefined ? {} : { teamMorale }),
    // 상대 첫 투수 첫 공은 이 경기에서 상대 레코드가 아직 안 덮였으면 앞 값을 본다(`opponentRecordMorale` 이 없을 때만).
    // 상대가 후공이면 1회초 첫 공, 선공이면 1회초 공격(자동진행)에서 한 번도 안 덮였을 때의 1회말 첫 공이다 (r104)
    ...(opponentStaleMorale === undefined ? {} : { opponentStaleMorale }),
    ...(opponentEquipment === undefined ? {} : { opponentEquipment }),
  }
}

/** 경기 시작 진행 — 굴림 없음 */
function initialProgressOf(args: InitialProgressArgs): GameProgress {
  const { ours, opponent } = args.pitching
  const { aces } = args
  return {
    game: createGame(args.battingOrder - 1, args.playerSide),
    ourTeamId: args.ourTeamId,
    opponentTeamId: args.opponentTeamId,
    // 정규 경기에 마선수가 무작위로 나오는 코드는 원본에 없다 — 마선수 대결은 이벤트 match 명령으로만 (누락 탐색 8차)
    aceOpponent: null,
    ...(aces === undefined ? {} : { aces }),
    // 모드 4 는 경기 준비 0x1c46c 에서 **두 팀 모두** 0xb8c80 로 4인 로테이션을 한 칸 돌린다
    // (P1 1-1 의 `else (모드 4): if g != 0: 0xb8c80(내 팀)` + 그 앞줄의 상대 팀). 무작위가 아니다.
    opponentStartingPitcherIndex: opponent.starter,
    ourStartingPitcherIndex: ours.starter,
    ourPitcherOrder: ours.order,
    opponentPitcherOrder: opponent.order,
    ourPitcherStaminas: ours.staminas,
    opponentPitcherStaminas: opponent.staminas,
    pitcherLines: [],
    // 경기 시작 0x3a55a 가 0 으로 세운다 — 그 뒤로는 이닝을 넘어 이어진다
    opponentOrderIndex: 0,
    ourMound: ours.mound,
    opponentMound: opponent.mound,
    // 팀 new 0xb891c 의 +0x28 = −1 · 공 new 의 +0x10 = 0
    opponentCpuMagic: FRESH_HELD_CPU_MAGIC,
    opponentInningRunsAllowed: 0,
    // 마타자는 첫 벤치 칸(9번)에 앉는다 — 타석에 서는 길은 CPU 대타(0xac228)뿐이다 (0xb8870)
    ourLineup: args.ourRecordLineup ?? withAceBatterLineup(rosterLineupOf(BATTERS_PER_TEAM), (aces?.ours ?? NO_GAME_ACES).batter),
    opponentLineup: withAceBatterLineup(rosterLineupOf(BATTERS_PER_TEAM), (aces?.opponent ?? NO_GAME_ACES).batter),
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
    leagueStolenBases: [],
    pitching: { hitsAllowed: 0, walksAllowed: 0, outsRecorded: 0, strikeouts: 0, strikeoutCombo: 0 },
    log: [],
    nextLogId: 1,
    lastDefensePlay: null,
    sceneResultCode: SCENE_RESULT_CODE_START,
    pendingDefensePlay: null,
    burst: createBurstSession(MY_LEAGUE_BATTER_MODE),
    lastBurstResolution: null,
    runningModeManual: args.runningModeManual,
    // 경기 상태 초기화 0xb6814 — 셋 다 측 2(없음)
    decisions: EMPTY_DECISION_STATE,
    pendingBenchClearing: null,
    halfInningBoard: null,
    specialSwingRemaining: UNFILLED_SPECIAL_SWING_COUNT,
    stealingFrom: [],
    ...optionalSessionFieldsOf(args.optional),
  }
}
