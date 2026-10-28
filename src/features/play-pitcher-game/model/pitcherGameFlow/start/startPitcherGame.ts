import { rollSimulatorInit } from '@/entities/game/model/simulatorInit'
import { openScenePatternDeck } from '@/entities/batting/model/battedBallOutcome'
import { createGame } from '@/entities/game/model/gameState'
import { createAtBat } from '@/entities/at-bat/model/atBatState'
import { withAceBatterLineup } from '@/features/play-game/model/gameAces'
import { teamBatters } from '@/entities/team/model/teamRoster'
import { startingMoundOf } from '@/entities/game/model/simulateHalfInning'
import { rosterLineupOf } from '@/entities/game/model/quickLineup'
import { SCENE_RESULT_CODE_START } from '@/features/defense-play/model/sceneResultCode'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { PITCHER_EDITION_MODE } from '@/entities/pitcher-career/model/pitcherRotation'
import { EMPTY_MANAGER_HOOK_FLAGS } from '@/entities/pitcher-career/model/managerHook'
import { EMPTY_PITCHER_GAME_RECORD } from '@/entities/pitcher-career/model/pitcherGameRecord'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import { createBurstSession } from '@/entities/burst-mission/model/burstMissionSession'
import { EMPTY_DECISION_STATE } from '@/entities/game/model/winLossSave'
import { EMPTY_PITCHER_EVALUATION_RECORD } from '@/features/play-pitcher-game/model/pitcherGameEvaluation'
import { advance } from '@/features/play-pitcher-game/model/pitcherGameFlow/auto/advance'
import { staminaTableOf } from '@/features/play-pitcher-game/model/pitcherGameFlow/roster/pitcherLines'
import {
  opponentPitcherOrderOf,
  ourPitcherOrderOf,
  startsToday,
  teamAcesOf,
} from '@/features/play-pitcher-game/model/pitcherGameFlow/roster/pitcherOrder'
import { MY_PITCHER_SLOT } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/constants'
import type { PitcherGameOptions } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/optionsTypes'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'

/* ── 시작 ────────────────────────────────────────────────────────────────────── */

export function startPitcherGame(options: PitcherGameOptions, random: RandomPort): PitcherGameProgress {
  const onMound = startsToday(options)
  const ourStarter = ourPitcherOrderOf(options)[0]
  const opponentStarter = opponentPitcherOrderOf(options)[0] ?? 0
  const ourStaminas = staminaTableOf(options.ourPitcherStaminas)
  const opponentStaminas = staminaTableOf(options.opponentPitcherStaminas)
  const initial: PitcherGameProgress = {
    options,
    // 투수편 주인공은 타석에 서지 않는다 — 타순 칸을 절대 맞히지 못하는 값으로 둔다
    game: createGame(-1, options.playerSide),
    onMound,
    hasEntered: onMound,
    simpleEngineRunning: false,
    managerHookText: null,
    // 상태 9 가 모드 3 일 때 경기마다 두 플래그를 0 으로 되돌린다 (S5 U-17 확정)
    hookFlags: EMPTY_MANAGER_HOOK_FLAGS,
    stamina: options.stamina,
    magicRemaining: options.magicCount,
    opponentOrderIndex: 0,
    atBat: createAtBat(),
    atBatPrepared: false,
    lastPitch: null,
    lastResolution: null,
    sceneResultCode: SCENE_RESULT_CODE_START,
    inningRuns: [],
    decision: EMPTY_DECISION_STATE,
    pitcherRecord: EMPTY_PITCHER_GAME_RECORD,
    record: EMPTY_PITCHER_EVALUATION_RECORD,
    pitchCount: 0,
    runsAllowedByMe: 0,
    freePassesByMe: 0,
    teamBaserunnerAllowed: false,
    teamHitsAllowed: 0,
    teamRunsAllowed: 0,
    perfectInningFlag: true,
    opponentBatterLogs: {},
    recordIds: [],
    teammateLogs: {},
    atBatPitches: 0,
    halfInningPitches: 0,
    moundStrikeouts: 0,
    moundStrikeoutCombo: 0,
    lastDefensePlay: null,
    stealingFrom: [],
    lastArrivalPlay: null,
    pendingDefensePlay: null,
    pendingBenchClearing: null,
    halfInningBoard: null,
    lastHumanHalf: null,
    autoSinceHuman: false,
    // 경기 장면은 모드 2·3·4 일 때만 돌발 객체를 만든다 (0x48658)
    burst: createBurstSession(PITCHER_EDITION_MODE),
    lastBurstResolution: null,
    ballMagicNumber: 0,
    // 경기 시작 명단은 로스터 차례 그대로 — 앞 아홉이 타순, 나머지가 벤치 (team+0x28c)
    // 142 가 넣은 마타자는 첫 벤치 칸(9번)에 앉는다 — 타석에 서는 길은 CPU 대타(0xac228)뿐이다 (0xb8870)
    opponentLineup: withAceBatterLineup(rosterLineupOf(teamBatters(options.opponentTeamId).length), teamAcesOf(options, false).batter),
    pinchHitUsed: false,
    ourLineup: withAceBatterLineup(rosterLineupOf(teamBatters(options.ourTeamId).length), teamAcesOf(options, true).batter),
    // 오늘 0번이 마운드에 선다 — 선발 날이면 나다 (`ourPitcherOrderOf` 가 `startsToday` 와 같은 자리를 낸다)
    ourMound: startingMoundOf(ourStarter, ourStarter === MY_PITCHER_SLOT ? options.stamina : (ourStaminas[ourStarter] ?? FULL_STAMINA)),
    opponentMound: startingMoundOf(opponentStarter, opponentStaminas[opponentStarter] ?? FULL_STAMINA),
    ourPitcherStaminas: ourStaminas,
    opponentPitcherStaminas: opponentStaminas,
    pitcherLines: [],
    ourInningRunsAllowed: 0,
    opponentInningRunsAllowed: 0,
    scenePinchHit: null,
    log: [],
    nextLogId: 1,
    endedInningIndex: 0,
  }
  // 상태 9 갱신 0x3f584 의 공통 꼬리 0x3fa0e — 시뮬 초기화 0xc0dac 의 rand(0, 2) 한 번 (모든 모드, 1회초 판 0x18 보다 앞)
  // 상태 7 장면 초기화 0x3e340 의 3ed76 → 0xb08e8 — 이 경기 장면의 패턴 덱을 섞는다(상태 9 의 시뮬 초기화보다 앞)
  openScenePatternDeck(random)
  rollSimulatorInit(random)
  return advance(initial, random)
}
