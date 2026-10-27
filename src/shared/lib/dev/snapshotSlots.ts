/**
 * **경기 중간 스냅샷의 모듈 · 루프 칸** (웹 개발 도구 — 원본에 없다). 스냅샷(`app/dev/sessionSnapshot`)은 React 훅 칸(useState ·
 * useRef · useMemo)을 나무에서 읽는다. 그 밖의 상태 — 모듈 변수(경기 장면 멈춤 셈 · 파티클 관리자 따위)와 effect 안 그림 루프의
 * `let` 변수(타석 그림 루프 따위) — 는 나무에 없어 그 모듈 · 루프가 여기에 칸을 단다.
 *
 * 다는 곳은 스위치를 **그 자리에** `if (import.meta.env.DEV || import.meta.env.MODE === 'e2e')` 로 쓴다 — 배포 빌드에서 그 덩이가
 * 글자로 접혀 빠지고 이 모듈도 따라 빠진다(`app/dev/sceneShortcut.ts` 머리말과 같은 까닭).
 *
 * 같은 이름 칸이 여럿이면(루프를 쥔 부품 여럿) 단 차례로 `이름#0` · `이름#1` … 이 된다 — 되살릴 때도 그 차례로 짝짓는다.
 */
export interface SnapshotSlot {
  /** 지금 값 — 스냅샷이 값 그래프로 적는다(함수 · DOM 은 빼고). 부품 상태와 같은 객체면 되살려도 같은 객체다 */
  readonly capture: () => unknown
  /**
   * 뜬 값을 되살린다. `shiftMs` 는 (되살린 때 `performance.now()` − 뜬 때) — 실제 시각(ms) 칸을 같은 거리로 옮긴다
   */
  readonly restore: (value: unknown, shiftMs: number) => void
  /**
   * 모듈이 붙박이로 쥔 객체(바꿔 끼울 수 없는 것) — 스냅샷 값 그래프에서 이 객체 자리는 새 객체를 만들지 않고 이 객체에 채운다.
   * 부품이 같은 객체를 쥐고 있어도(ref 따위) 되살린 뒤 하나로 남는다
   */
  readonly anchors?: () => Readonly<Record<string, object>>
  /**
   * 약한 표 칸(`trackWeakCollectionForSnapshot`) — 값이 열쇠 목록(WeakSet) · [열쇠, 값] 목록(WeakMap)이다. 스냅샷은 다른 칸에서 닿는
   * 열쇠만 적는다(아직 거두지 않은 지난 객체는 뺀다)
   */
  readonly weak?: 'set' | 'map'
}

const slots: { readonly name: string; readonly slot: SnapshotSlot }[] = []

/** 칸을 단다 — 돌려준 함수로 뗀다(루프가 끝날 때) */
export function registerSnapshotSlot(name: string, slot: SnapshotSlot): () => void {
  const entry = { name, slot }
  slots.push(entry)
  return () => {
    const at = slots.indexOf(entry)
    if (at >= 0) slots.splice(at, 1)
  }
}

/** 지금 달린 칸 — `이름#차례` → 칸 */
export function snapshotSlots(): ReadonlyMap<string, SnapshotSlot> {
  const counts = new Map<string, number>()
  const named = new Map<string, SnapshotSlot>()
  for (const { name, slot } of slots) {
    const index = counts.get(name) ?? 0
    counts.set(name, index + 1)
    named.set(`${name}#${index}`, slot)
  }
  return named
}

/**
 * 모듈의 WeakSet · WeakMap(상태 객체를 열쇠로 든 표 — 확인 대기마다 받은 OK 수 따위)을 칸으로 단다. 약한 표는 훑을 수 없어 넣는 길(`add` ·
 * `set`)을 감싸 열쇠를 WeakRef 로 따로 적는다. 열쇠가 스냅샷 값 그래프의 상태 객체와 같은 객체면 되살린 뒤에도 같은 짝이 선다
 */
export function trackWeakCollectionForSnapshot<K extends object, V>(name: string, collection: WeakSet<K> | WeakMap<K, V>): void {
  const keys = new Set<WeakRef<K>>()
  const known = new WeakSet<K>()
  const remember = (key: K) => {
    if (known.has(key)) return
    known.add(key)
    keys.add(new WeakRef(key))
    if (keys.size > 4096) for (const ref of keys) if (ref.deref() === undefined) keys.delete(ref)
  }
  const live = () => [...keys].map((ref) => ref.deref()).filter((key): key is K => key !== undefined && collection.has(key))
  if (collection instanceof WeakSet) {
    const add = collection.add.bind(collection)
    collection.add = (key: K) => {
      remember(key)
      return add(key)
    }
    registerSnapshotSlot(name, {
      weak: 'set',
      capture: () => live(),
      restore: (value) => {
        for (const key of value as K[]) collection.add(key)
      },
    })
    return
  }
  const set = collection.set.bind(collection)
  collection.set = (key: K, item: V) => {
    remember(key)
    return set(key, item)
  }
  registerSnapshotSlot(name, {
    weak: 'map',
    capture: () => live().map((key) => [key, collection.get(key)] as const),
    restore: (value) => {
      for (const [key, item] of value as [K, V][]) collection.set(key, item)
    },
  })
}

/** 모듈이 쥔 값 칸 객체(`{ value: 0 }` 따위 — 스킨 카운터처럼 화면을 건너 이어지는 셈)를 칸으로 단다. 되살릴 때 그 객체에 덮는다 */
export function trackCellForSnapshot(name: string, cell: object): void {
  registerSnapshotSlot(name, {
    capture: () => ({ ...cell }),
    restore: (value) => {
      Object.assign(cell, value)
    },
  })
}
