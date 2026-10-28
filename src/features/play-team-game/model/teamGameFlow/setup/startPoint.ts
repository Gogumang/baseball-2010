import type { RandomPort } from '@/shared/api/random/randomPort'
import {
  withEntryRecordSlots,
  withAceBatter,
  rosterEntryBattersOf,
  entryBattersOfOrder,
  NO_ACE_BATTER,
  withAcePitcher,
  rosterEntryPitchersOf,
  entryPitchersOfOrder,
} from '@/features/play-team-game/model/teamGameRoster'
import { EMPTY_BATTER_GAME_RECORD } from '@/entities/batting/model/pinchHitAi'
import { clearSeasonGameRecord } from '@/entities/season-mode/model/seasonReputation'
import { EMPTY_BATTER_GAME_LOG } from '@/entities/game/model/batterGameLog'
import { createGame } from '@/entities/game/model/gameState'
import { EMPTY_DECISION_STATE } from '@/entities/game/model/winLossSave'
import { createAtBat } from '@/entities/at-bat/model/atBatState'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import { EMPTY_MOUND_COUNTERS } from '@/entities/pitching/model/pitcherChange'
import { SCENE_RESULT_CODE_START } from '@/features/defense-play/model/sceneResultCode'
import { createBurstSession } from '@/entities/burst-mission/model/burstMissionSession'
import { UNFILLED_SPECIAL_SWINGS } from '@/features/play-team-game/model/teamGameFlow/roster/specialSwing'
import {
  opponentAceIndexesOf,
  opponentPitcherEntryOf,
  pitcherStaminasOf,
  startingPitcherSlotsOf,
} from '@/features/play-team-game/model/teamGameFlow/setup/opponentAces'
import { magicCountOfPitcher } from '@/features/play-team-game/model/teamGameFlow/substitution/pitcherChange'
import { BATTING_ORDER_SIZE } from '@/features/play-team-game/model/teamGameFlow/types/constants'
import type { TeamGameOptions } from '@/features/play-team-game/model/teamGameFlow/types/options'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'
import { EMPTY_PITCHING_LINE, EMPTY_RECORD_TALLY } from '@/features/play-team-game/model/teamGameFlow/types/records'

/**
 * **경기 세우기 0x30f20 이 만든 두 팀·st** — 경기 장면을 열기 전의 첫 진행(저장 블록 칸 0x32·0x33 에 거는 그것).
 * 마선수·선발을 아직 안 굴렸으면 여기서 굴린다(`opponentAces` · `startingPitcherSlots` 를 받았으면 굴림 없음).
 * 일반모드 경기정보(22)는 들어올 때·`*` 재굴림 끝·엔트리 편집(23) 나갈 때 이것을 블록에 쓴다(0x30f20 · 0x2a370 → 0x22755).
 */
export function teamGameStartPointOf(options: TeamGameOptions, random: RandomPort): TeamGameProgress {
  const opponentAces = opponentAceIndexesOf(options, random)
  const startingSlots = startingPitcherSlotsOf(options, random)
  // 0x30f20 의 순서 그대로 — 팀을 세운 뒤 고른 마타자를 벤치에 끼워 넣는다 (0xb8870).
  // 엔트리 편집기가 고친 차례가 있으면 그 차례가 곧 팀 레코드다 (0xb891c 는 첨자만 든다)
  const ourOrder = options.ourEntryOrder
  // 경기 장면 셋업 0x39fdc 가 두 팀 레코드 +0xa 를 첨자로 다시 매긴다(0xb8768 → 0xb603c) — `withEntryRecordSlots`
  const ourEntry = withEntryRecordSlots(
    withAceBatter(
      ourOrder === undefined ? rosterEntryBattersOf(options.ourTeamId) : entryBattersOfOrder(options.ourTeamId, ourOrder),
      options.aceBatterId ?? NO_ACE_BATTER,
    ),
  )
  // 상대 팀도 그 팀 레코드 차례로 선다 (0xb8680 → 0x1f570 — 트레이드로 바뀐 CPU 팀이면 바뀐 레코드)
  const opponentEntry = withEntryRecordSlots(
    withAceBatter(
      options.opponentEntryOrder === undefined
        ? rosterEntryBattersOf(options.opponentTeamId)
        : entryBattersOfOrder(options.opponentTeamId, options.opponentEntryOrder),
      opponentAces.batter,
    ),
  )
  // 0x31042 · 0x31064 — 마타자와 **같은 자리에서** 마투수도 양 팀에 들어간다 (0xb88c8)
  const ourPitcherEntry = withAcePitcher(
    ourOrder === undefined ? rosterEntryPitchersOf(options.ourTeamId) : entryPitchersOfOrder(options.ourTeamId, ourOrder),
    options.acePitcherId ?? NO_ACE_BATTER,
  )
  const opponentPitcherEntry = withAcePitcher(opponentPitcherEntryOf(options), opponentAces.pitcher)
  const ourPitcherStaminas = pitcherStaminasOf(ourPitcherEntry, options.ourPitcherStaminas)
  const opponentPitcherStaminas = pitcherStaminasOf(opponentPitcherEntry, options.opponentPitcherStaminas)
  const initial: TeamGameProgress = {
    options,
    ourEntry,
    opponentEntry,
    ourPitcherEntry,
    opponentPitcherEntry,
    ourEntryRecords: ourEntry.map(() => EMPTY_BATTER_GAME_RECORD),
    opponentEntryRecords: opponentEntry.map(() => EMPTY_BATTER_GAME_RECORD),
    ourHitBases: ourEntry.map(() => []),
    gameRecord: clearSeasonGameRecord(),
    cpuPinchHitUsed: false,
    pinchHitHomeRunHalf: null,
    recordIds: [],
    recordTally: EMPTY_RECORD_TALLY,
    ourBatterLogs: ourEntry.map(() => EMPTY_BATTER_GAME_LOG),
    scenePinchHit: null,
    scenePitcherChange: null,
    opponentAcePitcherIndex: opponentAces.pitcher,
    opponentAceBatterIndex: opponentAces.batter,
    opponentBenchBatters: Math.max(0, opponentEntry.length - BATTING_ORDER_SIZE),
    // 원본은 팀을 세울 때 이 칸을 채우고 마타자를 넣을 때 하나 올린다 — 결과가 명단 − 타순 아홉이다
    ourBenchBatters: Math.max(0, ourEntry.length - BATTING_ORDER_SIZE),
    // 타순 칸은 "사람이 서는 자리" 가 아니다 — 팀 경기는 아홉 칸을 모두 사람이 친다
    game: createGame(-1, options.playerSide),
    // 경기 상태 초기화 0xb6814 — 셋 다 측 2(없음)
    decisions: EMPTY_DECISION_STATE,
    halfInningBoard: null,
    lastHumanHalf: null,
    autoSinceHuman: false,
    pendingBenchClearing: null,
    atBat: createAtBat(),
    opponentOrderIndex: 0,
    opponentPitcherIndex: startingSlots.opponent,
    ourPitcherIndex: startingSlots.ours,
    ourUsedPitchers: [],
    opponentUsedPitchers: [],
    // 선발은 제 레코드 +0x2c 로 선다 (시즌 정규는 경기 사이에 이어진 값 — a583fe0)
    opponentStamina: opponentPitcherStaminas[startingSlots.opponent] ?? FULL_STAMINA,
    ourPitcherStaminas,
    opponentPitcherStaminas,
    ourPitcherCounters: EMPTY_MOUND_COUNTERS,
    opponentPitcherCounters: EMPTY_MOUND_COUNTERS,
    pitcherLines: [],
    opponentAceStrikeouts: 0,
    pitcherJustChanged: false,
    atBatPrepared: false,
    sceneConfirm: null,
    stamina: ourPitcherStaminas[startingSlots.ours] ?? FULL_STAMINA,
    // 팀 new 0xb891c 가 팀+0x28 을 −1 로 두고(b89b4~b89ba) 첫 타석 준비(상태 0xd 0x48d50 → 0xaebe4)가 선발로 채운다
    magicRemaining: magicCountOfPitcher(ourPitcherEntry[startingSlots.ours] ?? ourPitcherEntry[0], options.aceLevels),
    opponentMagicRemaining: magicCountOfPitcher(opponentPitcherEntry[startingSlots.opponent] ?? opponentPitcherEntry[0], options.aceLevels),
    // 공 객체 new — +0x10 = 0 (0x1239 new 의 0 채움은 원본 미확인 — H2 3-4)
    ballMagicNumber: 0,
    ourSpecialSwingRemaining: UNFILLED_SPECIAL_SWINGS,
    opponentSpecialSwingRemaining: UNFILLED_SPECIAL_SWINGS,
    pitchCount: 0,
    lastPitch: null,
    lastResolution: null,
    sceneResultCode: SCENE_RESULT_CODE_START,
    lastDefensePlay: null,
    stealingFrom: [],
    lastArrivalPlay: null,
    pendingDefensePlay: null,
    pitching: EMPTY_PITCHING_LINE,
    ourHits: 0,
    leaguePlateAppearances: [],
    burst: createBurstSession(options.mode),
    lastBurstResolution: null,
    burstRewardDeltas: [],
    log: [],
    nextLogId: 1,
  }
  return initial
}
