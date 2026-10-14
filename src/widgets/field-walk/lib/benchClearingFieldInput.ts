import type { BenchClearingEntryRoll } from '@/features/play-game/model/benchClearingScene'
import type { BenchClearingField } from '@/widgets/field-walk/lib/benchClearingWalk'

export interface BenchClearingFieldSource {
  /** 진입 굴림 45 번 (`rollBenchClearingEntry`). 없으면(옛 칸) 운동장을 안 그린다 */
  readonly entryRolls: readonly BenchClearingEntryRoll[] | null | undefined
  /** 사구를 맞은 반 이닝 — 초면 측 0 공격 */
  readonly half: '초' | '말'
  /** 사람 측 · 두 팀 번호 — 그림 팔레트 */
  readonly playerSide: number
  readonly ourTeamId: number
  readonly opponentTeamId: number
  /** 지금 타자 손 0xb63c0 (0 · 1) — 1 이면 타석 x + 1400 */
  readonly batterHand: number
  /** 사구를 먹이기 앞 루상 */
  readonly bases: { readonly first: boolean; readonly second: boolean; readonly third: boolean }
  readonly grassPalette?: number | null
}

/** 벤치 클리어링 그리기 0x43228 의 재료 — `BenchClearingScene.field` */
export function benchClearingFieldOf(source: BenchClearingFieldSource): BenchClearingField | undefined {
  if (source.entryRolls == null) return undefined
  const offenseSide: 0 | 1 = source.half === '초' ? 0 : 1
  const teamOf = (side: number) => (side === source.playerSide ? source.ourTeamId : source.opponentTeamId)
  return {
    entryRolls: source.entryRolls,
    offenseSide,
    isLeftBatter: source.batterHand !== 0,
    occupiedBases: [source.bases.first, source.bases.second, source.bases.third],
    defenseTeam: teamOf(offenseSide === 0 ? 1 : 0),
    offenseTeam: teamOf(offenseSide),
    grassPalette: source.grassPalette ?? null,
  }
}
