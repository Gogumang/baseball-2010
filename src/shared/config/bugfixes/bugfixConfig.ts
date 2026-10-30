/** 버그 고치기 표의 꼴과 JSON 검사 — 판정은 `bugfixes.ts` */
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

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

/** id 가 B-xx 꼴이고 앞 항목과 겹치지 않는가 — 본 id 로 적는다 */
function claimBugfixId(where: string, id: unknown, seen: Set<string>): string {
  if (typeof id !== 'string' || !/^B-\d{2,3}$/.test(id)) throw new Error(`${where}: id ${String(id)} 는 B-xx 꼴이다`)
  if (seen.has(id)) throw new Error(`${where}: id ${id} 가 겹친다`)
  seen.add(id)
  return id
}

/** name · symptom · source — 글 셋 */
function bugfixTextsOf(where: string, entry: Record<string, unknown>): Pick<BugfixEntry, 'name' | 'symptom' | 'source'> {
  const { name, symptom, source } = entry
  if (typeof name !== 'string' || typeof symptom !== 'string' || typeof source !== 'string') {
    throw new Error(`${where}: name · symptom · source 는 글이다`)
  }
  return { name, symptom, source }
}

function parseBugfixEntry(entry: unknown, index: number, seen: Set<string>): BugfixEntry {
  const where = `bugfixes.json entries[${index}]`
  if (!isRecord(entry)) throw new Error(`${where}: 객체가 아니다`)
  const { impact, implemented, fixed } = entry
  const id = claimBugfixId(where, entry.id, seen)
  const texts = bugfixTextsOf(where, entry)
  if (typeof impact !== 'string' || !BUG_IMPACTS.includes(impact as BugImpact)) {
    throw new Error(`${where}: impact ${String(impact)} 를 모른다`)
  }
  if (typeof implemented !== 'boolean') throw new Error(`${where}: implemented 는 true/false 다`)
  if (fixed !== null && typeof fixed !== 'boolean') throw new Error(`${where}: fixed 는 true · false · null 이다`)
  return { id, ...texts, impact: impact as BugImpact, implemented, fixed }
}

/** JSON 모양을 검사해 타입을 입힌다 — 틀리면 어디가 틀렸는지 적고 멈춘다 */
export function parseBugfixConfig(raw: unknown): BugfixConfig {
  if (!isRecord(raw)) throw new Error('bugfixes.json: 객체가 아니다')
  if (typeof raw.fixAll !== 'boolean') throw new Error('bugfixes.json: fixAll 은 true/false 다')
  if (!Array.isArray(raw.entries)) throw new Error('bugfixes.json: entries 는 배열이다')
  const seen = new Set<string>()
  const entries = raw.entries.map((entry: unknown, index): BugfixEntry => parseBugfixEntry(entry, index, seen))
  return { fixAll: raw.fixAll, entries }
}
