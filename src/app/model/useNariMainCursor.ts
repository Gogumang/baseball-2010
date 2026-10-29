import { createNariMainMenuCursor, nariMainCursorOnEntry } from '@/pages/management/model/nariMainMenuCursor'
import type { NariMainMenuCursor } from '@/pages/management/model/nariMainMenuCursor'
import { useRenderMachine } from '@/shared/lib/renderMachine/useRenderMachine'

interface EntryCursorInput {
  /** 105 진입 열쇠 — 관리 화면 '관리', 105 진입 곁가지로 바로 뜬 '관리' 이벤트는 `이벤트:번호`, 그 밖 null */
  readonly entryKey: string | null
  /** 지금 화면이 이벤트(114)인가 — 105 틀에서 뜬 이벤트(앞 열쇠가 '관리')는 새 진입이 아니다 */
  readonly isEventScreen: boolean
  /** 앞 화면(장면) 이름 */
  readonly previous: string | null
  /** 하위 메뉴(110)로 돌아오는 앞 화면 이름 — 타자편 '아이템' · 투수편 '상점' */
  readonly subMenuScreen: string
  readonly hasActedThisCycle: boolean
}

interface EntryCursorMemory {
  readonly entryKey: string | null
  readonly cursor: NariMainMenuCursor
}

/** 이 진입에 0x11910 커서 규칙을 치는가 — 105 틀에서 뜬 이벤트(앞 열쇠가 '관리')와 하위 메뉴(110)로 돌아온 길은 안 친다 */
function hitsEntryRule(previousKey: string | null, input: EntryCursorInput): boolean {
  if (input.entryKey === null) return false
  const isFromManagementFrame = input.isEventScreen && previousKey === '관리'
  // 이벤트 → 관리 · 이벤트 → 이벤트는 이전 114 다
  const isSubMenuReturn = previousKey === null && input.previous === input.subMenuScreen
  return !isFromManagementFrame && !isSubMenuReturn
}

/**
 * 105 에 들어온 그림에 0x11910 의 커서 규칙을 친다: 행동함이고 이전이 109(다음 경기 순위표) · 110(하위 메뉴)이 아니면 첫 칸.
 * 커서 칸은 장면 0x106 이 서 있는 동안 남는 한 덩이라(자식 화면이 키로 고친다) 그 자리에서 고친다.
 */
function advanceEntryCursor(memory: EntryCursorMemory | null, input: EntryCursorInput): EntryCursorMemory {
  const held = memory ?? { entryKey: null, cursor: createNariMainMenuCursor() }
  if (input.entryKey === held.entryKey) return held
  if (hitsEntryRule(held.entryKey, input)) {
    const isFromStandings = held.entryKey === null && input.previous === '다음경기순위'
    held.cursor.current = nariMainCursorOnEntry(held.cursor.current, input.hasActedThisCycle, isFromStandings)
  }
  return { entryKey: input.entryKey, cursor: held.cursor }
}

/**
 * **관리 메뉴 [this+0x8c] 의 커서** — 장면 0x106 이 서 있는 동안 남는다(`NariMainMenuCursor`). 105 에 들어올 때마다 그 그림에서
 * 0x11910 의 규칙을 친다(`advanceEntryCursor`). 상점(111 · 121)에서 돌아오면 105 가 아니라 하위 메뉴(110 · 106)로 서므로
 * (`nariReturnSubMenuOf`) 이 규칙을 안 친다 — 110 취소가 그 105 진입을 친다(`useManagementMenu`). 타자편 · 투수편이 같이 쓴다.
 */
export function useNariMainCursor(input: EntryCursorInput): NariMainMenuCursor {
  return useRenderMachine(advanceEntryCursor, input).cursor
}
