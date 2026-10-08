/**
 * **경기 장면의 플레이 시계** — 장면 `+0x19d8`(시작 시각) · `+0x19e0`(멈춘 시간) 자리.
 *
 * - `0x3f554(장면)`: `[+0x19d8] = 0x14005c8()`(밀리초 시계) · `[+0x19e0] = 0`. 부르는 곳은 경기 장면 적재 `0x3f584`(0x3fa3e)와
 *   누계 `0x4e8b0` 자신뿐 → 웹은 경기 진행기를 세우는 자리에서 `startPlayClock` 을 부른다.
 * - `0x4e8b0(장면)`: 지난 시간 = 지금 − 시작 − 멈춘 시간을 모드 칸에 더하고(`annalsStats.addPlayTime`) 곧바로 다시 잰다.
 *   멈춘 시간 `+0x19e0` 은 원본에서 늘 0 이라(쓰는 곳이 `0x3f554` 의 0 하나) 일시정지 · 창 시간도 센다.
 *
 * 장면 객체 하나가 시계 하나를 갖는 것처럼, 경기 장면은 한 번에 하나라 모듈 칸 하나로 둔다. 시계를 아직 안 세웠으면 0 을 센다.
 */
let startedAt: number | null = null

/** `0x3f554` — 지금부터 다시 잰다 */
export function startPlayClock(now: number = Date.now()): void {
  startedAt = now
}

/** `0x4e8b0` 의 앞 절반 — 지난 밀리초를 돌려주고 지금부터 다시 잰다(`0x3f554`). 시계가 없으면 0 */
export function lapPlayClock(now: number = Date.now()): number {
  if (startedAt === null) return 0
  const elapsed = now - startedAt
  startedAt = now
  return elapsed
}
