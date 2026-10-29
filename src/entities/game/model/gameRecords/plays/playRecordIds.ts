/*
 * ── 남은 아홉 가지 (R8 5절·4-4·8절 표) — 판정 함수만 있다. 배선은 아직 없다. ──
 *
 * 모두 0xa77f0 게이트를 **통과하기 전** 의 후보를 돌려준다. 게이트는 번호마다 방향이 고정이다:
 *   5·6·7·8·32·33 = 사람 **공격** 때만, 24·26·27·36 = 사람 **수비** 때만 집계.
 * 부르는 쪽이 그 방향을 맞춰야 한다 (예: 사람 공격 중 잡힌 도루는 24 후보가 나오지만 게이트에서 버려진다).
 */

export const PLAY_RECORD = {
  pinchHitHomeRun: 5,
  backToBack: 6,
  backToBackToBack: 7,
  stolenBase: 8,
  caughtStealing: 24,
  doublePlay: 26,
  triplePlay: 27,
  threeFouls: 32,
  fourFouls: 33,
  laserThrowOut: 36,
} as const
