import type { BenchClearingEntryRoll } from '@/features/play-game/model/benchClearingScene'
import type { BenchClearingField } from '@/widgets/field-walk/lib/benchClearingWalk'
import {
  type WalkTeamAces,
  type WalkerAceSprite,
  type WalkerLineSeats,
  type WalkerSeat,
  walkAceSpritesOfRecords,
  walkerRecordsOf,
} from '@/widgets/field-walk/lib/walkerAces'

/** 공격 줄(+0x1758)의 마선수 재료 — 진입 0x3a5f0 이 +0xec 를 적는 데 쓰는 것 */
export interface BenchClearingOffenseAces extends WalkTeamAces {
  /** 사구를 맞은 지금 타자(0xae89c) 레코드 — 자리 니블 · 마타자 번호 */
  readonly batter?: { readonly position: number; readonly ace: number | null } | null
  /**
   * 1 · 2 · 3루 주자가 마선수 주자(+0x9c ≠ −1)인가 — 주자 +0x9c 는 만들 때 0xa94ca 가 적는 그 선수의 마선수 번호(0xb63a0)라
   * 수비 판 재료 `RunnerAces`(주자 그림 0x79d10)와 같은 값이다(`aceRunnerBasesOf`)
   */
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
  /** 수비 팀 마선수 재료 — 수비 줄 그림 [+0xf20] (a 갈래 지금 투수 · 그림에 싣는 첫 마타자) */
  readonly defenseAces?: WalkTeamAces | null
  /**
   * 그때 수비 줄(+0x111c)의 칸별 +0xec — 진입 0x3a5f0 은 수비 줄을 자리만 옮기고(3a620~3a668) +0xec 는 안 적어, 그 경기 장면에서
   * 마지막으로 적은 곳(교대 판 0x3fac4 · 수비 판 시작 0xb0fb4)의 값이 남는다(`WalkerLineSeats.defense`). 안 주면 장면을 세운 뒤
   * 아무도 안 적은 줄(모두 0)이다
   */
  readonly defenseSeats?: readonly WalkerSeat[] | null
  /** 공격 팀 마선수 재료 — 공격 줄 그림 [+0x177c] (진입 3a66a~3a716 이 공격 팀 st[9] 로 싣는다) */
  readonly offenseAces?: BenchClearingOffenseAces | null
}

const BATTER_INDEX = 8

/**
 * 진입 0x3a5f0 이 **새로 만든** 공격 줄(3a722~3a73c — `new` 9명, +0xec = 0)에 적는 +0xec (3a89c~3ab48, 직접 뜸 2026-10-14):
 * ```
 * 3a89c  칸 i = 0..8: 공격 팀 레코드 타자 배열에서 자리 니블이 i + 1 인 첫 레코드 → O[i]+0xec   (못 찾으면 0 그대로)
 * 3a97e  지금 타자(0xae89c([장면+0x220]))가 마선수면 [장면 + 0x1754 + 4·니블]+0xec ↔ O[8]+0xec      (O[니블 − 1])
 * 3aa1a  루 b = 1..3: 그 루 주자(0xa97a0)가 마선수 주자(+0x9c ≠ −1)면 레코드 k 마다 마선수 레코드의 O[니블 − 1]+0xec ↔ O[8 − b]+0xec
 * ```
 * 루 고리 꼬리 3ab36~3ab48: b + 1 · r6 −= 4 (O[7] → O[6] → O[5]) · b ≤ 3 이면 다시 — 루에 주자가 없으면 그 루는 건너뛴다.
 *
 * **니블 0 인 마선수 — O[−1] = [장면+0x1754]** (원본 버그 그대로 확정): 장면 +0x1754 는 공격 줄 +0x1758 바로 앞 칸이 아니라 공 궤적 점 표
 * (+0x1140 부터 0xc 바이트 — 0x33e34 가 x · y · z 를 +0x1140 · +0x1144 · +0x1148 + 0xc·k 에, 점 수 [[장면+0xf2c]+0x6c] 만큼 적는다)의
 * **129번 점의 z** 다. 0x1754 를 집는 곳은 이 함수의 네 곳(리터럴 0x3abb8)뿐이고 장면은 `new`(0x38bc: 0x1b80 바이트 memset 0)로 서므로,
 * 그 칸은 점이 130개 넘는 공이 한 번도 없었으면 0, 있었으면 그 점의 z 좌표다. 원본은 그 값을 야수 포인터로 읽어 (값 + 0xec) 번지의
 * 낱말과 O[8 − b]+0xec(타자면 O[8])를 맞바꾼다 — 그 칸에는 장면 밖 메모리의 쓰레기가 들어간다. 니블 0 인 마선수는 미션의 마타자다
 * (0xb53f0 의 0x40 갈래 b544a~b5470 이 XlsACE_BAT 행 0x30 바이트를 통째 베끼는데 그 +0x1c 가 다섯 행 모두 0 — 대타 0xaebe4 로 들어온
 * 마타자는 나가는 타자 니블을 받아 0 이 아니다).
 * ⚠️ 미확인: 그 번지의 값(기기 메모리)은 옮길 수 없다 — 웹은 맞바꾼 칸(O[8 − b])을 0(보통 그림)으로 둔다.
 */
export function benchOffenseSeatsOf(team: BenchClearingOffenseAces): readonly WalkerSeat[] {
  const seated: WalkerSeat[] = walkerRecordsOf(team.records).map((record) => (record === null ? null : { ace: record.ace }))
  const swap = (nibble: number, target: number) => {
    if (target < 0 || target >= seated.length) return
    if (nibble === 0) {
      // O[−1] = [장면+0x1754] 의 +0xec — 장면 밖 쓰레기와 맞바꾼다 (⚠️ 웹은 0)
      seated[target] = null
      return
    }
    const slot = nibble - 1
    if (slot < 0 || slot >= seated.length) return
    const held = seated[slot]
    seated[slot] = seated[target]
    seated[target] = held
  }
  const batter = team.batter ?? null
  if (batter !== null && batter.ace !== null) swap(batter.position & 0xf, BATTER_INDEX)
  ;(team.aceRunnerBases ?? [false, false, false]).forEach((isAce, baseIndex) => {
    if (!isAce) return
    for (const record of team.records) {
      if (record.ace !== null) swap(record.position & 0xf, BATTER_INDEX - 1 - baseIndex)
    }
  })
  return seated
}

/** 벤치 클리어링 공격 줄의 칸별 마선수 그림 (`benchOffenseSeatsOf` + 0x79b48) */
export function benchOffenseAceSpritesOf(team: BenchClearingOffenseAces): readonly (WalkerAceSprite | null)[] {
  return walkAceSpritesOfRecords(team.pitcherAce, benchOffenseSeatsOf(team), team.records)
}

/** 벤치 클리어링 뒤 두 줄 — 수비 줄은 그대로, 공격 줄은 새로 만든 9명(`benchOffenseSeatsOf`) */
export function seatsAfterBenchClearing(previous: WalkerLineSeats, offense: BenchClearingOffenseAces | null | undefined): WalkerLineSeats {
  return { defense: previous.defense, offense: offense == null ? previous.offense : benchOffenseSeatsOf(offense) }
}

/** 수비 판 재료 `RunnerAces` → 3aa1a 의 루별 마선수 주자(+0x9c ≠ −1) — 루에 주자가 없으면 거짓 */
export function aceRunnerBasesOf(
  aces: { readonly first?: number | null; readonly second?: number | null; readonly third?: number | null } | null | undefined,
  bases: { readonly first: boolean; readonly second: boolean; readonly third: boolean },
): readonly [boolean, boolean, boolean] {
  const isAce = (value: number | null | undefined) => value != null && value >= 0 && value <= 4
  return [bases.first && isAce(aces?.first), bases.second && isAce(aces?.second), bases.third && isAce(aces?.third)]
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
    // 수비 줄 +0xec 는 진입이 안 적는다 — 그 장면에서 마지막으로 적은 교대 판(0x3fac4) · 수비 판 시작(0xb0fb4)의 값 (`defenseSeats`)
    ...(source.defenseAces == null
      ? {}
      : {
          defenseAces: walkAceSpritesOfRecords(
            source.defenseAces.pitcherAce,
            source.defenseSeats ?? Array.from({ length: BATTER_INDEX + 1 }, () => null),
            source.defenseAces.records,
          ),
        }),
    ...(source.offenseAces == null ? {} : { offenseAces: benchOffenseAceSpritesOf(source.offenseAces) }),
  }
}
