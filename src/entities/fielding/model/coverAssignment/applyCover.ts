import { acceptsTargetVt14 } from '@/entities/fielding/model/fielderPose'
import { basePosition, isSamePoint } from '@/entities/fielding/model/fieldGeometry'
import { AI_STATE, NONE, type FielderState, type PlayView } from '@/entities/fielding/model/fieldingState'
import type { CoverAssignment } from '@/entities/fielding/model/coverAssignment/types'

/**
 * 커버 야수에게 AI 루 + 2 와 루 좌표 — vt48 0xa0a18 → vt14(루 좌표) = 0xa14c8 은 잠금 +0xb4 ≤ 0 · vtc8(+0xb1 · +0xcc)일 때만
 * 목표를 받는다(`acceptsTargetVt14`, r196). AI 는 관문과 상관없이 늘 루 + 2 다.
 */
function asCoverOf(fielder: FielderState, base: number): FielderState {
  const aiState = AI_STATE.COVER_HOME + base
  if (!acceptsTargetVt14(fielder)) return { ...fielder, aiState }
  return { ...fielder, aiState, target: basePosition(base), targetBase: base }
}

/** `assignCoversForTick` 의 답을 야수에게 — AI 0(b1d38 · b2540 0xb8dbc — AI 칸만, 목표는 다음 AI 0 b476a 가 고친다) 뒤 커버 야수 AI 루 + 2 · 루 좌표 (b1d38 · b2540 · b2564) */
export function applyCoverAssignment(fielders: readonly FielderState[], assigned: CoverAssignment): readonly FielderState[] {
  return fielders.map((fielder) => {
    const next = assigned.idleSlots.includes(fielder.slot) ? { ...fielder, aiState: AI_STATE.IDLE } : fielder
    const cover = assigned.coverStates.find((entry) => entry.slot === fielder.slot)
    // b25b6 vt14(루 좌표) — 관문이 막으면 AI 만 (b25c4 가 늘 루 + 2)
    return cover === undefined ? next : asCoverOf(next, cover.base)
  })
}

/**
 * **0xb2a48(P, f, 루)** — 루 커버 칸을 f 가 가져간다 (직접 뜬 것, r176):
 * ```
 * b2a52  C = +0xf0[루 % 4] ; C == −1 || C == f 면 끝
 * b2a7e  C.AI = 0 (0xb8dbc — +0x84 만)
 * b2a8a  +0xf0[루] = f ; f.vt48(루) = 0xa0a18 → vt14(루 좌표 0xd78f0[루 % 4]) ; f.AI = 루 + 2
 * b2ab6  +0x130 == C 면 +0x130 = f
 * ```
 * 부르는 곳: 루로 보내기 0xb2c90 의 직접 밟기(b2d64 — `runDefensePlay.sendToBase`)와 AI 2~5 의 b4814(+0x3b && vtcc).
 * 내려간 C 는 목표를 안 고친다 — 다음 걸음 전 AI 0 b476a 가 vtcc 면 시작 자리로 고친다.
 */
export function claimCoverOfBase<P extends Pick<PlayView, 'coverOfBase' | 'ballHolderSlot'>>(
  play: P,
  fielders: readonly FielderState[],
  slot: number,
  base: number,
): { readonly play: P; readonly fielders: readonly FielderState[] } {
  const previous = play.coverOfBase[((base % 4) + 4) % 4] ?? NONE
  if (previous === NONE || previous === slot) return { play, fielders }
  const coverOfBase = [...play.coverOfBase]
  coverOfBase[base] = slot
  const handOver = (fielder: FielderState): FielderState => {
    if (fielder.slot === previous) return { ...fielder, aiState: AI_STATE.IDLE }
    if (fielder.slot === slot) return asCoverOf(fielder, base)
    return fielder
  }
  return {
    play: { ...play, coverOfBase, ballHolderSlot: play.ballHolderSlot === previous ? slot : play.ballHolderSlot },
    fielders: fielders.map(handOver),
  }
}

/**
 * **AI 2~5 b4818~b482e — 커버 야수의 vt14(루 좌표)** (직접 뜸, r201). 분기표 0xd8808[2..5] = b47f2 는 +0x3b && vtcc 면 0xb2a48 을 부른 뒤
 * 조건 없이 `vt14(야수, 0xd86b0[상태 − 2])` 로 간다. vt14 = 0xa14c8 은 잠금 +0xb4 ≤ 0 · vtc8 일 때만 목표 +0x2c 를 받는다
 * (`acceptsTargetVt14`). 걸음 a1376 은 그 목표로만 가므로, 막힌 동안은 앞서 받은 목표(지우기 vt10 이면 제자리)로 간다.
 */
export function withCoverBaseTarget(fielders: readonly FielderState[], slot: number, base: number): readonly FielderState[] {
  const self = fielders[slot]
  if (self === undefined || !acceptsTargetVt14(self)) return fielders
  const point = basePosition(base)
  if (isSamePoint(self.target, point) && self.targetBase === base) return fielders
  return fielders.map((fielder) => (fielder.slot === slot ? { ...fielder, target: point, targetBase: base } : fielder))
}
