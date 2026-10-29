/** 사인표 0xd310c — round(100·sin θ), θ = 0~90 */
const SINE_TABLE = [
  0, 2, 3, 5, 7, 9, 10, 12, 14, 16, 17, 19, 21, 22, 24, 26, 28, 29, 31, 33, 34, 36, 37, 39, 41, 42, 44, 45, 47, 48, 50, 52, 53, 54, 56, 57, 59, 60,
  62, 63, 64, 66, 67, 68, 69, 71, 72, 73, 74, 75, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 87, 88, 89, 90, 91, 91, 92, 93, 93, 94, 95, 95, 96, 96,
  97, 97, 97, 98, 98, 98, 99, 99, 99, 99, 100, 100, 100, 100, 100, 100,
]

/** 0x6c6a8 — 음수면 +360, 180 초과면 −sin(θ−180), 90 초과면 sin(180−θ) */
export function sineOf(degrees: number): number {
  let angle = degrees
  while (angle < 0) angle += 360
  angle %= 360
  if (angle > 180) return -sineOf(angle - 180)
  if (angle > 90) return SINE_TABLE[180 - angle]
  return SINE_TABLE[angle]
}

const SLIDE_START_Y = 170
const SLIDE_DEGREES_PER_UPDATE = 16
const SLIDE_LAST_DEGREES = 110

/** 사인 곡선 이동 (0x7ff8c) — start 에서 target 으로, t = 시작 뒤 갱신 수. 조금 넘친 뒤 선다 */
export function slidePositionAt(start: number, target: number, updates: number): number {
  const range = target - start
  const base = range - Math.trunc(((updates === 0 ? sineOf(90) : sineOf(SLIDE_LAST_DEGREES)) * range) / 100)
  return Math.trunc((sineOf(Math.min(SLIDE_DEGREES_PER_UPDATE * updates, SLIDE_LAST_DEGREES)) * range) / 100) + base + start
}

/** 커맨드 칸 등장 — y170 에서 내려온다 */
export function commandSlotYAt(targetY: number, updates: number): number {
  return slidePositionAt(SLIDE_START_Y, targetY, updates)
}
