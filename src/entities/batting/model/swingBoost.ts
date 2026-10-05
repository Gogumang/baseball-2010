import { D_LEVEL } from '@/shared/config/original/dLevel'

/**
 * **필살타법·마구 보정 구조체** — 경기 `0x34d6c(out12, 경기)` 가 만들어 타격 판정 `0xab214` 에
 * 스택 인자 12바이트로 통째로 넘긴다 (부르는 곳 0x51294 → memcpy 0x512e4 → 0x51308).
 * 투구 존과는 무관하다 (예전 주석의 "존 보정 네 쌍" 이 이것이다 — H2 2절).
 *
 * ```
 * 34da6: S = [경기+0xf9c] (스윙) ; if S+0x10 (이번 스윙의 필살 번호) != 0:
 *          B = 0xae89c(공격팀)
 *          마선수(0xb633d, rec[0xa] 비트6):  k = 레벨·5 + 순번   (레벨 = s8 mgr[0x13f + 순번])
 *              out+0 = D[0x100+2k] · out+2 = D[0x132+2k] · out+0xa = D[0x1a6+k] · out+0xb = D[0x1bf+k]
 *          elif 0xb6389 (rec[0xa] 비트7 = 육성·명전):  n = S+0x10 − 1
 *              out+0 = D[0x7c+2n] · out+2 = D[0x84+2n] · out+0xa = D[0x19e+n] · out+0xb = D[0x1a2+n]
 *          그 밖 → 0
 * 34ebc: P = [경기+0xf98] (공) ; if P+0x10 (공에 실린 마구 번호) != 0:  투수 = 0xae83c(수비팀)
 *          마선수:  k = 레벨·5 + 순번   (레벨 = s8 mgr[0x13a + 순번])
 *              out+4 = D[0xce+2k] · out+6 = D[0x9c+2k] · out+0xa = D[0x16c+k] · out+0xb = D[0x185+k]
 *          elif 비트7:  n = P+0x10 − 1
 *              out+4 = D[0x94+2n] · out+6 = D[0x8c+2n] · out+0xa = D[0x164+n] · out+0xb = D[0x168+n]
 * 34fcc: out+8 = out+9 = 0
 * ```
 * (D = d_level.dat 적재본, 객체 오프셋 = 파일 오프셋 + 4. `D_LEVEL.boost` 주석의 주소는 파일 오프셋이다.)
 *
 * - out+0xa/+0xb 는 투수 쪽이 **나중에 덮어쓴다** (0x34ff0 이 sp+8·r6 을 한 번만 쓴다) — 필살과 마구가
 *   겹치면 % 는 마구 값이다. 투수가 마선수도 비트7 도 아니면(공+0x10 은 남았는데 투수가 바뀐 경우)
 *   타자 쪽 % 가 그대로 남는다.
 * - ⚠️ **원본 버그 그대로**: 마구의 % 도 0xab214 에서 **타자의** B·C 에 더해진다(부호 양수).
 */
export interface SwingBoost {
  /** out+0 — 타자 히트 + (0xab4e0) */
  readonly batterHit: number
  /** out+2 — 타자 파워 + (0xab508) */
  readonly batterPower: number
  /** out+4 — 투수 구속 + (0xab554, 히트 쪽에서 빼는 값) */
  readonly pitcherVelocity: number
  /** out+6 — 투수 제구 + (0xab58c, 파워 쪽에서 빼는 값) */
  readonly pitcherControl: number
  /** out+0xa — B(잘 맞음) += B·값/100 (0xabd92) */
  readonly solidPercent: number
  /** out+0xb — C(홈런) += C·값/100 (0xabdae) */
  readonly homeRunPercent: number
}

/** 보정 없음 — 보통 스윙에 마구가 실리지 않은 공 */
export const NO_SWING_BOOST: SwingBoost = {
  batterHit: 0,
  batterPower: 0,
  pitcherVelocity: 0,
  pitcherControl: 0,
  solidPercent: 0,
  homeRunPercent: 0,
}

/** 0x34d6c 가 보는 한쪽 선수 */
export interface SwingBoostSide {
  /**
   * 타자면 스윙 `S+0x10` (이번 스윙의 필살 번호 = 타자 +0x18, 보통 스윙은 0 — 0x51dea),
   * 투수면 공 `P+0x10` (공에 실린 마구 번호 — 되돌리는 곳이 없어 마구 뒤의 공에도 남는다, H2 3-4).
   */
  readonly number: number
  /** 마선수인가 (0xb633d = rec[0xa] 비트6) */
  readonly isAce: boolean
  /** 마선수 순번 0~4 (0xb63a1). 다섯 명 값이 같아 결과에는 영향이 없다 */
  readonly aceOrder?: number
  /** 마선수 레벨 0~4 (`mgr[0x13a/0x13f + 순번]`) */
  readonly aceLevel?: number
  /** 육성·명전 선수인가 (0xb6389 = rec[0xa] 비트7) */
  readonly isOwnPlayer: boolean
}

const ACE_LEVEL_COUNT = 5
const ACE_ORDER_COUNT = 5

const clampIndex = (value: number, count: number) => Math.min(Math.max(Math.trunc(value), 0), count - 1)

/** 마선수 칸 k = 레벨·5 + 순번 (0x34df0~0x34df6 · 0x34f14~0x34f1a) */
function aceIndexOf(side: SwingBoostSide): number {
  return clampIndex(side.aceLevel ?? 0, ACE_LEVEL_COUNT) * ACE_ORDER_COUNT + clampIndex(side.aceOrder ?? 0, ACE_ORDER_COUNT)
}

/** 0x34d6c — 이번 스윙과 공에 실린 번호로 12바이트 보정을 만든다. 난수는 쓰지 않는다 */
export function swingBoostOf(batter: SwingBoostSide, pitcher: SwingBoostSide): SwingBoost {
  const table = D_LEVEL.boost
  let batterHit = 0
  let batterPower = 0
  let pitcherVelocity = 0
  let pitcherControl = 0
  let solidPercent = 0
  let homeRunPercent = 0

  if (batter.number !== 0) {
    if (batter.isAce) {
      const k = aceIndexOf(batter)
      batterHit = table.aceBatterHit[k] ?? 0
      batterPower = table.aceBatterPower[k] ?? 0
      solidPercent = table.aceBatterSolidPercent[k] ?? 0
      homeRunPercent = table.aceBatterHomeRunPercent[k] ?? 0
    } else if (batter.isOwnPlayer) {
      const n = batter.number - 1
      batterHit = table.burstBatterHit[n] ?? 0
      batterPower = table.burstBatterPower[n] ?? 0
      solidPercent = table.burstBatterSolidPercent[n] ?? 0
      homeRunPercent = table.burstBatterHomeRunPercent[n] ?? 0
    }
  }

  if (pitcher.number !== 0) {
    if (pitcher.isAce) {
      const k = aceIndexOf(pitcher)
      pitcherVelocity = table.acePitcherSpeed[k] ?? 0
      pitcherControl = table.acePitcherControl[k] ?? 0
      solidPercent = table.acePitcherSolidPercent[k] ?? 0
      homeRunPercent = table.acePitcherHomeRunPercent[k] ?? 0
    } else if (pitcher.isOwnPlayer) {
      const n = pitcher.number - 1
      pitcherVelocity = table.magicPitchSpeed[n] ?? 0
      pitcherControl = table.magicPitchControl[n] ?? 0
      solidPercent = table.magicPitchSolidPercent[n] ?? 0
      homeRunPercent = table.magicPitchHomeRunPercent[n] ?? 0
    }
  }

  return { batterHit, batterPower, pitcherVelocity, pitcherControl, solidPercent, homeRunPercent }
}

/**
 * 투수 레코드 +0x18(마구 번호)로 0x34d6c 의 투수 갈래를 고른다 — 웹 `Pitch.pitcherMagicNumber`.
 *   5~9 → 마투수 (마선수 레코드 +0x18 은 모두 5~9, 순번 = 번호 − 5 — H2 4-1)
 *   1~4 → 비트7(육성·명전): 일반 선수 레코드(XlsPITCHER_DATA 120명)는 +0x18 이 **모두 0** 이라
 *         번호를 가진 비(非)마선수는 육성·명전 선수뿐이다 (H2 4-2, 바이트 확인).
 *   0   → 일반 CPU 투수 — 보정 0
 */
export function pitcherBoostSideOf(ballMagicNumber: number, pitcherMagicNumber: number, aceLevelOfOrder: (order: number) => number): SwingBoostSide {
  const isAce = pitcherMagicNumber >= 5 && pitcherMagicNumber <= 9
  const aceOrder = isAce ? pitcherMagicNumber - 5 : 0
  return {
    number: ballMagicNumber,
    isAce,
    aceOrder,
    aceLevel: isAce ? aceLevelOfOrder(aceOrder) : 0,
    isOwnPlayer: !isAce && pitcherMagicNumber > 0,
  }
}
