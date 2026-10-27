/**
 * **나리 관리 메뉴 목록의 키** — 105 [this+0x8c] · 106 [+0x90] · 107 [+0x94] · 110 [+0x98] (타자편 · 투수편 공용, 장면 0x106).
 *
 * 네 목록은 장면 셋업 0xf684 가 모두 0x6c219 로 짓는다 — vtable 0xd2ea0(직접 떴다):
 * ```
 * vt+0x18 0x6c299 → 0x6c521 → 0x6c031   키: 숫자키 꼴 1(+4 == 1)이면 표 0xd2e7c 로 '2' ↑ · '4' ← · '5' OK · '6' → · '8' ↓
 * vt+0x08 0x6c445                          방향 이동 — 켬 표(+0x28)가 0 인 칸은 **건너뛴다**:
 *   n = 켜진 칸 수(0x6c3f4) ; 지금 칸이 켜졌으면 n ≤ 1, 꺼졌으면 n ≤ 0 이면 안 움직인다
 *   되풀이: 0x6be71 로 한 칸 옮기고(못 움직였으면 출발 칸으로) 그 칸이 꺼졌으면 또 옮긴다
 * vt+0x0c 0x6bead                          옮기기 — 꼴 0x330(105 진입 머리 0x1c154 의 vt+0x1c(6 · 5, 1, 1, 0x330)):
 *   0x10 가로 감기 · 0x20 세로 감기 · 0x200 세로로 감기면 열 ±1 → 한 줄 메뉴에서 ↑ 는 ← · ↓ 는 → 와 같다
 * ```
 * 105 키 0x1261c · 106 키 0x13010 은 OK(−5) · '5'(0x35) · 취소(−16)를 먼저 보고 나머지를 vt+0x18 에 넘긴다.
 * 그래서 행동한 뒤 흑백(켬 표 0)인 트레이닝 · 휴식 · 외출 칸에는 커서가 **서지 못한다** — 확인 키가 켬 표를 안 보는 것과 별개로
 * 그 칸을 고를 길이 없다(숫자 바로 고르기 0x6c520 도 꼴 1 이라 돌지 않는다).
 */

/** 원본 키 → 한 칸 이동 (−1 = 앞 칸 · +1 = 다음 칸 · 0 = 이동 키가 아님) */
export function nariMenuStepOfKey(key: string): -1 | 0 | 1 {
  if (key === 'ArrowLeft' || key === 'ArrowUp' || key === '4' || key === '2') return -1
  if (key === 'ArrowRight' || key === 'ArrowDown' || key === '6' || key === '8') return 1
  return 0
}

/** 확인 — OK(−5) · '5'(0x35) */
export function isNariMenuOkKey(key: string): boolean {
  return key === 'Enter' || key === '5'
}

/**
 * vt+8 0x6c445 — `step` 만큼 감아 돌며 꺼진 칸(`isOff`)을 건너뛴 커서. 한 줄 메뉴라 0x6be71 은 늘 움직인다(가로 감기).
 */
export function nariMenuCursorAfterStep(
  cursor: number,
  step: -1 | 1,
  slotCount: number,
  isOff: (index: number) => boolean,
): number {
  let onCount = 0
  for (let index = 0; index < slotCount; index += 1) if (!isOff(index)) onCount += 1
  if (onCount <= (isOff(cursor) ? 0 : 1)) return cursor
  let next = cursor
  do next = (next + step + slotCount) % slotCount
  while (isOff(next))
  return next
}
