import type { MutableRefObject } from 'react'
import type { HalfInningFielderRoll } from '@/features/play-game/model/halfInningBoard'
import type { FieldCarry } from '@/widgets/field-walk/lib/fieldCarry'
import type { HalfInningWalkInput, HalfInningWalkState } from '@/widgets/field-walk/lib/halfInningWalk'
import { type WalkTeamAces, type WalkerLineSeats, walkAceSpritesOf } from '@/widgets/field-walk/lib/walkerAces'

/** 수비 칸 수 */
const FIELDER_COUNT = 9

export interface HalfInningFieldSource {
  /** 판 틱 0 의 굴림 (`rollHalfInningFielders`). 없으면(옛 판 칸) 운동장을 안 그린다 */
  readonly rolls: readonly HalfInningFielderRoll[] | undefined
  /** 판이 서는 반 이닝 — 초면 측 0 공격 */
  readonly half: '초' | '말'
  /**
   * 판이 서기 전 수비 줄 자리 · 카메라 — 앞 장면이 남긴 그대로(`lib/fieldCarry`). null · 안 줌이면 경기 장면을 세운 뒤 아무도 안 옮긴
   * 것(자리 (0, 0, 0)) — 0x3fac4 의 "자리 합 0" 갈래(카메라를 더그아웃에 곧바로, 앞 수비는 안 걷는다)다.
   */
  readonly carry?: FieldCarry | null
  /** 사람 측(st[0x31 + 측] == 0) · 두 팀 번호 — 그림 팔레트 */
  readonly playerSide: number
  readonly ourTeamId: number
  readonly opponentTeamId: number
  readonly grassPalette?: number | null
  /** 수비 칸별 이름표 이름 (칸 0 = 지금 투수) — `fielderNamesByPosition` */
  readonly fielderNames?: readonly (string | null)[]
  /** 수비 팀 · 공격 팀의 마선수 재료 (0x79b48 a · b — `lib/walkerAces`). 안 주면 보통 그림 */
  readonly defenseAces?: WalkTeamAces | null
  readonly offenseAces?: WalkTeamAces | null
  /**
   * 판이 서기 전 두 줄의 +0xec — 0x3fac4 는 자리 니블이 맞는 레코드가 없는 칸을 안 덮어 앞 값이 남는다(`walkerRecordsOf`).
   * 안 주면 경기 장면을 세운 뒤 아무도 안 적은 줄(모두 0)이다. 판 뒤 값은 `seatsAfterHalfInningBoard`
   */
  readonly seats?: WalkerLineSeats | null
  /** 그린 틱의 걸음 상태를 적어 둘 칸 — 판이 닫힐 때 `fieldCarryAfterHalfInning` 으로 넘긴다 */
  readonly walkStateRef?: MutableRefObject<HalfInningWalkState | null>
}

/** 판 하나의 운동장 전경 재료 — `HalfInningBoard.field` */
export function halfInningFieldOf(source: HalfInningFieldSource) {
  if (source.rolls === undefined) return undefined
  const offenseSide: 0 | 1 = source.half === '초' ? 0 : 1
  const teamOf = (side: number) => (side === source.playerSide ? source.ourTeamId : source.opponentTeamId)
  const carry = source.carry ?? null
  const input: HalfInningWalkInput = {
    rolls: source.rolls,
    offenseSide,
    previousFielders: carry === null ? null : carry.fielders,
    ...(carry === null || carry.camera === null ? {} : { previousCamera: carry.camera }),
  }
  return {
    input,
    defenseTeam: teamOf(offenseSide === 0 ? 1 : 0),
    offenseTeam: teamOf(offenseSide),
    grassPalette: source.grassPalette ?? null,
    ...(source.fielderNames === undefined ? {} : { fielderNames: source.fielderNames }),
    ...(source.defenseAces == null ? {} : { defenseAces: walkAceSpritesOf(source.defenseAces, source.seats?.defense) }),
    ...(source.offenseAces == null ? {} : { offenseAces: walkAceSpritesOf(source.offenseAces, source.seats?.offense) }),
    ...(source.walkStateRef === undefined ? {} : { walkStateRef: source.walkStateRef }),
  }
}

/**
 * 이름표 이름 — 칸 0 은 지금 투수 이름(0xae83c), 칸 1~8 은 0x40008(장면, 칸): 수비 팀 `0xb8680(팀)` 의 **레코드 타자 배열**
 * (`[T+0x18]`, 수 `[T+0x10]`)을 `0xb8a34(팀, k)` 로 차례대로 훑어 자리 니블(+0x1c & 0xf)이 칸 + 1 인 첫 레코드(40032~400a4, 직접 뜸).
 * `lineup` 은 그 레코드 차례 그대로 넘긴다(대타 0xaebe4 가 맞바꾼 니블까지 — 각 모드의 수비 판 이름 판과 같은 훑기). 명단을 모르면 그 칸은 null.
 */
export function fielderNamesByPosition(
  pitcherName: string | null,
  lineup: readonly { readonly name: string; readonly position: number }[] | null,
): readonly (string | null)[] {
  return Array.from({ length: FIELDER_COUNT }, (_unused, slot) => {
    if (slot === 0) return pitcherName
    return lineup?.find((player) => (player.position & 0xf) === slot + 1)?.name ?? null
  })
}
