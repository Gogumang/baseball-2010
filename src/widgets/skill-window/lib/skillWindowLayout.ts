/**
 * 스킬 창 배치 — 선수정보 칸 "아이템/스킬"(하위 상태 122).
 *
 * ⚠️ **미해결 — 좌표는 전부 근사다.** 원본 창 그리기 0x81dc0(this, …) 은 0x8453c 에서만 불리고
 * 배치 좌표·색을 아직 못 읽었다 (H-modes 6절). 칭호 목록 창처럼 같은 장면의 **필살타법 창(0x803d4, 확정 좌표)**
 * 틀을 빌려 줄만 채운다. 줄 수(9)도 칭호 목록을 따른 근사다.
 */
export const SKILL_WINDOW = { x: 24, y: 71, width: 192, height: 151 } as const
export const SKILL_HEADER = { x: 30, y: 76, width: 180, height: 14 } as const
export const SKILL_ROW = { x: 32, width: 176, height: 13 } as const
export const SKILL_ROW_TOP = 94
export const SKILL_ROWS_PER_PAGE = 9
