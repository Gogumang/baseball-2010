/**
 * **자동진행 중계 속도 칸 v** — 원본 전역 저장 +0xbc (0x1f1d9 가 돌려주는 블록, 0 · 1 · 2). 0x21 키 0x3e25c 의 ←/'4' 가 −1(0 아래로
 * 안 감), →/'6' 이 +1(2 위로 안 감)이고 바뀌면 0x1f1b9 로 저장한다. 갱신 0x48480 은 v ≠ 2 면 장면 틱이 (2 − v) × 4 의 배수일 때만
 * 0xc262c 를 부른다 — 0 은 8틱 · 1 은 4틱 · 2 는 매 틱(그리고 안내 띠 · 속도 칸 · 연출 대기 · 배경음이 없다).
 *
 * ⚠️ 웹은 저장 블록에 칸이 없어 이 창(탭)이 살아 있는 동안만 기억한다 — 처음 값 0(새 저장의 0 으로 둔다).
 */
let speed = 0

export const AUTO_RELAY_SPEED_MAX = 2

export function autoRelaySpeed(): number {
  return speed
}

export function setAutoRelaySpeed(next: number): void {
  speed = Math.min(AUTO_RELAY_SPEED_MAX, Math.max(0, next))
}
