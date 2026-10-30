import rawConfig from '@/shared/config/balance/balance.json'
import { ORIGINAL_BALANCE_VALUES } from '@/shared/config/balance/originalBalance'
import type { BalanceGridId, BalanceId, BalanceListId, BalanceNumberId, BalanceValue, BalanceValues } from '@/shared/config/balance/originalBalance'

/**
 * **숨은 판정값 표** — 화면의 능력치(히트·파워·수비·주루 · 제구·구속·변화) 말고 안타 · 삼진 · 홈런 · 실책 확률을 정하는
 * 상수를 `balance.json` 한 파일로 뺐다 (사용자 요청 2026-10-26: "능력치 밖으로 보이는 능력치들도 json 같은걸로 따로 뺄 수 있어?").
 *
 * - 항목마다 `value`(원본 값) · `source`(원본 주소) · `effect`(바꾸면 무엇이 어떻게 변하나) · `range`(의미 있는 범위)를 둔다.
 * - **기본값은 원본과 같다** — `originalBalance.ts` 가 원본 값이고 `balance.test.ts` 가 하나씩 견준다.
 * - 판정 코드는 상수 대신 `balanceNumber` · `balanceList` · `balanceGrid` 로 **부를 때마다** 읽는다.
 *   값만 바꾸고 굴림 차례는 그대로라 난수 차례는 원본과 같다.
 * - 표(목록 · 격자)는 칸 수를 바꿀 수 없다 — 코드가 칸 번호로 읽기 때문이다. `range` 밖의 값은 막는다(0 으로 나누기 등).
 *
 * 시험은 `originalBalanceForTests`(vitest `setupFiles`)로 늘 원본 값을 쓴다 — JSON 을 고쳐도 시험은 흔들리지 않는다.
 */
export type BalanceCategory = 'timing' | 'swing' | 'skill' | 'ability' | 'pitching' | 'fielding' | 'running'

export const BALANCE_CATEGORIES: readonly BalanceCategory[] = ['timing', 'swing', 'skill', 'ability', 'pitching', 'fielding', 'running']

export interface BalanceRange {
  readonly min: number
  readonly max: number
}

export interface BalanceEntry {
  readonly id: BalanceId
  readonly category: BalanceCategory
  /** 사람이 읽는 이름 */
  readonly name: string
  readonly value: BalanceValue
  /** 근거 주소 */
  readonly source: string
  /** 바꾸면 무엇이 어떻게 변하나 (한 줄) */
  readonly effect: string
  /** 의미 있는 범위 — 표면 모든 칸에 같이 건다 */
  readonly range: BalanceRange
}

export interface BalanceConfig {
  readonly entries: readonly BalanceEntry[]
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

/** 값 모양이 원본과 같은가 (수 · 같은 길이 목록 · 같은 모양 격자) — 틀리면 까닭을 돌려준다 */
function shapeProblemOf(value: unknown, original: BalanceValue): string | null {
  if (typeof original === 'number') return isNumber(value) ? null : '수여야 한다'
  if (!Array.isArray(value) || value.length !== original.length) return `칸 ${original.length} 개 배열이어야 한다`
  for (let index = 0; index < original.length; index += 1) {
    const problem = cellProblemOf(original[index] as number | readonly number[], value[index] as unknown, index)
    if (problem !== null) return problem
  }
  return null
}

/** 목록 · 격자의 칸 하나 — 원본 칸이 수면 수, 줄이면 같은 길이의 수 줄 */
function cellProblemOf(expected: number | readonly number[], actual: unknown, index: number): string | null {
  if (typeof expected === 'number') return isNumber(actual) ? null : `[${index}] 은 수여야 한다`
  if (!Array.isArray(actual) || actual.length !== expected.length || !actual.every(isNumber)) {
    return `[${index}] 는 수 ${expected.length} 개 배열이어야 한다`
  }
  return null
}

const leavesOf = (value: BalanceValue): readonly number[] =>
  typeof value === 'number' ? [value] : (value as readonly (number | readonly number[])[]).flatMap((cell) => cell)

/** id 가 원본 표에 있고 앞 항목과 겹치지 않는가 — 본 id 로 적는다 */
function claimBalanceId(where: string, id: unknown, seen: Set<string>): BalanceId {
  if (typeof id !== 'string' || !(id in ORIGINAL_BALANCE_VALUES)) throw new Error(`${where}: id ${String(id)} 를 모른다`)
  if (seen.has(id)) throw new Error(`${where}: id ${id} 가 겹친다`)
  seen.add(id)
  return id as BalanceId
}

/** range 는 { min, max } (min ≤ max) */
function balanceRangeOf(where: string, range: unknown): BalanceRange {
  const min = isRecord(range) ? range.min : undefined
  const max = isRecord(range) ? range.max : undefined
  if (!isNumber(min) || !isNumber(max) || min > max) throw new Error(`${where}: range 는 { min, max } (min ≤ max) 다`)
  return { min, max }
}

/** 값 — 원본과 같은 모양이고 모든 칸이 범위 안 */
function balanceValueOf(where: string, id: BalanceId, value: unknown, { min, max }: BalanceRange): BalanceValue {
  const problem = shapeProblemOf(value, ORIGINAL_BALANCE_VALUES[id])
  if (problem !== null) throw new Error(`${where} (${id}): value ${problem}`)
  const typed = value as BalanceValue
  const outside = leavesOf(typed).find((leaf) => leaf < min || leaf > max)
  if (outside !== undefined) throw new Error(`${where} (${id}): value ${outside} 가 범위 ${min}~${max} 밖이다`)
  return typed
}

function parseBalanceEntry(entry: unknown, index: number, seen: Set<string>): BalanceEntry {
  const where = `balance.json entries[${index}]`
  if (!isRecord(entry)) throw new Error(`${where}: 객체가 아니다`)
  const { id, category, name, value, source, effect, range } = entry
  const balanceId = claimBalanceId(where, id, seen)
  if (typeof category !== 'string' || !BALANCE_CATEGORIES.includes(category as BalanceCategory)) {
    throw new Error(`${where}: category ${String(category)} 를 모른다`)
  }
  if (typeof name !== 'string' || typeof source !== 'string' || typeof effect !== 'string') {
    throw new Error(`${where}: name · source · effect 는 글이다`)
  }
  const checkedRange = balanceRangeOf(where, range)
  return {
    id: balanceId,
    category: category as BalanceCategory,
    name,
    value: balanceValueOf(where, balanceId, value, checkedRange),
    source,
    effect,
    range: checkedRange,
  }
}

/** JSON 모양을 검사해 타입을 입힌다 — 틀리면 어디가 틀렸는지 적고 멈춘다 */
export function parseBalanceConfig(raw: unknown): BalanceConfig {
  if (!isRecord(raw)) throw new Error('balance.json: 객체가 아니다')
  if (!Array.isArray(raw.entries)) throw new Error('balance.json: entries 는 배열이다')
  const seen = new Set<string>()
  const entries = raw.entries.map((entry: unknown, index): BalanceEntry => parseBalanceEntry(entry, index, seen))
  const missing = Object.keys(ORIGINAL_BALANCE_VALUES).filter((id) => !seen.has(id))
  if (missing.length > 0) throw new Error(`balance.json: 항목이 빠졌다 — ${missing.join(', ')}`)
  return { entries }
}

/** `balance.json` 그대로 */
export const BALANCE_CONFIG: BalanceConfig = parseBalanceConfig(rawConfig)

/** `balance.json` 의 값 */
export const BALANCE_JSON_VALUES: BalanceValues = Object.fromEntries(BALANCE_CONFIG.entries.map((entry) => [entry.id, entry.value])) as BalanceValues

let activeValues: BalanceValues = BALANCE_JSON_VALUES

/**
 * 시험용 — 쓸 값을 바꾼다. null 이면 `balance.json` 으로 돌아간다.
 * 일부만 넘기면 **원본 값** 위에 덮는다 (측정 시험이 한 항목씩 바꿔 본다).
 */
export function setBalanceValuesForTests(values: Partial<BalanceValues> | null): void {
  activeValues = values === null ? BALANCE_JSON_VALUES : { ...ORIGINAL_BALANCE_VALUES, ...values }
}

/** 지금 쓰는 값 전체 */
export function activeBalanceValues(): BalanceValues {
  return activeValues
}

export function balanceNumber(id: BalanceNumberId): number {
  return activeValues[id] as number
}

export function balanceList(id: BalanceListId): readonly number[] {
  return activeValues[id] as readonly number[]
}

export function balanceGrid(id: BalanceGridId): readonly (readonly number[])[] {
  return activeValues[id] as readonly (readonly number[])[]
}
