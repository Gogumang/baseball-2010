/**
 * 시즌 외출 지도 — 그리기 0xa04c(0xd1) · 0xa06c(0xe3) 가 `0x7ea64(gfx, p, 0)` 를 **고른 칸 p** 로 부른다 (F 2절, 직접 떴다).
 * 나리 이벤트 밑그림(`OutingMapUnderlay`, 고른 칸 −1)과 같은 함수의 다른 갈래다:
 * ```
 * 0x7eb0a  고르지 않은 건물: 효과 1 · 인자 7 (7/16) · 이름(검정 테두리 · 흰 글) — 고른 칸은 이 고리에서 건너뛴다
 * 0x7eba2  밤이면 화면 단계 9 어둡게 · 프레임 6
 * 0x7ec04  고른 건물: 프레임 p+1 을 단색 흰색으로 (±1, 0) · (0, ±1) 네 번 → 보통으로 한 번 (흰 1px 테두리)
 * 0x7ecca  고른 이름: 테두리 노랑 RGB(255,255,0) · 글 검정
 * 0x7ecfc  선택 화살표 — 박스 1 의 (mapX + bx + bw/2, mapY + by) 에 event_map 애니 0
 * 0x7ed6c  [!] — [gfx+0x9c] 칸. 시즌은 외출 지도에 이벤트가 서지 않아(화면코드 209 를 받는 trigger 가 없다) 그리지 않는다
 * 0x7ee1a  말풍선은 [gfx+0x174] ∈ {0x71, 0xd2} 일 때만 — 0xd1 · 0xe3 에는 없다
 * ```
 *
 * 방향 이동 `0x7f3e4(gfx, 칸, 키)` (직접 떴다) — 표 **0xd491c** `[칸 × 4 + 방향]` (s8):
 * ```
 * 키 −1 · '2' → 0 (위) · −2 · '8' → 1 (아래) · −3 · '4' → 2 (왼쪽) · −4 · '6' → 3 (오른쪽) · 그 밖 → 그대로
 * ```
 */
export const SEASON_OUTING_MAP_MOVES: readonly (readonly [number, number, number, number])[] = [
  [1, 4, 2, 3],
  [4, 0, 2, 3],
  [1, 4, 3, 0],
  [1, 4, 0, 2],
  [0, 1, 2, 3],
]

/** 웹 키 → 0x7f3e4 의 방향 칸 (위 0 · 아래 1 · 왼쪽 2 · 오른쪽 3). 방향 키가 아니면 null */
export function outingMapDirectionOf(key: string): number | null {
  switch (key) {
    case 'ArrowUp':
    case '2':
      return 0
    case 'ArrowDown':
    case '8':
      return 1
    case 'ArrowLeft':
    case '4':
      return 2
    case 'ArrowRight':
    case '6':
      return 3
    default:
      return null
  }
}

/** 0x7f3e4 — 지금 칸에서 방향으로 옮긴 칸 */
export function moveOutingMapCursor(cursor: number, direction: number): number {
  return SEASON_OUTING_MAP_MOVES[cursor]?.[direction] ?? cursor
}
