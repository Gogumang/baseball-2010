import rawConfig from '@/shared/config/bugfixes/bugfixes.json'

/**
 * **원본 버그 고치기 표** — 원본(binary.mod)에 있던 버그를 웹에도 그대로 옮겨 두었는데(`DECISIONS.md` 2026-09-19),
 * 사용자가 그 목록(`docs/re/ORIGINAL-BUGS.md` B-01~B-100)을 고치라고 정했다 (사용자 결정 2026-10-26).
 * 해금 표(`shared/config/unlocks`)와 같은 꼴로 `bugfixes.json` 한 파일에서 켜고 끈다.
 *
 * - `fixAll: true`(기본) 면 고친 길이 있는 항목을 모두 고친 길로 돈다.
 * - 항목 `fixed` 로 하나씩 덮어쓴다 — `true` 고침 · `false` 원본 버그대로 · `null` `fixAll` 을 따른다.
 * - `implemented: false` 인 항목은 아직 고친 길이 코드에 없다 — 표가 무엇이라 하든 **원본대로** 돈다.
 *
 * 코드는 원본 갈래를 지우지 않고 `isBugFixed('B-xx') ? 고친 길 : 원본 길` 꼴로 감싼다.
 * 시험은 원본(모두 끔)으로 돈다 — `originalBugfixesForTests` (vitest `setupFiles`).
 */
export interface BugfixEntry {
  /** `ORIGINAL-BUGS.md` 의 id (B-01~B-100) */
  readonly id: string
  /** 모드/화면 */
  readonly name: string
  /** 원본 증상 */
  readonly symptom: string
  /** 원본 근거 주소 */
  readonly source: string
  /** 플레이 영향 — 큼 · 중 · 작음 · 거의 없음 */
  readonly impact: BugImpact
  /** 고친 길이 코드에 있는가 */
  readonly implemented: boolean
  /** true 고침 · false 원본 버그대로 · null `fixAll` 을 따른다 */
  readonly fixed: boolean | null
}

export type BugImpact = '큼' | '중' | '작음' | '거의 없음'

export const BUG_IMPACTS: readonly BugImpact[] = ['큼', '중', '작음', '거의 없음']

export interface BugfixConfig {
  readonly fixAll: boolean
  readonly entries: readonly BugfixEntry[]
}

/**
 * `ORIGINAL-BUGS.md` 1절의 id 전부 — B-01 ~ B-100 과 그 뒤에 새로 찾은 것(B-106~).
 * B-101 ~ B-105 는 2절(고침 · 웹 다름)의 id 라 1절에 없다.
 */
const NUMBERED_BUG_COUNT = 100
const LATER_BUG_IDS: readonly string[] = ['B-106', 'B-107']
export const ORIGINAL_BUG_IDS: readonly string[] = [
  ...Array.from({ length: NUMBERED_BUG_COUNT }, (_, index) => `B-${String(index + 1).padStart(2, '0')}`),
  ...LATER_BUG_IDS,
]
export const ORIGINAL_BUG_COUNT = ORIGINAL_BUG_IDS.length

/** 고친 길이 코드에 들어간 id — `bugfixes.json` 의 `implemented: true` 와 1:1 이어야 한다 (시험이 본다) */
export const IMPLEMENTED_BUGFIX_IDS: readonly string[] = [
  'B-01', 'B-02', 'B-03', 'B-04', 'B-05', 'B-06', 'B-07', 'B-08', 'B-09', 'B-10', 'B-11', 'B-13', 'B-14', 'B-15', 'B-16', 'B-17',
  'B-18', 'B-19', 'B-20', 'B-21', 'B-22', 'B-23', 'B-24', 'B-25', 'B-26', 'B-27', 'B-28', 'B-29', 'B-30', 'B-31', 'B-32', 'B-33',
  'B-34', 'B-35', 'B-36', 'B-37', 'B-38', 'B-39', 'B-40', 'B-41', 'B-42', 'B-43', 'B-44', 'B-45', 'B-46', 'B-47', 'B-52', 'B-53',
  'B-54', 'B-55', 'B-56', 'B-57', 'B-59', 'B-60', 'B-61', 'B-62', 'B-63', 'B-64', 'B-65', 'B-66', 'B-67', 'B-68', 'B-69', 'B-70',
  'B-71', 'B-72', 'B-73', 'B-74', 'B-75', 'B-76', 'B-77', 'B-78', 'B-80', 'B-82', 'B-83', 'B-84', 'B-86', 'B-87', 'B-88', 'B-89',
  'B-90', 'B-91', 'B-92', 'B-93', 'B-97', 'B-98', 'B-99', 'B-100', 'B-107',
]

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

/** JSON 모양을 검사해 타입을 입힌다 — 틀리면 어디가 틀렸는지 적고 멈춘다 */
export function parseBugfixConfig(raw: unknown): BugfixConfig {
  if (!isRecord(raw)) throw new Error('bugfixes.json: 객체가 아니다')
  if (typeof raw.fixAll !== 'boolean') throw new Error('bugfixes.json: fixAll 은 true/false 다')
  if (!Array.isArray(raw.entries)) throw new Error('bugfixes.json: entries 는 배열이다')
  const seen = new Set<string>()
  const entries = raw.entries.map((entry: unknown, index): BugfixEntry => {
    const where = `bugfixes.json entries[${index}]`
    if (!isRecord(entry)) throw new Error(`${where}: 객체가 아니다`)
    const { id, name, symptom, source, impact, implemented, fixed } = entry
    if (typeof id !== 'string' || !/^B-\d{2,3}$/.test(id)) throw new Error(`${where}: id ${String(id)} 는 B-xx 꼴이다`)
    if (seen.has(id)) throw new Error(`${where}: id ${id} 가 겹친다`)
    seen.add(id)
    if (typeof name !== 'string' || typeof symptom !== 'string' || typeof source !== 'string') {
      throw new Error(`${where}: name · symptom · source 는 글이다`)
    }
    if (typeof impact !== 'string' || !BUG_IMPACTS.includes(impact as BugImpact)) {
      throw new Error(`${where}: impact ${String(impact)} 를 모른다`)
    }
    if (typeof implemented !== 'boolean') throw new Error(`${where}: implemented 는 true/false 다`)
    if (fixed !== null && typeof fixed !== 'boolean') throw new Error(`${where}: fixed 는 true · false · null 이다`)
    return { id, name, symptom, source, impact: impact as BugImpact, implemented, fixed }
  })
  return { fixAll: raw.fixAll, entries }
}

/** `bugfixes.json` 그대로 */
export const BUGFIX_CONFIG: BugfixConfig = parseBugfixConfig(rawConfig)

/** 원본 그대로 — 아무것도 고치지 않는다 (시험이 원본 동작을 전제로 돌 때 쓴다) */
export const ORIGINAL_BUGFIX_CONFIG: BugfixConfig = { fixAll: false, entries: [] }

let activeConfig: BugfixConfig = BUGFIX_CONFIG
let fixedById: ReadonlyMap<string, boolean> = fixedMapOf(BUGFIX_CONFIG)

function fixedMapOf(config: BugfixConfig): ReadonlyMap<string, boolean> {
  return new Map(
    config.entries
      .filter((entry) => entry.implemented)
      .map((entry) => [entry.id, entry.fixed ?? config.fixAll]),
  )
}

/** 시험용 — 쓸 표를 바꾼다. null 이면 `bugfixes.json` 으로 돌아간다 */
export function setBugfixConfigForTests(config: BugfixConfig | null): void {
  activeConfig = config ?? BUGFIX_CONFIG
  fixedById = fixedMapOf(activeConfig)
}

/** 시험용 — 고친 길이 있는 항목 몇 개만 켠 표 (나머지는 원본) */
export function bugfixConfigWith(ids: readonly string[]): BugfixConfig {
  return {
    fixAll: false,
    entries: BUGFIX_CONFIG.entries.map((entry) => ({ ...entry, fixed: ids.includes(entry.id) ? true : false })),
  }
}

/** 지금 쓰는 표 */
export function activeBugfixConfig(): BugfixConfig {
  return activeConfig
}

/**
 * **원본 버그를 고친 길로 도는가** — 표에 없거나 고친 길이 아직 없는(`implemented: false`) id 면 거짓(원본).
 * 판정에 굴림이 없다. 고친 길이 난수 차례를 바꾸는지는 각 부르는 곳의 주석에 적는다.
 */
export function isBugFixed(id: string): boolean {
  return fixedById.get(id) ?? false
}
