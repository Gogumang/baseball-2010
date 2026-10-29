import type { Screen } from '@/app/model/screen'

/**
 * 여기서 '관리' 로 돌아오는 것은 105 진입이 아니다 — 111 상점 취소는 110 · 121 장비착용 취소는 106 하위 메뉴로 선다
 * (`nariReturnSubMenuOf`).
 */
const NOT_MANAGEMENT_ENTRY_FROM: ReadonlySet<Screen['kind']> = new Set<Screen['kind']>(['아이템'])

/**
 * **105 진입 표지** (이름 붙인 칸 객체 — `CODE_QUALITY` 5절). 세션마다 하나(`managementEntryMarkerAtom`).
 * - **그림에서** `observe` — 화면 · 다시 들어옴 셈이 바뀐 그림에서 표지를 세운다(그 그림의 칭호 판정 · 진입 고리가 본다).
 *   같은 값으로 몇 번 불러도 같다(바뀐 것이 없으면 그대로).
 * - **사건(진입 고리)에서** `consume` — 진입 곁가지 · 자동 훑기를 다 본 뒤 내린다.
 * 세우는 쪽(그림)과 내리는 쪽(effect)이 한 칸을 같이 쓰므로 상태가 아니라 칸이다 — 내릴 때 다시 그리지 않는다(옛 ref 그대로).
 */
export interface ManagementEntryMarker {
  /** 이 그림의 화면 · 다시 들어옴 셈을 보고 표지를 고친다 — 이 그림이 105 진입 검사를 기다리는가 */
  readonly observe: (kind: Screen['kind'], reentryCount: number) => boolean
  /** 아직 진입 고리가 다 보지 않은 표지인가 */
  readonly isPending: () => boolean
  /** 진입 고리가 다 봤다 */
  readonly consume: () => void
}

interface Seen {
  readonly kind: Screen['kind']
  readonly reentryCount: number
  readonly isPending: boolean
}

function nextSeenOf(seen: Seen, kind: Screen['kind'], reentryCount: number): Seen {
  if (seen.kind === kind && seen.reentryCount === reentryCount) return seen
  const isArrival = seen.kind !== kind && !NOT_MANAGEMENT_ENTRY_FROM.has(seen.kind)
  const isReentry = seen.reentryCount !== reentryCount
  return { kind, reentryCount, isPending: kind === '관리' && (seen.isPending || isArrival || isReentry) }
}

/** 첫 그림의 화면으로 만든다 — 첫 그림은 진입이 아니다 */
export function createManagementEntryMarker(firstKind: Screen['kind']): ManagementEntryMarker {
  let seen: Seen = { kind: firstKind, reentryCount: 0, isPending: false }
  return {
    observe: (kind, reentryCount) => {
      seen = nextSeenOf(seen, kind, reentryCount)
      return kind === '관리' && seen.isPending
    },
    isPending: () => seen.isPending,
    consume: () => {
      seen = { ...seen, isPending: false }
    },
  }
}
