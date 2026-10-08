import { AUTO_RELAY_SPEED_MAX, autoRelayRecordPort } from '@/entities/mode-save/model/autoRelayRecord'

/**
 * **자동진행 중계 속도 칸 v** — 원본 전역기록 +0xbc (0x1f1d9 가 돌려주는 블록, 0 · 1 · 2, 새 저장은 1). 0x21 키 0x3e25c 의 ←/'4' 가
 * −1(0 아래로 안 감), →/'6' 이 +1(2 위로 안 감)이고 바뀌면 0x1f1b9 로 파일까지 쓴다(`entities/mode-save` 의 `autoRelayRecord`).
 * 갱신 0x48480 은 v ≠ 2 면 장면 틱이 (2 − v) × 4 의 배수일 때만 0xc262c 를 부른다 — 0 은 8틱 · 1 은 4틱 · 2 는 매 틱(그리고
 * 안내 띠 · 속도 칸 · 연출 대기 · 배경음이 없다).
 */
export { AUTO_RELAY_SPEED_MAX }

export function autoRelaySpeed(): number {
  return autoRelayRecordPort().read().speed
}

export function setAutoRelaySpeed(next: number): void {
  autoRelayRecordPort().setSpeed(next)
}
