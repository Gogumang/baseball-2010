import { PITCHER_BURSTS } from '@/shared/config/original/bursts'

/**
 * 필살 줄 (0x7cb5c~0x7cbc0) — n = 레코드 +0x18 > 0 이면 StrCOMMON[0x18 + n + 6 + (n == 4 ? 타입 : 0)]. 0 이면 안 쓴다.
 * StrCOMMON 31~36 은 마구 여섯(`PITCHER_BURSTS`). ⚠️ n 5~9(마투수)는 나리 투수에 오지 않아 확인하지 않았다(StrCOMMON 36 + … 이 된다).
 */
export function pitcherInfoSpecialNameOf(magicNumber: number, typeIndex: number): string {
  if (magicNumber <= 0) return ''
  const index = 0x18 + magicNumber + 6 + (magicNumber === 4 ? typeIndex : 0)
  return PITCHER_BURSTS[index - 0x1f] ?? ''
}
