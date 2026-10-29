import { CATCH_KIND, type CatchKind } from '@/entities/fielding/model/catchPrediction/catchWindow'

/** 종류별 "가장 이른 포구 틱과 그 야수". 없으면 null */
export interface CatchOpportunity {
  readonly tick: number
  readonly slot: number
}

export interface CatchTable {
  /** +0x60 낮은 공 */
  readonly low: CatchOpportunity | null
  /** +0x84 가슴 높이 */
  readonly chest: CatchOpportunity | null
  /** +0xa8 땅볼(바운드 전 낮은 공) */
  readonly grounder: CatchOpportunity | null
  /** +0x3c 점프 */
  readonly jump: CatchOpportunity | null
  /** +0xcc 슬라이딩 */
  readonly slide: CatchOpportunity | null
}

export const EMPTY_CATCH_TABLE: CatchTable = {
  low: null,
  chest: null,
  grounder: null,
  jump: null,
  slide: null,
}

/** 표가 비었을 때 원본이 쓰는 큰 값 (0xb3b9c 의 100000) */
const NO_TICK = 100_000

export interface ChaseChoice {
  readonly kind: CatchKind
  /** 고른 야수 번호 (+0x170) */
  readonly slot: number
  /** 포구 틱 (+0x174) */
  readonly catchTick: number
  /** 동작 시작 틱 (+0x176) — 분기표 0xd87c0 */
  readonly actionStartTick: number
}

/**
 * 추적야수 고르기 0xb3b38 — 우선순위대로 한 명을 고른다.
 *
 * `nearestSlotToLowPoint` = 낮은 공 틱의 공 예측점 Q 에 가장 가까운 야수(동작 잠금이 아닌 야수 중).
 * 우선순위 1·8 이 이 야수를 쓴다.
 */
export function chooseChaser(table: CatchTable, landingTick: number, nearestSlotToLowPoint: number): ChaseChoice {
  return earlyChoiceOf(table, landingTick, nearestSlotToLowPoint) ?? lateChoiceOf(table, nearestSlotToLowPoint)
}

const tickOf = (entry: CatchOpportunity | null) => (entry === null ? NO_TICK : entry.tick)

/** 1~5: 낙구 전에 잡히는 것들. 필살(점프·슬라이딩)은 보통 포구가 가능하면 쓰이지 않는다. 없으면 null */
function earlyChoiceOf(table: CatchTable, landingTick: number, nearestSlotToLowPoint: number): ChaseChoice | null {
  const low = tickOf(table.low)
  const chest = tickOf(table.chest)
  const grounder = tickOf(table.grounder)
  if (low <= landingTick) return choiceOf(CATCH_KIND.LOW, nearestSlotToLowPoint, low)
  if (chest <= landingTick) return choiceOf(CATCH_KIND.CHEST, table.chest!.slot, chest)
  if (grounder <= landingTick) return choiceOf(CATCH_KIND.GROUNDER, table.grounder!.slot, grounder)
  return specialChoiceOf(table, landingTick)
}

/** 원본은 점프·슬라이딩 가지에만 "틱이 1 이 아닐 것" 을 덧붙인다 (0xb3c6e~). 그대로 옮긴다 */
function specialChoiceOf(table: CatchTable, landingTick: number): ChaseChoice | null {
  const jump = tickOf(table.jump)
  const slide = tickOf(table.slide)
  if (jump <= landingTick && jump !== 1) return choiceOf(CATCH_KIND.JUMP, table.jump!.slot, jump)
  if (slide <= landingTick && slide !== 1) return choiceOf(CATCH_KIND.SLIDE, table.slide!.slot, slide)
  return null
}

/** 6~8: 낙구 뒤(바운드 뒤) 잡기 */
function lateChoiceOf(table: CatchTable, nearestSlotToLowPoint: number): ChaseChoice {
  const low = tickOf(table.low)
  const chest = tickOf(table.chest)
  const grounder = tickOf(table.grounder)
  if (table.low !== null && low < chest + 2) return choiceOf(CATCH_KIND.LOW, table.low.slot, low)
  if (table.chest !== null && chest + 2 < grounder + 5) return choiceOf(CATCH_KIND.CHEST, table.chest.slot, chest)
  if (table.grounder !== null) return choiceOf(CATCH_KIND.GROUNDER, table.grounder.slot, grounder)
  return choiceOf(CATCH_KIND.LOW, nearestSlotToLowPoint, low)
}

/** 동작 시작 틱 분기표 0xd87c0 — 포구 틱에서 뺄 값 (종류0 그대로) */
const ACTION_START_LEAD: Readonly<Record<number, number>> = {
  [CATCH_KIND.CHEST]: 2,
  [CATCH_KIND.GROUNDER]: 1,
  [CATCH_KIND.JUMP]: 8,
  [CATCH_KIND.SLIDE]: 6,
}

/** 동작 시작 틱 분기표 0xd87c0: 종류0 그대로 · 1 −2 · 2 −1 · 3 −8 · 4 −6 */
export function actionStartTickOf(kind: CatchKind, catchTick: number): number {
  const lead = ACTION_START_LEAD[kind]
  return lead === undefined ? catchTick : catchTick - lead
}

function choiceOf(kind: CatchKind, slot: number, catchTick: number): ChaseChoice {
  return { kind, slot, catchTick, actionStartTick: actionStartTickOf(kind, catchTick) }
}
