import { nariGameRecordOf } from '@/entities/career/model/nariCupTeams'
import { type NariRecordFielder, nariFieldersAfterPinchHits, nariRecordFieldersOf } from '@/entities/career/model/nariTeamRecord'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { ACE_PITCHER_SLOT } from '@/features/play-game/model/gameAces'
import { type GameProgress, ourRunnerAcesOf } from '@/features/play-game/model/gameFlow'
import { type BenchClearingOffenseAces, aceRunnerBasesOf } from '@/widgets/field-walk/lib/benchClearingFieldInput'
import type { WalkTeamAces } from '@/widgets/field-walk/lib/walkerAces'

/** 타자편 경기의 한 팀 — 운동장 전경 · 벤치 클리어링이 읽는 레코드 차례와 지금 투수 마선수 */
export interface GameFieldTeam {
  /** 레코드 타자 배열 차례(`0xb8680` — 나리 팀 레코드 · 국가대항전이면 대회 칸) */
  readonly lineup: readonly NariRecordFielder[]
  /** 0x79b48 a · b 재료 */
  readonly aces: WalkTeamAces
}

/**
 * 타자편(모드 4) 두 팀 — 경기 장면 0x39fdc 가 `0xb891c(…, 모드 4, 팀)` 로 세운 그 레코드(`nariGameRecordOf`)를 차례 그대로 읽는다.
 * 지금 투수 마선수 = 마운드가 마투수 칸(8번 — 142 가 레코드 8번에 넣은 것)이면 그 번호.
 * CPU 대타 0xaebe4 가 맞바꾼 레코드 자리 니블은 지금 명단(`ourLineup` · `opponentLineup`)으로 따라간다(`nariFieldersAfterPinchHits`) —
 * 레코드 차례는 그대로다.
 */
export function gameFieldTeamsOf(
  career: PlayerCareer,
  progress: Pick<GameProgress, 'ourTeamId' | 'opponentTeamId' | 'ourMound' | 'opponentMound' | 'aces'> &
    Partial<Pick<GameProgress, 'ourLineup' | 'opponentLineup'>>,
): { readonly ours: GameFieldTeam; readonly opponent: GameFieldTeam } {
  const teamOf = (isOurs: boolean): GameFieldTeam => {
    const teamId = isOurs ? progress.ourTeamId : progress.opponentTeamId
    const lineup = nariFieldersAfterPinchHits(
      nariRecordFieldersOf(nariGameRecordOf(career, teamId), teamId, isOurs ? career.name : null),
      isOurs ? progress.ourLineup : progress.opponentLineup,
    )
    const mound = isOurs ? progress.ourMound : progress.opponentMound
    const acePitcher = (isOurs ? progress.aces?.ours : progress.aces?.opponent)?.pitcher ?? -1
    const pitcherAce = mound.pitcherSlot === ACE_PITCHER_SLOT && acePitcher >= 0 ? acePitcher : null
    return { lineup, aces: { pitcherAce, records: lineup } }
  }
  return { ours: teamOf(true), opponent: teamOf(false) }
}

/**
 * 타자편 벤치 클리어링 공격 줄 재료 — 공격 줄은 내 팀(사구를 맞은 타자는 나 — 마선수가 아니라 3a97e 의 맞바꿈이 없다), 루 위 동료의
 * 마선수 주자(+0x9c)는 수비 판 재료 `ourRunnerAcesOf` 그대로 (3aa1a)
 */
export function gameBenchOffenseOf(
  ours: GameFieldTeam,
  progress: Pick<GameProgress, 'game'> & Parameters<typeof ourRunnerAcesOf>[0],
): BenchClearingOffenseAces {
  return { ...ours.aces, batter: null, aceRunnerBases: aceRunnerBasesOf(ourRunnerAcesOf(progress), progress.game.bases) }
}
