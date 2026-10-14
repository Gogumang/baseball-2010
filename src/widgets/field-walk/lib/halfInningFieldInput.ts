import { FIELDER_START_POSITIONS } from '@/entities/fielding/model/fieldGeometry'
import type { HalfInningFielderRoll } from '@/features/play-game/model/halfInningBoard'
import type { HalfInningWalkInput } from '@/widgets/field-walk/lib/halfInningWalk'

/** 수비 칸 수 */
const FIELDER_COUNT = 9

export interface HalfInningFieldSource {
  /** 판 틱 0 의 굴림 (`rollHalfInningFielders`). 없으면(옛 판 칸) 운동장을 안 그린다 */
  readonly rolls: readonly HalfInningFielderRoll[] | undefined
  /** 판이 서는 반 이닝 — 초면 측 0 공격 */
  readonly half: '초' | '말'
  /**
   * 이 경기 장면에서 수비 줄이 한 번도 안 섰나 — 0x3fac4 의 "자리 합 0" 갈래(카메라를 더그아웃에 곧바로, 앞 수비는 안 걷는다).
   * 경기 첫 판이 그렇다(판도 플레이 0x17 도 없었다). ⚠️ 근사: 부르는 쪽은 "이 장면의 첫 판" 으로 가른다.
   */
  readonly isFirstBoard: boolean
  /** 사람 측(st[0x31 + 측] == 0) · 두 팀 번호 — 그림 팔레트 */
  readonly playerSide: number
  readonly ourTeamId: number
  readonly opponentTeamId: number
  readonly grassPalette?: number | null
  /** 수비 칸별 이름표 이름 (칸 0 = 지금 투수) — `fielderNamesByPosition` */
  readonly fielderNames?: readonly (string | null)[]
}

/** 판 하나의 운동장 전경 재료 — `HalfInningBoard.field` */
export function halfInningFieldOf(source: HalfInningFieldSource) {
  if (source.rolls === undefined) return undefined
  const offenseSide: 0 | 1 = source.half === '초' ? 0 : 1
  const teamOf = (side: number) => (side === source.playerSide ? source.ourTeamId : source.opponentTeamId)
  const input: HalfInningWalkInput = {
    rolls: source.rolls,
    offenseSide,
    // ⚠️ 미확인 근사: 경기 첫 판이 아니면 원본은 앞 판(0x17)이 끝난 자리 그대로다 — 웹은 수비 시작 자리 표 0xcfa8c 로 둔다
    previousFielders: source.isFirstBoard ? null : FIELDER_START_POSITIONS,
  }
  return {
    input,
    defenseTeam: teamOf(offenseSide === 0 ? 1 : 0),
    offenseTeam: teamOf(offenseSide),
    grassPalette: source.grassPalette ?? null,
    ...(source.fielderNames === undefined ? {} : { fielderNames: source.fielderNames }),
  }
}

/**
 * 이름표 이름 — 칸 0 은 지금 투수 이름(0xae83c), 칸 1~8 은 수비 팀에서 위치 코드(레코드 +0x1c & 0xf)가 칸 + 1 인 첫 선수(0x40008).
 * 명단을 모르면 그 칸은 null.
 */
export function fielderNamesByPosition(
  pitcherName: string | null,
  lineup: readonly { readonly name: string; readonly position: number }[] | null,
): readonly (string | null)[] {
  return Array.from({ length: FIELDER_COUNT }, (_unused, slot) => {
    if (slot === 0) return pitcherName
    return lineup?.find((player) => player.position === slot + 1)?.name ?? null
  })
}
