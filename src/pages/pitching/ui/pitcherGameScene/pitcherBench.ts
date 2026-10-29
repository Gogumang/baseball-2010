import { aceRunnerBasesOf } from '@/widgets/field-walk/lib/benchClearingFieldInput'
import type { BenchClearingOffenseAces } from '@/widgets/field-walk/lib/benchClearingFieldInput'
import { nariFieldersAfterPinchHits } from '@/entities/career/model/nariTeamRecord'
import { opponentBatterOf, opponentRunnerAcesOf } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import type { PitcherGameOptions, PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import { type PitcherFieldLineups, pitcherFieldAcesOf } from '@/pages/pitching/lib/pitcherFieldTeams'

/** 두 팀 레코드 차례 — 대타 0xaebe4 가 맞바꾼 자리 니블은 지금 명단으로 따라간다 (`nariFieldersAfterPinchHits`) */
export function currentFieldLineupsOf(
  progress: PitcherGameProgress,
  recordFieldLineups: PitcherFieldLineups | undefined,
): PitcherFieldLineups | undefined {
  if (recordFieldLineups === undefined) return undefined
  return {
    ours: nariFieldersAfterPinchHits(recordFieldLineups.ours, progress.ourLineup),
    opponent: nariFieldersAfterPinchHits(recordFieldLineups.opponent, progress.opponentLineup),
  }
}

/** 사구를 맞은 지금 타자가 마타자면 그 자리 니블 · 번호 (자리 니블은 대타 뒤 레코드 줄의 값) */
function benchBatterOf(progress: PitcherGameProgress, fieldLineups: PitcherFieldLineups | undefined) {
  const batterAce = opponentBatterOf(progress).aceIndex
  if (batterAce === undefined) return null
  const aceRow = fieldLineups?.opponent.find((row) => row.ace === batterAce)
  return { position: aceRow?.position ?? 0, ace: batterAce }
}

/**
 * 투수편 벤치 클리어링 공격 줄(상대 팀) 재료 — 3a97e: 사구를 맞은 지금 타자가 마타자면 그 레코드(자리 니블은 대타 뒤 레코드 줄의 값)를
 * 타자 칸과 맞바꾼다. 3aa1a: 루 위 마선수 주자(+0x9c)는 수비 판 재료 `opponentRunnerAcesOf` 그대로
 */
export function pitcherBenchOffenseOf(
  progress: PitcherGameProgress,
  options: PitcherGameOptions,
  fieldLineups: PitcherFieldLineups | undefined,
): BenchClearingOffenseAces | null {
  const offense = pitcherFieldAcesOf(progress, options, fieldLineups, false)
  if (offense === null) return null
  return {
    ...offense,
    batter: benchBatterOf(progress, fieldLineups),
    aceRunnerBases: aceRunnerBasesOf(opponentRunnerAcesOf(progress), progress.game.bases),
  }
}
