/** 해금 표의 꼴과 JSON 검사 — 판정은 `unlocks.ts` */
export type UnlockKind =
  | 'acePlayer'
  | 'hiddenTeam'
  | 'stadiumItem'
  | 'pitcherEquipment'
  | 'batterEquipment'
  | 'hiddenPitch'
  | 'mission'
  | 'hallOfFameSlot'
  | 'annalsPage'

export const UNLOCK_KINDS: readonly UnlockKind[] = [
  'acePlayer',
  'hiddenTeam',
  'stadiumItem',
  'pitcherEquipment',
  'batterEquipment',
  'hiddenPitch',
  'mission',
  'hallOfFameSlot',
  'annalsPage',
]

export interface UnlockEntry {
  readonly id: string
  readonly kind: UnlockKind
  /** 원본 이름 */
  readonly name: string
  /** 원본 해금 조건 (사람이 읽는 글) */
  readonly condition: string
  /** 근거 주소 */
  readonly source: string
  /** true 늘 풀림 · false 원본 조건 · null `unlockAll` 을 따른다 */
  readonly unlocked: boolean | null
}

export interface UnlockConfig {
  readonly unlockAll: boolean
  readonly entries: readonly UnlockEntry[]
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

/** id 가 비지 않았고 앞 항목과 겹치지 않는가 — 본 id 로 적는다 */
function claimUnlockId(where: string, id: unknown, seen: Set<string>): string {
  if (typeof id !== 'string' || id === '') throw new Error(`${where}: id 가 비었다`)
  if (seen.has(id)) throw new Error(`${where}: id ${id} 가 겹친다`)
  seen.add(id)
  return id
}

/** name · condition · source — 글 셋 */
function unlockTextsOf(where: string, entry: Record<string, unknown>): Pick<UnlockEntry, 'name' | 'condition' | 'source'> {
  const { name, condition, source } = entry
  if (typeof name !== 'string' || typeof condition !== 'string' || typeof source !== 'string') {
    throw new Error(`${where}: name · condition · source 는 글이다`)
  }
  return { name, condition, source }
}

function parseUnlockEntry(entry: unknown, index: number, seen: Set<string>): UnlockEntry {
  const where = `unlocks.json entries[${index}]`
  if (!isRecord(entry)) throw new Error(`${where}: 객체가 아니다`)
  const { kind, unlocked } = entry
  const id = claimUnlockId(where, entry.id, seen)
  if (typeof kind !== 'string' || !UNLOCK_KINDS.includes(kind as UnlockKind)) throw new Error(`${where}: kind ${String(kind)} 를 모른다`)
  const texts = unlockTextsOf(where, entry)
  if (unlocked !== null && typeof unlocked !== 'boolean') throw new Error(`${where}: unlocked 는 true · false · null 이다`)
  return { id, kind: kind as UnlockKind, ...texts, unlocked }
}

/** JSON 모양을 검사해 타입을 입힌다 — 틀리면 어디가 틀렸는지 적고 멈춘다 */
export function parseUnlockConfig(raw: unknown): UnlockConfig {
  if (!isRecord(raw)) throw new Error('unlocks.json: 객체가 아니다')
  if (typeof raw.unlockAll !== 'boolean') throw new Error('unlocks.json: unlockAll 은 true/false 다')
  if (!Array.isArray(raw.entries)) throw new Error('unlocks.json: entries 는 배열이다')
  const seen = new Set<string>()
  const entries = raw.entries.map((entry: unknown, index): UnlockEntry => parseUnlockEntry(entry, index, seen))
  return { unlockAll: raw.unlockAll, entries }
}
