import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { rollsIntoBenchClearing, benchClearingEffectOf, staminaAfterBenchClearing } from '@/entities/game/model/benchClearing'
import { appendLog } from '@/features/play-team-game/model/teamGameFlow/log/appendLog'
import { withSeasonRecord } from '@/features/play-team-game/model/teamGameFlow/records/gameEndRecords'
import { addRunsToCounters } from '@/features/play-team-game/model/teamGameFlow/settlement/pitcherLines'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * **사구 뒤 벤치 클리어링** (`entities/game/model/benchClearing`, R10 6절) — 우리 타석이라 수비(상대)는 CPU 다.
 * 들어가면 상대 투수 투구 수(`+0x27c`) +10 (0x3ab82). 시즌 평판 S[1](코드 1, 0x3ab92)도 부르지만 코드 ≤ 5 는
 * 공격측이 CPU 일 때만 적히므로 우리 공격에서는 게이트에서 버려진다 (`withSeasonRecord` 가 그대로 가른다).
 * 홈런더비가 아니라 사구면 늘 한 번 굴린다 — **사구 타석만 난수를 하나 더 쓴다.**
 * 0x12 대기 끝(`judgeHitByPitch`)이 부른다 — 들어가면 연출(상태 0x1e)을 붙든다(`enterBenchClearing` · `resolveBenchClearing`).
 * 우리가 던진 공에 CPU 타자가 맞는 쪽(코드 1 이 S[1] 에 남고 우리 투수 스태미나 −1000)은 `withPitcherBenchClearing`.
 */
export function withBatterBenchClearing(progress: TeamGameProgress, outcome: AtBatOutcome, random: RandomPort): TeamGameProgress {
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
      opponentPitcherCounters: addRunsToCounters(progress.opponentPitcherCounters, 0, effect.defensePitchCountGain, false),
      gameRecord: withSeasonRecord(progress, '공격', [effect.seasonRecordCode]),
    },
    `${progress.game.inning}회${progress.game.half} 벤치 클리어링`,
    true,
  )
}

/**
 * **사구 뒤 벤치 클리어링** (`entities/game/model/benchClearing`, R10 6절) — 우리가 던진 공이라 수비는 사람이다.
 * 들어가면 0x3ab7c `0xaeab0(수비 팀, 1000)` — 지금 마운드의 우리 투수 스태미나(+0x2c) −1000, [0, 10000] 로 자른다.
 * 시즌 평판 S[1](코드 1, 0x3ab92)은 코드 ≤ 5 라 공격측(상대)이 CPU 인 지금 남는다 — `withSeasonRecord` 가
 * 시즌 팀 경기(모드 2)일 때만 적는다. 홈런더비가 아니라 사구면 늘 한 번 굴린다 — **사구 타석만 난수를 하나 더 쓴다.**
 * 0x12 대기 끝(`judgeHitByPitch`)이 부른다 — 들어가면 연출(상태 0x1e)을 붙든다(`enterBenchClearing` · `resolveBenchClearing`).
 */
export function withPitcherBenchClearing(progress: TeamGameProgress, outcome: AtBatOutcome, random: RandomPort): TeamGameProgress {
  const entered = rollsIntoBenchClearing(
    {
      isHitByPitch: outcome.kind === '사구',
      isHomeRunDerby: false,
      burstInProgress: progress.burst !== null && progress.burst.current !== null,
    },
    random,
  )
  if (!entered) return progress
  const effect = benchClearingEffectOf(true)
  return appendLog(
    {
      ...progress,
      stamina: staminaAfterBenchClearing(progress.stamina, effect.defenseStaminaLoss),
      gameRecord: withSeasonRecord(progress, '수비', [effect.seasonRecordCode]),
    },
    `${progress.game.inning}회${progress.game.half} 벤치 클리어링`,
    true,
  )
}
