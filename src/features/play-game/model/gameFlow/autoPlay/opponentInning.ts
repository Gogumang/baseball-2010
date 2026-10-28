import type { RandomPort } from '@/shared/api/random/randomPort'
import { simulateHalfInningTicks } from '@/entities/game/model/simulateHalfInning'
import { startingPitcherOf } from '@/entities/team/model/teamRoster'
import { isGameOverAt, endSituationOf, withInningRuns, applyOpponentInning } from '@/entities/game/model/gameState'
import { ACE_BATTER_ROSTER_SLOT } from '@/features/play-game/model/gameAces'
import { rosterSlotAt } from '@/entities/game/model/quickLineup'
import { backToBackRecordOf } from '@/entities/game/model/gameRecords'
import { teamRecordMoraleOf } from '@/entities/team/model/teamMorale'
import { chargeHalfInningLines } from '@/entities/game/model/gamePitcherLines'
import { gameFightingSpiritOf } from '@/features/play-game/model/gameFlow/context/fightingSpirit'
import { appendLog } from '@/features/play-game/model/gameFlow/log/appendLog'
import { quickDefenseOf } from '@/features/play-game/model/gameFlow/quick/quickDefense'
import { withOutgoingStaminas } from '@/features/play-game/model/gameFlow/quick/stamina'
import { teamAcePitcherOf, teamBatterAt } from '@/features/play-game/model/gameFlow/roster/teamPlayers'
import { opponentHalfDecisionsOf } from '@/features/play-game/model/gameFlow/settlement/decisions'
import { BATTING_ORDER_SIZE } from '@/features/play-game/model/gameFlow/types/constants'
import type { GameAutoRelayTick, GameProgress } from '@/features/play-game/model/gameFlow/types/progress'

/**
 * 상대 공격은 이닝 득점 확률표가 아니라 원본처럼 타석을 3아웃까지 돌려 점수를 읽는다 (0xc11f0).
 *
 * 모드 4 도 사람이 필요 없는 타석은 간이 엔진으로 넘긴다 (0x48530 → 0xc262c, P1 1-3).
 * 상대 타순은 `opponentOrderIndex`(team+0x32)에서 시작해 **이어진다** — 이닝마다 1번부터가 아니다
 * (E 3b 확정: 이닝 전환에서 이 칸을 0 으로 되돌리는 코드가 없다). 타순은 아홉 칸을 돈다
 * (`0xaf020` 의 `mod 9`) — 로스터 열두 명 중 뒤 셋(벤치)은 타순에 안 선다.
 */
export function playOpponentInning(progress: GameProgress, random: RandomPort, relay?: GameAutoRelayTick[]): GameProgress {
  // 상대 반 이닝은 모드 4 에서 늘 자동진행(0x21, 0xc1ed6)이라 상태 0xf 를 안 지난다 —
  // 돌발을 굴리지도(0x8f158) 판정하지도(0x8f414) 않는다 (`burstContextOf` 머리말)
  // 틱 꼴로 돌려 0xc262c 한 번마다 중계 칸을 남긴다(굴림 · 결과는 `simulateHalfInning` 과 한 톨도 안 다르다)
  const halfTicks = simulateHalfInningTicks(
    progress.opponentOrderIndex,
    (order) => teamBatterAt(progress, false, order % BATTING_ORDER_SIZE),
    startingPitcherOf(progress.ourTeamId, progress.ourStartingPitcherIndex),
    progress.game.inning,
    random,
    { strikeoutCombo: progress.pitching.strikeoutCombo, strikeouts: progress.pitching.strikeouts },
    // 자동진행도 타석마다 0xc2198 → 경기 끝 판정 0xb68fc — 상대가 홈(말)이면 끝내기 · 홈 10점 콜드에서 3아웃 전에 멈춘다
    {
      endsGame: ({ runs, outs }) => isGameOverAt(endSituationOf({ ...progress.game, opponentScore: progress.game.opponentScore + runs }, outs)),
    },
    // 우리 투수도 CPU 가 던진다 — 타석마다 0xc1ba4 → 0xac428 교체, 투구마다 0xa5e14 소모
    quickDefenseOf(
      progress.ourTeamId,
      progress.ourMound,
      progress.game.ourScore - progress.game.opponentScore,
      progress.ourPitcherOrder,
      progress.ourPitcherStaminas,
      teamAcePitcherOf(progress, true),
      progress.teamMorale,
      undefined,
      undefined,
      // 상대가 공격 — 이 반 이닝 득점은 상대 쪽
      (runs) => gameFightingSpiritOf(progress, progress.ourTeamId, { runs, offenseIsOurs: false }),
    ),
    // 상대 타자는 명단에서 고르고, 타석마다 CPU 대타(0xac228)를 먼저 본다
    {
      lineup: progress.opponentLineup,
      batterOf: (rosterSlot) => teamBatterAt(progress, false, rosterSlot),
      pinchHitUsed: progress.pinchHitUsed,
      // ac23e~ac26e — 타석 타자가 마선수(0xae89c → 0xb633c)면 굴림 없이 안 낸다. 마타자 칸(12)은 142 가 넣은 명단에만 있다
      isAceRosterSlot: (rosterSlot) => rosterSlot === ACE_BATTER_ROSTER_SLOT,
    },
    // 0xab214 의 전역 모드 4 · 수비(우리 팀)가 사람 팀 — 모드 3·4 라 수비 사람 −10 은 안 걸린다(0xab5c0)
    { mode: '나만의리그', isDefenseHuman: true },
  )
  const opponentSide = 1 - progress.game.playerSide
  let runsSoFar = 0
  let half
  for (;;) {
    const next = halfTicks.next()
    if (next.done === true) {
      half = next.value
      break
    }
    const tick = next.value
    if (tick.kind === 'plateAppearance') runsSoFar += tick.appearance.runsBattedIn
    relay?.push({
      progress,
      // 반 이닝 도중의 판 — 점수 · 이닝별 칸은 그 틱까지 든 득점, 아웃은 그 틱의 st[6]
      game: withInningRuns({ ...progress.game, opponentScore: progress.game.opponentScore + runsSoFar, outs: tick.outs }, opponentSide, runsSoFar),
      offenseOurs: false,
      orderIndex: tick.battingOrderIndex,
      lineup: tick.lineup ?? progress.opponentLineup,
      pitcherSlot: tick.pitcherSlot ?? progress.ourMound.pitcherSlot,
      atBat:
        tick.kind === 'plateAppearance'
          ? {
              rosterSlot: tick.appearance.rosterSlot ?? rosterSlotAt(tick.lineup ?? progress.opponentLineup, tick.battingOrderIndex),
              outcome: tick.appearance.outcome,
              fouled: tick.appearance.fouled === true,
              swingingStrikeOutLost: tick.appearance.swingingStrikeOutLost === true,
              strikes: tick.strikes,
              balls: tick.balls,
            }
          : null,
    })
  }
  const runs = half.runs
  const game = applyOpponentInning(progress.game, runs)
  // 경기를 끝낸 마지막 틱은 끝난 판으로 그린다(끝내기 · 콜드 — 0xc2198 의 0xb68fc 가 그 다음 틱을 거짓으로)
  const lastTick = relay?.[relay.length - 1]
  if (relay !== undefined && lastTick !== undefined && lastTick.progress === progress && game.isFinished) {
    relay[relay.length - 1] = { ...lastTick, game: { ...lastTick.game, isFinished: true } }
  }
  const decisions = opponentHalfDecisionsOf(progress, half.runs, half.pitcherChanges ?? [])
  // 상대 타석도 정산 0xa8024 를 지난다 — 공격 팀이 사람이 아니라 백투백 카운터는 결과와 무관하게 0 이 된다
  const homeRunStreak = half.plateAppearances.reduce(
    (streak, appearance) => backToBackRecordOf({ streak, humanOffense: false, isHomeRun: appearance.outcome.kind === '홈런' }).streak,
    progress.homeRunStreak,
  )

  return appendLog(
    {
      ...progress,
      game,
      // 자동진행 반 이닝이 상대(공격) 레코드 +2 를 덮었으면(스윙 경로 0xab214 · 주자 있는 판정 경로 c19ec) 그때 사기다 — 이 반 이닝에는
      // 돌발이 없어(상태 0xf 를 안 지난다) 사기가 그대로다 (`HalfInningResult.offenseRecordTouched`, r104)
      ...(half.offenseRecordTouched ? { opponentRecordMorale: progress.teamMorale ?? teamRecordMoraleOf(progress.opponentTeamId) } : {}),
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
      // 0xc1a42 — 성공한 도루의 주자마다 0xa56dc(ctx, 주자, 0) 참이면 +0x2c (마타자 칸은 summary 가 뺀다)
      leagueStolenBases: [
        ...(progress.leagueStolenBases ?? []),
        ...half.stolenBases.map((steal) => ({
          teamId: progress.opponentTeamId,
          battingOrderIndex: steal.rosterSlot ?? steal.battingOrderIndex % BATTING_ORDER_SIZE,
        })),
      ],
    },
    `${progress.game.inning}회${progress.game.half} 상대 공격 — ${runs}점${half.pinchHits
      .map((pinch) => ` (${(pinch.battingOrderIndex % BATTING_ORDER_SIZE) + 1}번 CPU 대타)`)
      .join('')}`,
    false,
  )
}
