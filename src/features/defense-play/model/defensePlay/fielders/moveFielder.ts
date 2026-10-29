import { isSamePoint, stepToward } from '@/entities/fielding/model/fieldGeometry'
import { AI_STATE, type FielderState } from '@/entities/fielding/model/fieldingState'

/** 0xa0ff4 — AI 상태가 루 커버(2~5)인가 */
export function isCoverState(aiState: number): boolean {
  return aiState >= AI_STATE.COVER_HOME && aiState <= AI_STATE.COVER_THIRD
}

interface FielderMoveInput {
  readonly chaserSlot: number
  readonly tick: number
  readonly catchTick: number
  /** 다음 야수 틱의 이동 관문(`canStepNextListTick`) — 거짓이면 목표만 고르고 제자리 */
  readonly canStep: boolean
}

/**
 * 야수 한 틱 — AI 상태가 세운 목표점으로 걷는다.
 * - AI 6(들고 뛰기) · 9(미룬 송구, b30d0 vt48(루)) · 0xa(키스톤 자리) — 세워 둔 목표점으로
 * - AI 2~5(루 커버) — 그 루 좌표로 (b2564 가 커버 야수에게 vt14(루) · AI 루 + 2 를 준다 — `assignCoversForTick`)
 * - 쫓는 야수는 포구 전까지 포구 지점으로(AI 1 — 목표는 AI 고리 b4aca 가 고친다, r190)
 * - AI 0xf(시작 자리로) — AI 고리 b4c2a 가 고친 목표로. vt8c(5)의 +0xcc 가 이동 관문을 닫아 실제로는 제자리다(r190)
 * - AI 0 — 그 목표로 걷는다. 시작 자리 고치기(b476a: vtcc 면 목표점이 시작 자리 0xd86ec 와 다를 때 vt50 = vt14)는 AI 고리(1c 절)가
 *   한다 — 던진 뒤(b2e14 · b48ac)·커버를 내준 뒤(b1d38 · b2540)·커버를 빼앗긴 뒤(b2a7e) AI 0 이 된 야수가 다음 고리에서 돌아선다 (r180)
 */
export function moveFielder(fielder: FielderState, input: FielderMoveInput): FielderState {
  if (walksToOwnTarget(fielder, input.chaserSlot)) return walkToTarget(fielder, input.canStep)
  // AI 1 b4aca · AI 0 b476a 는 vtcc(0xa2138 — 자세 워드 0 · +0xb4 ≤ 0 · +0xcc ≤ 0)가 거짓이면 목표를 안 고친다(b4ad6 · b477a → b4c60) —
  // 포구 동작 중(워드가 선) 야수는 앞서 세운 목표로 걷는다 (r171). 둘 다 AI 고리(1c 절)가 고친다(r180 · r190)
  if (fielder.slot === input.chaserSlot) return moveChaser(fielder, input)
  // AI 0 — 시작 자리 고치기(b476a)는 AI 고리(1c 절)가 한다. 걸음은 그 목표로
  return fielder.aiState === AI_STATE.IDLE ? walkToTarget(fielder, input.canStep) : fielder
}

/**
 * 세워 둔 목표점(+0x2c)으로만 걷는 AI 상태:
 * - AI 6(들고 뛰기) · 9(미룬 송구)
 * - AI 0xd(다이빙) — 분기표 0xd8808[0xd] = b4c60 아무것도 안 함. 다이빙 검사(`diveCheckOf`)가 세운 공점(n)으로 걷는다
 * - AI 0xc(백업) — AI 고리 b4b78 이 고친 목표로
 * - AI 0xf(시작 자리로) — AI 고리 b4c2a 가 고친 목표로. +0xcc(vt8c(5))가 서 있는 동안은 관문이 닫혀 제자리다
 * - AI 8(협살) — AI 고리의 0xb48b6(`rollRundownAi`)이 vt14 관문을 거쳐 고친 목표로 (r313 — 예전 웹은 2b 절이 관문 없이 곧바로 옮기고 여기서 멈췄다)
 * - AI 0xb(0xb4b5c) — 0xb3b38 담장 갈래가 세운 목표 +0x90(담장 앞)으로. **공을 쥐었어도 걷는다** (직접 뜬 것):
 *   분기 앞 b46c4~b46ec 은 상태 0 · 0xa · 0xd · 커버(2~5)만 다이빙 검사로 보내고 0xb 는 곧장 분기표 0xd8808[0xb] = b4b5c 로 간다.
 *   b4b5c 는 +0x90 을 [sp+0x40] 에 베끼고 r4 = 야수 vt14 로 b482e 에 가며, b482e 는 조건 없이 vt14(야수, x, y, z) 를 부르고
 *   b4c60(다음 야수)로 끝난다. vt14 = 0xa14c8 이 보는 것은 동작 잠금 +0xb4 ≤ 0 · vtc8(0xa2118 = +0xb1(던진 뒤 잠금) == 0 &&
 *   +0xcc ≤ 0) · 목표가 바뀌었나(0xbc0f4)뿐 — 공 쥠 +0xe0 은 어디에도 없다(다른 AI 상태의 vt14 와 같은 관문이라 웹 `walk` 처럼 본다)
 */
const TARGET_WALK_STATES: ReadonlySet<number> = new Set([
  AI_STATE.CARRY,
  AI_STATE.RECEIVE,
  AI_STATE.DIVE,
  AI_STATE.BACKUP,
  AI_STATE.RETURN,
  AI_STATE.RUNDOWN,
  AI_STATE.PICK_UP,
])

/**
 * AI 2~5(루 커버) — b4818~b482e 의 vt14(루 좌표)는 AI 고리(1c 절)가 관문(잠금 · vtc8)을 거쳐 적는다. 걸음 a1376 은 목표(+0x2c)로만 간다
 * (r201 — 예전 웹은 여기서 목표를 안 보고 루 좌표로 걸어 vt14 관문이 이 진행기에서는 안 걸렸다). 쫓는 야수가 아닌 AI 0xa(키스톤 자리)도 그 목표로
 */
function walksToOwnTarget(fielder: FielderState, chaserSlot: number): boolean {
  if (TARGET_WALK_STATES.has(fielder.aiState) || isCoverState(fielder.aiState)) return true
  return fielder.aiState === AI_STATE.BUSY && fielder.slot !== chaserSlot
}

/**
 * 쫓는 야수 — 포구 전에는 AI 1 로 목표(AI 고리 b4aca 가 고쳤다, r190)를 걷는다. 쥔 AI 1 야수 — b4ae6(+0xe0)에서 목표를 안 고치고
 * 끝나지만, 야수 틱의 걸음 a1376(0xbf094)은 AI · 공 쥠을 안 보고 목표로 간다(r176)
 */
function moveChaser(fielder: FielderState, input: FielderMoveInput): FielderState {
  if (input.tick < input.catchTick) return { ...walkToTarget(fielder, input.canStep), aiState: AI_STATE.CHASE }
  if (fielder.aiState === AI_STATE.IDLE || fielder.holdingBall) return walkToTarget(fielder, input.canStep)
  return fielder
}

/** 목표점으로 한 걸음 — 이미 닿았거나 이동 관문이 닫혔으면 목표만 다시 적는다 */
function walkToTarget(fielder: FielderState, canStep: boolean): FielderState {
  const target = fielder.target
  if (isSamePoint(fielder.position, target) || !canStep) return { ...fielder, target }
  return { ...fielder, target, position: stepToward(fielder.position, target, fielder.speed) }
}
