import { runnersOfGame } from '@/entities/game/model/gameState'
import { freezeRunnerPitchers } from '@/entities/game/model/runnerPitchers'
import { createAtBat } from '@/entities/at-bat/model/atBatState'
import { recordEntryLead, saveSituationOf } from '@/entities/pitcher-career/model/pitcherGameRecord'
import { applyPitcherChange, REGULATION_LAST_INNING_INDEX } from '@/entities/game/model/winLossSave'
import { chargeCpuPitcherLine, withOutgoingStamina } from '@/features/play-pitcher-game/model/pitcherGameFlow/roster/pitcherLines'
import { MY_PITCHER_NUMBER, MY_PITCHER_SLOT } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/constants'
import { appendLog } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/gameLog'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'
import { countsMyPitcherRecord } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/recordGates'

/** 구원 등판 — 올라오는 그 순간 세이브 후보와 R+0x150 을 잡는다 (0xa60c0 · 0xa6194) */
export function enterAsRelief(progress: PitcherGameProgress): PitcherGameProgress {
  const game = progress.game
  const ourSide = game.playerSide
  const opponentSide = 1 - ourSide
  const runnerCount = Number(game.bases.first) + Number(game.bases.second) + Number(game.bases.third)
  const situation = saveSituationOf({
    lastInningIndex: REGULATION_LAST_INNING_INDEX,
    currentInningIndex: game.inning - 1,
    outs: game.outs,
    defenseScore: game.ourScore,
    offenseScore: game.opponentScore,
    runnerCount,
  })
  const decision = applyPitcherChange(progress.decision, {
    lastInningIndex: REGULATION_LAST_INNING_INDEX,
    inningIndex: game.inning - 1,
    outs: game.outs,
    defenseSide: ourSide,
    offenseSide: opponentSide,
    scoreOf: (side) => (side === ourSide ? game.ourScore : game.opponentScore),
    moundPitcherOf: () => MY_PITCHER_NUMBER,
    runnerCount,
  })
  return appendLog(
    {
      ...progress,
      onMound: true,
      hasEntered: true,
      decision,
      // 0xaf09c(수비 팀, r7, 0) — 예약만 하고 state[0xd] 는 안 세운다. 확정(0xaebe4)이 카운터를 0 으로
      ourMound: {
        pitcherSlot: MY_PITCHER_SLOT,
        stamina: progress.stamina,
        runsAllowed: 0,
        pitches: 0,
        usedSlots: [...progress.ourMound.usedSlots, progress.ourMound.pitcherSlot],
        justChanged: false,
      },
      ourPitcherStaminas: withOutgoingStamina(progress.ourPitcherStaminas, progress.ourMound),
      // 루에 남은 주자(있다면)는 내려가는 동료가 책임 투수다 (주자+0x30)
      runnerPitchers: freezeRunnerPitchers(
        progress.runnerPitchers,
        runnersOfGame(progress.game, progress.opponentOrderIndex),
        progress.ourMound.pitcherSlot,
      ),
      pitcherLines: chargeCpuPitcherLine(progress.pitcherLines, progress.options.ourTeamId, progress.ourMound.pitcherSlot, {
        pitches: progress.ourMound.pitches,
      }),
      ourInningRunsAllowed: 0,
      // R+0x150 (코드 0x1f) — 포스트시즌이면 0xa56dc 가 거짓이라 안 적는다
      ...(countsMyPitcherRecord(progress)
        ? {
            pitcherRecord: recordEntryLead(progress.pitcherRecord, situation),
            record: { ...progress.record, leadingAtEntry: situation.leading },
          }
        : {}),
      // 기록 18~23 은 **현재 투수**의 R[0]·R[1] 을 보므로 투수가 바뀌면 0 부터 다시 센다 (R8 4-2)
      moundStrikeouts: 0,
      moundStrikeoutCombo: 0,
      atBatPrepared: false,
      atBat: createAtBat(),
    },
    `${game.inning}회 구원 등판`,
    true,
  )
}
