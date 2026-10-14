import type { BenchClearingEntryRoll } from '@/features/play-game/model/benchClearingScene'
import type { BenchClearingField } from '@/widgets/field-walk/lib/benchClearingWalk'
import {
  type WalkTeamAces,
  type WalkerAceSprite,
  walkAceSpritesOf,
  walkAceSpritesOfRecords,
  walkerRecordsOf,
} from '@/widgets/field-walk/lib/walkerAces'

/** 공격 줄(+0x1758)의 마선수 재료 — 진입 0x3a5f0 이 +0xec 를 적는 데 쓰는 것 */
export interface BenchClearingOffenseAces extends WalkTeamAces {
  /** 사구를 맞은 지금 타자(0xae89c) 레코드 — 자리 니블 · 마타자 번호 */
  readonly batter?: { readonly position: number; readonly ace: number | null } | null
  /** 1 · 2 · 3루 주자가 마선수 주자(+0x9c ≠ −1)인가 */
  readonly aceRunnerBases?: readonly [boolean, boolean, boolean]
}

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
  /** 수비 팀 마선수 재료 — 수비 줄 그림 [+0xf20] */
  readonly defenseAces?: WalkTeamAces | null
  /** 공격 팀 마선수 재료 — 공격 줄 그림 [+0x177c] (진입 3a66a~3a716 이 공격 팀 st[9] 로 싣는다) */
  readonly offenseAces?: BenchClearingOffenseAces | null
}

const BATTER_INDEX = 8

/**
 * 진입 0x3a5f0 이 공격 줄 +0xec 를 적는 꼴 (3a89c~3aac0, 직접 뜸 2026-10-14):
 * ```
 * 3a89c  칸 i = 0..8: 공격 팀 레코드 타자 배열에서 자리 니블이 i + 1 인 첫 레코드 → O[i]+0xec
 * 3a97e  지금 타자(0xae89c([장면+0x220]))가 마선수면 O[니블 − 1]+0xec ↔ O[8]+0xec   (+0x1754 + 4·니블)
 * 3aa1a  루 b = 1..3: 그 루 주자(0xa97a0)가 마선수 주자(+0x9c ≠ −1)면 레코드 k 마다 마선수 레코드의 O[니블 − 1]+0xec ↔ O[8 − b]+0xec
 * ```
 * ⚠️ 미확인: 니블 0(벤치)인 마선수면 원본은 O[−1] 자리(+0x1754 — 공격 줄 앞 칸)를 건드린다 — 웹은 그 맞바꿈을 건너뛴다.
 * 루 고리 꼬리 3ab36~3ab48: b + 1 · r6 −= 4 (O[7] → O[6] → O[5]) · b ≤ 3 이면 다시 — 루에 주자가 없으면 그 루는 건너뛴다.
 */
export function benchOffenseAceSpritesOf(team: BenchClearingOffenseAces): readonly (WalkerAceSprite | null)[] {
  const seated: ({ readonly ace: number | null } | null)[] = [...walkerRecordsOf(team.records)]
  const swap = (a: number, b: number) => {
    if (a < 0 || a >= seated.length || b < 0 || b >= seated.length) return
    const held = seated[a]
    seated[a] = seated[b]
    seated[b] = held
  }
  const batter = team.batter ?? null
  if (batter !== null && batter.ace !== null) swap((batter.position & 0xf) - 1, BATTER_INDEX)
  ;(team.aceRunnerBases ?? [false, false, false]).forEach((isAce, baseIndex) => {
    if (!isAce) return
    for (const record of team.records) {
      if (record.ace !== null) swap((record.position & 0xf) - 1, BATTER_INDEX - 1 - baseIndex)
    }
  })
  return walkAceSpritesOfRecords(team.pitcherAce, seated, team.records)
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
    // 수비 줄 +0xec 는 진입이 안 적는다 — 이 반 이닝의 교대 판(0x3fac4) · 수비 판 시작(0xb0fb4)이 수비 팀 레코드로 적어 둔 것이다.
    // ⚠️ 근사: 그 판들이 없었으면(앞 반 이닝 판의 값이 남음) 다르다 — 수비 팀 레코드로 본다. 칸 0 의 +0xec 는 0xb0fb4 가 안 적는다
    ...(source.defenseAces == null ? {} : { defenseAces: walkAceSpritesOf(source.defenseAces) }),
    ...(source.offenseAces == null ? {} : { offenseAces: benchOffenseAceSpritesOf(source.offenseAces) }),
  }
}
