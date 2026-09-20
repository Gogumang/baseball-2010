/**
 * 나만의리그 **투수편**(모드 3) 선수 레코드의 보직·포지션 칸.
 *
 * 원본 투수 레코드(0x30 바이트)에서 보직·포지션을 읽는 두 함수가 따로 있다:
 *   - `0xb6dec` / `0xb6704` = `rec[+0xb] & 3` — **보직**. 등판 판정(P1 1-2)·감독 강판(P1 2-1)·
 *     사기(P1 5-4)·GP 아이템 한계(R7 3절)가 본다.
 *   - `0xb6394` = `rec[+0xa] & 0x1f` — **포지션 코드**. 경기 뒤 인기도(P1 5-3)와 감독 평가 글(P1 5-5)이
 *     "≤ 3 이면 선발형, > 3 이면 구원형" 으로만 쓴다.
 * 두 칸이 늘 같은 값을 가리키는지는 원본 문서에 없다 — **따로 둔다**.
 */

/** 보직 = `rec[+0xb] & 3` (0xb6dec · 0xb6704) */
export type PitcherRole = 0 | 1 | 2

export const PITCHER_ROLE = {
  /** 0 = 선발. 투수편에서 "2경기마다 등판" 하는 쪽이다 (P1 1-2) */
  starter: 0,
  /**
   * 1 = 원본 문서가 뜻을 적지 않은 값. 등판 판정 0xa4f60 은 **0 이 아니면 전부 -1** 로 돌려보내므로
   * 선발 로테이션을 타지 않고, 감독 강판(2 만 면제)은 그대로 걸린다.
   */
  unknown: 1,
  /** 2 = 구원. 8회에 교체로 등판하고 감독 강판이 없다 (P1 1-3 · 2-1) */
  relief: 2,
} as const

export function pitcherRoleOf(recordByte0x0b: number): PitcherRole {
  return (recordByte0x0b & 3) as PitcherRole
}

/** 포지션 코드 = `rec[+0xa] & 0x1f` (0xb6394) */
export function pitcherPositionCodeOf(recordByte0x0a: number): number {
  return recordByte0x0a & 0x1f
}

/**
 * 경기 뒤 평가가 갈리는 기준 (0xa6aa4 · 0x1285a). 보직이 아니라 **포지션 코드**로 가른다.
 * 원본이 이 둘을 따로 쓰는 이유는 문서에 없다 — 그대로 옮긴다.
 */
export function isStarterTypePosition(positionCode: number): boolean {
  return positionCode <= 3
}
