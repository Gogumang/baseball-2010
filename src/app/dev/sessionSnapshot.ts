/// <reference types="vite/client" />
import { devRandomCellOf, sceneHandlesNow } from '@/app/dev/sceneShortcut'
import { withFinallyAsync } from '@/shared/lib/safe/tryOr'
import { appTickNow, appTickStartTime, rebaseAppTickForDev } from '@/shared/lib/frameClock/frameClock'
import { snapshotSlots } from '@/shared/lib/dev/snapshotSlots'
import type { SnapshotSlot } from '@/shared/lib/dev/snapshotSlots'

/**
 * **경기 중간 스냅샷** (개발 · e2e 전용 — 원본에 없다. `sceneShortcut.ts` 머리말의 스위치로만 읽힌다).
 *
 * 실제로 공을 던지고 쳐서 닿는 장면(돌발미션 결과 창 · 미션 결과 판)을 시간을 빨리 감지 않고 **그 순간 그대로** 연다.
 *
 * - **뜨기** (`captureSnapshot`): React 나무의 함수 부품마다 훅 칸(useState · useReducer 값, useRef 의 current, useMemo 값)을
 *   부품 자리(부모부터 `fiber.index` · key · 종류)로 적는다. 세션 훅(`useCareerSession` · `useMissionSession` …)은 App 부품의 훅이라
 *   거기 들고, 경기 화면 부품(타석 · 창 · 수비)의 상태도 같은 길로 든다. 더해 앱 난수의 씨앗 칸(32비트), 앱 틱, localStorage,
 *   모듈 칸(`shared/lib/dev/snapshotSlots`)을 적는다. 값은 한 그래프로 적어 칸끼리 같은 객체(상태와 ref 가 같은 진행 칸을 쥠)는
 *   되살려도 같은 객체다. 함수 · DOM 은 적지 않고 되살릴 때 새로 그린 쪽의 같은 자리 값을 쓴다.
 * - **되살리기** (`restoreSnapshot`): 픽스처처럼 저장을 깔고 앱을 그린 뒤, 나무를 훑어 자리가 맞는 부품에 값을 넣는다(상태는
 *   dispatch, ref 는 current). 부모 상태가 바뀌어 자식이 새로 서면 다음 바퀴에 또 넣는다 — 모든 자리가 다 들 때까지. 그동안 앱 틱은
 *   뜬 틱에 세워 둔다. 끝에 ref · 모듈 칸 · 난수 칸을 한 번 더 넣는다(새로 선 부품의 effect 가 건드린 것을 덮는다).
 * - 훅 차례(종류 줄)가 다른 자리는 코드가 바뀐 것이다 — 낡은 스냅샷으로 보고 실패한다(`yarn e2e:snapshot` 으로 다시 뜬다).
 */

/** 스냅샷 파일 꼴 — `e2e/snapshots/<장면>.json.gz` (gzip) */
export interface SessionSnapshotFile {
  readonly version: 1
  /** 어떻게 뜬 순간인가 */
  readonly note: string
  readonly scene: string | null
  readonly fixture: string | null
  readonly capturedAt: string
  /** 뜬 때 앱 틱 */
  readonly appTick: number
  /** 뜬 때 `performance.now()` — 모듈 칸의 실제 시각을 옮기는 데 */
  readonly now: number
  /** 뜬 때가 그 앱 틱 머리에서 지난 ms — 되살린 시계도 틱 안 같은 자리에 선다 */
  readonly tickPhase: number
  /** 앱 난수 씨앗 칸 */
  readonly random: number | null
  readonly localStorage: Readonly<Record<string, string>>
  /** 부품 자리 → 훅 칸 */
  readonly fibers: readonly SnapshotFiber[]
  readonly modules: Readonly<Record<string, number>>
  /** 모듈 칸의 붙박이 객체(`SnapshotSlot.anchors`) → 값 그래프의 객체 번호 — 되살릴 때 새 객체 대신 그 객체에 채운다 */
  readonly anchors: Readonly<Record<string, number>>
  /** 값 그래프 — 칸들이 이 표의 번호를 가리킨다 */
  readonly values: readonly EncodedNode[]
}

export interface SnapshotFiber {
  readonly path: string
  /** 훅 종류 줄 (s state · r ref · m memo · e effect · x store · o 그밖) — 자리가 같은 부품인지 본다 */
  readonly kinds: string
  /** [훅 번호, 값 번호, (memo 면) 의존 열쇠] */
  readonly hooks: readonly (readonly [number, number] | readonly [number, number, string])[]
}

/**
 * 값 하나. 원시값은 그대로, 나머지는 꼴 표시: `u` undefined · `n` 수 아닌 수 · `r` 앞선 객체 · `a` 배열 · `o` 객체(`c` 클래스) ·
 * `m` Map · `s` Set · `t` 형식 배열 · `d` Date · `f` 함수 · `x` 적지 않는 것(DOM 따위)
 */
type EncodedNode =
  | number
  | string
  | boolean
  | null
  | { readonly u: 0 }
  | { readonly n: string }
  | { readonly r: number }
  | { readonly i: number; readonly a: readonly EncodedNode[] }
  | { readonly i: number; readonly o: Readonly<Record<string, EncodedNode>>; readonly c?: 1 }
  | { readonly i: number; readonly m: readonly (readonly [EncodedNode, EncodedNode])[] }
  | { readonly i: number; readonly s: readonly EncodedNode[] }
  | { readonly i: number; readonly t: string; readonly v: readonly number[] }
  | { readonly i: number; readonly d: number }
  | { readonly f: 1 }
  | { readonly x: string }

// ─── React 나무 ───────────────────────────────────────────────────────────────────────────────────────────────

/** React 18 의 fiber 중 쓰는 칸만 */
interface Fiber {
  readonly tag: number
  readonly key: string | null
  readonly index: number
  readonly type: unknown
  readonly child: Fiber | null
  readonly sibling: Fiber | null
  readonly alternate: Fiber | null
  readonly memoizedState: unknown
}

interface Hook {
  memoizedState: unknown
  readonly queue: { readonly dispatch?: (action: unknown) => void; readonly getSnapshot?: unknown } | null
  readonly next: Hook | null
}

/** 훅을 쥐는 fiber — 함수 부품 0 · forwardRef 11 · 단순 memo 15 */
const HOOK_TAGS = new Set([0, 11, 15])

function rootFiber(): Fiber {
  const container = document.getElementById('root')
  if (container === null) throw new Error('#root 가 없다')
  const key = Object.keys(container).find((name) => name.startsWith('__reactContainer$'))
  if (key === undefined) throw new Error('React 뿌리를 못 찾았다')
  const hostRoot = (container as unknown as Record<string, { stateNode: { current: Fiber } }>)[key]
  if (hostRoot === undefined) throw new Error('React 뿌리를 못 찾았다')
  return hostRoot.stateNode.current
}

function stepOf(fiber: Fiber): string {
  const type = typeof fiber.type === 'string' ? fiber.type : ''
  return `${fiber.index}${fiber.key === null ? '' : `:${fiber.key}`}.${fiber.tag}${type}`
}

/**
 * 훅을 쥔 fiber 를 자리와 함께 — 나무 차례(부모 먼저). 앱 갈래(`main.tsx` 의 StrictMode 첫 자식 `BootShell`)만 본다 —
 * 둘째 자식 `ViewportShell` 은 화면 배율 · 터치 버튼 배치라 기기마다 다르다(스냅샷은 기기를 가리지 않는다)
 */
function hookFibers(): { readonly path: string; readonly fiber: Fiber; readonly parent: string | null }[] {
  const found: { path: string; fiber: Fiber; parent: string | null }[] = []
  const stack: { fiber: Fiber; path: string; parent: string | null }[] = []
  const app = rootFiber().child?.child ?? null
  if (app === null) return found
  stack.push({ fiber: app, path: stepOf(app), parent: null })
  while (stack.length > 0) {
    const { fiber, path, parent } = stack.pop()!
    const hasHooks = HOOK_TAGS.has(fiber.tag) && fiber.memoizedState !== null
    if (hasHooks) found.push({ path, fiber, parent })
    const children: { fiber: Fiber; path: string; parent: string | null }[] = []
    for (let child = fiber.child; child !== null; child = child.sibling) {
      children.push({ fiber: child, path: `${path}/${stepOf(child)}`, parent: hasHooks ? path : parent })
    }
    for (let at = children.length - 1; at >= 0; at -= 1) stack.push(children[at]!)
  }
  return found
}

function hooksOf(fiber: Fiber): Hook[] {
  const hooks: Hook[] = []
  for (let hook = fiber.memoizedState as Hook | null; hook !== null; hook = hook.next) hooks.push(hook)
  return hooks
}

type HookKind = 's' | 'r' | 'm' | 'e' | 'x' | 'o'

function kindOf(hook: Hook): HookKind {
  const queue = hook.queue
  if (queue !== null && typeof queue.dispatch === 'function') return 's'
  if (queue !== null && 'getSnapshot' in queue) return 'x'
  const state = hook.memoizedState
  if (state !== null && typeof state === 'object') {
    if (!Array.isArray(state) && typeof (state as { create?: unknown }).create === 'function' && 'tag' in state) return 'e'
    if (!Array.isArray(state) && Object.keys(state).length === 1 && 'current' in state) return 'r'
    if (Array.isArray(state) && state.length === 2 && (state[1] === null || Array.isArray(state[1]))) return 'm'
  }
  return 'o'
}

// ─── 값 적기 · 풀기 ───────────────────────────────────────────────────────────────────────────────────────────

const TYPED_ARRAYS: Record<string, new (values: number[]) => ArrayLike<number>> = {
  Int8Array,
  Uint8Array,
  Uint8ClampedArray,
  Int16Array,
  Uint16Array,
  Int32Array,
  Uint32Array,
  Float32Array,
  Float64Array,
}

function isOpaque(value: object): string | null {
  if (typeof Node !== 'undefined' && value instanceof Node) return 'dom'
  if (value === window) return 'window'
  if (value instanceof Promise) return 'promise'
  if (value instanceof WeakMap || value instanceof WeakSet) return 'weak'
  if (value instanceof Error) return 'error'
  if (typeof Event !== 'undefined' && value instanceof Event) return 'event'
  const tag = Object.prototype.toString.call(value)
  if (tag === '[object Object]' || tag === '[object Array]' || tag === '[object Map]' || tag === '[object Set]' || tag === '[object Date]')
    return null
  if (ArrayBuffer.isView(value) && value.constructor.name in TYPED_ARRAYS) return null
  return tag.slice(8, -1)
}

/** 값 그래프 적기 — 같은 객체는 한 번만, 다음부터 `r` */
class Encoder {
  readonly values: EncodedNode[] = []
  private readonly seen = new Map<object, number>()

  /** 적은 객체의 번호 — 안 적었으면 undefined */
  idOf(value: object): number | undefined {
    return this.seen.get(value)
  }

  /** 칸 하나를 적고 그 값 번호를 돌려준다 */
  put(value: unknown): number {
    this.values.push(null)
    const at = this.values.length - 1
    this.values[at] = this.encode(value)
    return at
  }

  private encode(value: unknown): EncodedNode {
    if (value === undefined) return { u: 0 }
    if (value === null || typeof value === 'boolean' || typeof value === 'string') return value
    if (typeof value === 'number') {
      if (Object.is(value, -0)) return { n: '-0' }
      return Number.isFinite(value) ? value : { n: String(value) }
    }
    if (typeof value === 'function') return { f: 1 }
    if (typeof value !== 'object') return { x: typeof value }
    const known = this.seen.get(value)
    if (known !== undefined) return { r: known }
    const opaque = isOpaque(value)
    if (opaque !== null) return { x: opaque }
    const id = this.seen.size
    this.seen.set(value, id)
    if (Array.isArray(value)) return { i: id, a: value.map((item) => this.encode(item)) }
    if (value instanceof Map) return { i: id, m: [...value].map(([key, item]) => [this.encode(key), this.encode(item)] as const) }
    if (value instanceof Set) return { i: id, s: [...value].map((item) => this.encode(item)) }
    if (value instanceof Date) return { i: id, d: value.getTime() }
    if (ArrayBuffer.isView(value)) return { i: id, t: value.constructor.name, v: [...(value as unknown as ArrayLike<number> & Iterable<number>)] }
    const fields: Record<string, EncodedNode> = {}
    for (const key of Object.keys(value)) fields[key] = this.encode((value as Record<string, unknown>)[key])
    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null ? { i: id, o: fields } : { i: id, o: fields, c: 1 }
  }
}

/** 따로 적은 값의 글 — 의존 열쇠 · 같음 견주기 (객체 번호가 그 값 안에서만 매겨진다) */
export function standaloneKeyOf(value: unknown): string {
  const encoder = new Encoder()
  encoder.put(value)
  return JSON.stringify(encoder.values[0])
}

/** 새로 그린 쪽에서 채울 구멍 — 함수 · DOM 자리, 클래스 객체의 프로토타입 */
interface Hole {
  readonly holder: Record<string | number, unknown> | null
  readonly key: string | number | null
  /** 칸 값에서 그 자리까지의 열쇠 줄 */
  readonly route: readonly (string | number)[]
  readonly kind: 'value' | 'prototype'
  readonly target?: object
  readonly isFunction?: boolean
}

/** 되살리지 못한 클로저 자리 — 부르면 쪽 오류(pageerror)로 알린다. 그 장면이 이 함수를 안 부르는 동안만 스냅샷이 맞다 */
function lostClosure(route: readonly (string | number)[]): () => never {
  return () => {
    throw new Error(`경기 중간 스냅샷: 되살리지 못한 함수를 불렀다 (${route.join('.')}) — 이 장면은 스냅샷으로 열 수 없다`)
  }
}

/** 값 그래프 풀기 — 칸 번호마다 값과 구멍 */
class Decoder {
  private readonly objects = new Map<number, object>()
  readonly holes = new Map<number, Hole[]>()
  private readonly decoded = new Map<number, unknown>()

  /** 객체 번호 → 그 객체를 처음 적은 자리 — `r` 이 아직 안 푼 객체를 가리키면 그 자리를 먼저 푼다(칸을 어느 차례로 풀어도 된다) */
  private readonly definitions = new Map<number, EncodedNode>()

  constructor(
    private readonly values: readonly EncodedNode[],
    private readonly adopt: ReadonlyMap<number, object> = new Map(),
  ) {
    const stack: unknown[] = [...values]
    while (stack.length > 0) {
      const node = stack.pop()
      if (node === null || typeof node !== 'object') continue
      if ('i' in node && typeof (node as { i: unknown }).i === 'number') this.definitions.set((node as { i: number }).i, node as EncodedNode)
      for (const child of Object.values(node)) if (child !== null && typeof child === 'object') stack.push(child)
    }
  }

  get(at: number): unknown {
    if (this.decoded.has(at)) return this.decoded.get(at)
    const holes: Hole[] = []
    const value = this.decode(this.values[at] ?? null, [], holes, null, null)
    this.decoded.set(at, value)
    this.holes.set(at, holes)
    return value
  }

  private decode(
    node: EncodedNode,
    route: (string | number)[],
    holes: Hole[],
    holder: Record<string | number, unknown> | null,
    key: string | number | null,
  ): unknown {
    if (node === null || typeof node !== 'object') return node
    if ('u' in node) return undefined
    if ('n' in node) return node.n === '-0' ? -0 : Number(node.n)
    if ('r' in node) {
      const found = this.objects.get(node.r)
      if (found !== undefined) return found
      const definition = this.definitions.get(node.r)
      if (definition === undefined) throw new Error(`스냅샷 값 번호 ${node.r} 가 없다`)
      // 다른 칸이 처음 적은 객체 — 여기서 푼다(그 칸의 구멍은 그 칸을 풀 때 채우지 못한다 — 함수 자리는 덫)
      return this.decode(definition, [], [], null, null)
    }
    if ('f' in node || 'x' in node) {
      holes.push({ holder, key, route: [...route], kind: 'value', isFunction: 'f' in node })
      return undefined
    }
    // 다른 칸의 `r` 로 먼저 푼 객체 — 그대로 쓰고 이 칸 자리의 구멍만 적는다
    const existing = 'i' in node ? this.objects.get(node.i) : undefined
    if (existing !== undefined) {
      this.collectHoles(node, existing, route, holes, new Set())
      return existing
    }
    if ('a' in node) {
      const adopted = this.adopt.get(node.i)
      const array: unknown[] = Array.isArray(adopted) ? adopted : []
      array.length = 0
      this.objects.set(node.i, array)
      node.a.forEach((item, index) => {
        array.push(this.decode(item, [...route, index], holes, array as unknown as Record<number, unknown>, index))
      })
      return array
    }
    if ('m' in node) {
      const map = new Map<unknown, unknown>()
      this.objects.set(node.i, map)
      for (const [entryKey, item] of node.m) map.set(this.decode(entryKey, [], [], null, null), this.decode(item, [], [], null, null))
      return map
    }
    if ('s' in node) {
      const set = new Set<unknown>()
      this.objects.set(node.i, set)
      for (const item of node.s) set.add(this.decode(item, [], [], null, null))
      return set
    }
    if ('t' in node) {
      const Typed = TYPED_ARRAYS[node.t] ?? Float64Array
      const typed = new Typed(node.v as number[])
      this.objects.set(node.i, typed as unknown as object)
      return typed
    }
    if ('d' in node) {
      const date = new Date(node.d)
      this.objects.set(node.i, date)
      return date
    }
    const adopted = this.adopt.get(node.i)
    const object = (adopted ?? {}) as Record<string, unknown>
    this.objects.set(node.i, object)
    if (node.c === 1) holes.push({ holder: null, key: null, route: [...route], kind: 'prototype', target: object })
    for (const [field, item] of Object.entries(node.o)) object[field] = this.decode(item, [...route, field], holes, object, field)
    return object
  }

  /** 이미 푼 객체 `object` 의 구멍(함수 · DOM 자리 · 클래스 프로토타입)을 그 적은 꼴 `node` 를 따라 적는다 */
  private collectHoles(node: EncodedNode, object: unknown, route: (string | number)[], holes: Hole[], seen: Set<number>): void {
    if (node === null || typeof node !== 'object' || !('i' in node) || seen.has(node.i)) return
    seen.add(node.i)
    const visit = (item: EncodedNode, holder: Record<string | number, unknown>, key: string | number) => {
      if (item !== null && typeof item === 'object' && ('f' in item || 'x' in item)) {
        holes.push({ holder, key, route: [...route, key], kind: 'value', isFunction: 'f' in item })
      } else {
        this.collectHoles(item, holder[key], [...route, key], holes, seen)
      }
    }
    if ('a' in node && Array.isArray(object)) node.a.forEach((item, index) => visit(item, object as unknown as Record<number, unknown>, index))
    else if ('o' in node && object !== null && typeof object === 'object') {
      if (node.c === 1) holes.push({ holder: null, key: null, route: [...route], kind: 'prototype', target: object })
      for (const [field, item] of Object.entries(node.o)) visit(item, object as Record<string, unknown>, field)
    }
  }

  /**
   * 이미 푼 객체마다 내용을 뜬 값으로 되돌린다(같은 객체 그대로) — 되살리는 동안 도는 그림 루프가 넣어 둔 객체(장면 칸 ref 따위)를
   * 고쳐 쓰면 다시 `get` 해도 고친 객체가 나온다. 끝에 한 번 불러 뜬 순간의 내용으로 맞춘다(r355). 구멍(함수 · DOM) 자리는 채운 값을 둔다
   */
  rewind(): void {
    const isHole = (item: EncodedNode) => item !== null && typeof item === 'object' && ('f' in item || 'x' in item)
    const valueOf = (item: EncodedNode) => this.decode(item, [], [], null, null)
    for (const [id, object] of this.objects) {
      const node = this.definitions.get(id)
      if (node === undefined || node === null || typeof node !== 'object') continue
      if ('a' in node && Array.isArray(object)) {
        object.length = node.a.length
        node.a.forEach((item, index) => {
          if (!isHole(item)) object[index] = valueOf(item)
        })
      } else if ('o' in node) {
        const target = object as Record<string, unknown>
        for (const field of Object.keys(target)) if (!(field in node.o)) delete target[field]
        for (const [field, item] of Object.entries(node.o)) if (!isHole(item)) target[field] = valueOf(item)
      } else if ('m' in node && object instanceof Map) {
        object.clear()
        for (const [entryKey, item] of node.m) object.set(valueOf(entryKey), valueOf(item))
      } else if ('s' in node && object instanceof Set) {
        object.clear()
        for (const item of node.s) object.add(valueOf(item))
      } else if ('t' in node) {
        ;(object as unknown as { set: (values: readonly number[]) => void }).set(node.v)
      } else if ('d' in node && object instanceof Date) {
        object.setTime(node.d)
      }
    }
  }

  /** 칸 `at` 의 구멍을 새로 그린 쪽 값 `fresh` 의 같은 자리로 채운다 */
  fill(at: number, fresh: unknown): void {
    for (const hole of this.holes.get(at) ?? []) {
      let counterpart: unknown = fresh
      for (const step of hole.route) {
        if (counterpart === null || typeof counterpart !== 'object') {
          counterpart = undefined
          break
        }
        counterpart = (counterpart as Record<string | number, unknown>)[step]
      }
      if (hole.kind === 'prototype') {
        if (counterpart !== null && typeof counterpart === 'object' && hole.target !== undefined) {
          const prototype = Object.getPrototypeOf(counterpart)
          if (prototype !== Object.prototype && Object.getPrototypeOf(hole.target) !== prototype) Object.setPrototypeOf(hole.target, prototype)
        }
        continue
      }
      if (hole.holder === null) continue
      // 새로 그린 쪽에 같은 자리 함수가 없다 — 클로저(궤적의 pointAt 따위)는 되살릴 수 없다. 부르면 곧바로 알리게 덫을 둔다
      if (counterpart === undefined && hole.isFunction) counterpart = lostClosure(hole.route)
      if (hole.holder[hole.key!] !== counterpart) hole.holder[hole.key!] = counterpart
    }
  }
}

/** 칸 값 자체가 구멍(함수 · DOM)인가 — 그러면 새로 그린 값을 그대로 둔다 */
function isWholeHole(node: EncodedNode | undefined): boolean {
  return node !== null && typeof node === 'object' && ('f' in node || 'x' in node)
}

/** memo 값 — 같은 객체에 데이터 칸만 덮는다(함수 · 얼린 객체는 그대로) */
function assignInPlace(target: unknown, source: unknown, seen = new Set<object>()): void {
  if (target === null || typeof target !== 'object' || source === null || typeof source !== 'object') return
  if (seen.has(target) || Object.isFrozen(target)) return
  seen.add(target)
  if (Array.isArray(target) && Array.isArray(source)) {
    source.forEach((item, index) => {
      const current = target[index]
      if (current !== null && typeof current === 'object') assignInPlace(current, item, seen)
      else if (typeof current !== 'function' && current !== item && item !== undefined) target[index] = item
    })
    return
  }
  for (const [key, item] of Object.entries(source)) {
    const current = (target as Record<string, unknown>)[key]
    if (typeof current === 'function') continue
    if (current !== null && typeof current === 'object' && item !== null && typeof item === 'object') assignInPlace(current, item, seen)
    else if (current !== item && item !== undefined) (target as Record<string, unknown>)[key] = item
  }
}

// ─── 뜨기 ────────────────────────────────────────────────────────────────────────────────────────────────────

const STORAGE_PREFIX = 'compus-baseball/'

function storageNow(): Record<string, string> {
  const storage: Record<string, string> = {}
  for (const key of Object.keys(window.localStorage)
    .filter((name) => name.startsWith(STORAGE_PREFIX))
    .sort()) {
    storage[key] = window.localStorage.getItem(key) ?? ''
  }
  return storage
}

function randomStateNow(): number | null {
  const handles = sceneHandlesNow()
  if (handles === null) return null
  return devRandomCellOf(handles.random)?.state ?? null
}

/** 지금 순간을 뜬다 */
export function captureSnapshot(meta: { note?: string; scene?: string | null; fixture?: string | null } = {}): SessionSnapshotFile {
  const encoder = new Encoder()
  const fibers: SnapshotFiber[] = []
  for (const { path, fiber } of hookFibers()) {
    const hooks = hooksOf(fiber)
    const kinds = hooks.map(kindOf).join('')
    const slots: (readonly [number, number] | readonly [number, number, string])[] = []
    hooks.forEach((hook, index) => {
      const kind = kinds[index]
      if (kind === 's') slots.push([index, encoder.put(hook.memoizedState)])
      else if (kind === 'r') slots.push([index, encoder.put((hook.memoizedState as { current: unknown }).current)])
      else if (kind === 'm') {
        const [value, deps] = hook.memoizedState as [unknown, unknown]
        slots.push([index, encoder.put(value), standaloneKeyOf(deps)])
      }
    })
    fibers.push({ path, kinds, hooks: slots })
  }
  const modules: Record<string, number> = {}
  for (const [name, slot] of snapshotSlots()) if (slot.weak === undefined) modules[name] = encoder.put(slot.capture())
  // 약한 표는 맨 뒤 — 앞 칸에서 닿은 열쇠만
  for (const [name, slot] of snapshotSlots()) if (slot.weak !== undefined) modules[name] = encoder.put(reachableWeak(slot, encoder))
  const anchors: Record<string, number> = {}
  for (const [name, slot] of snapshotSlots()) {
    for (const [key, live] of Object.entries(slot.anchors?.() ?? {})) {
      const id = encoder.idOf(live)
      if (id !== undefined) anchors[`${name}.${key}`] = id
    }
  }
  return {
    version: 1,
    note: meta.note ?? '',
    scene: meta.scene ?? null,
    fixture: meta.fixture ?? null,
    capturedAt: new Date().toISOString(),
    appTick: appTickNow(),
    now: performance.now(),
    tickPhase: performance.now() - appTickStartTime(appTickNow()),
    random: randomStateNow(),
    localStorage: storageNow(),
    fibers,
    modules,
    anchors,
    values: encoder.values,
  }
}

/** 약한 표 칸의 값 중 `encoder` 가 이미 적은 열쇠만 */
function reachableWeak(slot: SnapshotSlot, encoder: Encoder): unknown {
  const value = slot.capture() as unknown[]
  if (slot.weak === 'set') return value.filter((key) => encoder.idOf(key as object) !== undefined)
  return (value as [object, unknown][]).filter(([key]) => encoder.idOf(key) !== undefined)
}

// ─── 되살리기 ────────────────────────────────────────────────────────────────────────────────────────────────

/** 그리기 전 — 저장을 깔고 틱을 세운다 */
export function prepareSnapshot(file: SessionSnapshotFile): void {
  const storage = window.localStorage
  for (const key of Object.keys(storage)) {
    if (key.startsWith(STORAGE_PREFIX)) storage.removeItem(key)
  }
  for (const [key, value] of Object.entries(file.localStorage)) storage.setItem(key, value)
  rebaseAppTickForDev(file.appTick)
}

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** 되살린 결과 — 진행기가 `window.__scene` 에 적는다 */
export interface SnapshotRestoreReport {
  readonly passes: number
  readonly fibers: number
  readonly restored: number
  /** 뜬 나무에 있는데 끝내 안 선 자리 */
  readonly missing: readonly string[]
}

/** 앱을 그린 뒤 — 자리마다 값을 넣는다 */
export async function restoreSnapshot(file: SessionSnapshotFile, { maxPasses = 80 } = {}): Promise<SnapshotRestoreReport> {
  if (file.version !== 1) throw new Error(`스냅샷 판본이 다르다: ${String(file.version)}`)
  /** 모듈 붙박이 객체 — 그 번호의 값은 새 객체 대신 지금 모듈 객체에 채운다(부품 ref 가 같은 객체를 쥐어도 하나로 남게) */
  const adopt = new Map<number, object>()
  for (const [name, slot] of snapshotSlots()) {
    for (const [key, live] of Object.entries(slot.anchors?.() ?? {})) {
      const id = file.anchors?.[`${name}.${key}`]
      if (id !== undefined) adopt.set(id, live)
    }
  }
  const decoder = new Decoder(file.values, adopt)
  const byPath = new Map(file.fibers.map((entry) => [entry.path, entry]))
  const applied = new WeakSet<Fiber>()
  const appliedPaths = new Set<string>()
  let isHolding = true
  // 되살리는 동안 앱 틱을 뜬 틱에 세워 둔다 — 새로 선 부품이 적는 틱 · 장면 시계가 앞으로 가지 않게
  const hold = () => {
    if (!isHolding) return
    rebaseAppTickForDev(file.appTick)
    requestAnimationFrame(hold)
  }
  hold()

  const valueOf = (at: number, fresh: unknown): unknown => {
    if (isWholeHole(file.values[at])) return fresh
    const value = decoder.get(at)
    decoder.fill(at, fresh)
    return value
  }

  /** 한 부품의 훅 칸을 넣는다 — 상태를 바꿨으면 참 */
  const applyFiber = (fiber: Fiber, entry: SnapshotFiber, { refsOnly = false } = {}): boolean | null => {
    const hooks = hooksOf(fiber)
    const kinds = hooks.map(kindOf).join('')
    // 자리에 다른 부품이 서 있다 — 부모가 되살린 상태로 다시 그리면 바뀐다(끝내 다르면 낡은 스냅샷)
    if (kinds !== entry.kinds) return null
    let changed = false
    for (const slot of entry.hooks) {
      const [index, at] = slot
      const hook = hooks[index]!
      const kind = kinds[index]
      if (kind === 'r') {
        const ref = hook.memoizedState as { current: unknown }
        ref.current = valueOf(at, ref.current)
      } else if (kind === 'm') {
        const [value, deps] = hook.memoizedState as [unknown, unknown]
        if (slot.length === 3 && standaloneKeyOf(deps) === slot[2] && !isWholeHole(file.values[at])) assignInPlace(value, valueOf(at, value))
      } else if (kind === 's' && !refsOnly) {
        const value = valueOf(at, hook.memoizedState)
        if (!Object.is(value, hook.memoizedState)) {
          hook.queue!.dispatch!(() => value)
          changed = true
        }
      }
    }
    return changed
  }

  /**
   * 모듈 · 루프 칸 — 부품 상태와 같은 그래프로 푼다(같은 객체는 같은 객체). 붙박이 객체를 든 칸은 새로 푼다 — 되살리는 동안 선 부품이
   * 모듈 객체를 비웠을 수 있다(경기 장면이 서며 파티클을 치우는 따위). 앱을 다시 그리기 전에 한 번(약한 표 · 모듈 칸을 첫 그림부터
   * 보게), 끝에 한 번(그동안 선 루프 칸까지) 넣는다
   */
  const restoreModules = () => {
    const shiftMs = performance.now() - file.now
    for (const [name, slot] of snapshotSlots()) {
      const at = file.modules[name]
      if (at === undefined) continue
      const source = slot.anchors === undefined ? decoder : new Decoder(file.values, adopt)
      const value = source.get(at)
      source.fill(at, slot.capture())
      slot.restore(value, shiftMs)
    }
  }
  restoreModules()
  const isApplied = (fiber: Fiber) => applied.has(fiber) || (fiber.alternate !== null && applied.has(fiber.alternate))
  let passes = 0
  await withFinallyAsync(
    async () => {
      let quietPasses = 0
      for (; passes < maxPasses && quietPasses < 3; passes += 1) {
        let didApply = false
        /** 이번 바퀴에 넣은(또는 아직 못 넣은) 자리 — 그 아래는 부모가 다시 그린 뒤 다음 바퀴에 본다 */
        const settled = new Set<string>()
        for (const { path, fiber, parent } of hookFibers()) {
          if (parent !== null && !settled.has(parent)) continue
          const entry = byPath.get(path)
          if (entry === undefined) continue
          if (isApplied(fiber)) {
            settled.add(path)
            continue
          }
          const changed = applyFiber(fiber, entry)
          if (changed === null) continue
          applied.add(fiber)
          appliedPaths.add(path)
          didApply = true
          if (!changed) settled.add(path)
        }
        quietPasses = didApply ? 0 : quietPasses + 1
        await frame()
        await sleep(0)
      }
      // 마지막 — 새로 선 부품의 effect 가 건드린 칸을 덮는다(상태 · ref 모두), 그다음 모듈 칸 · 난수 · 틱
      for (let round = 0; round < 3; round += 1) {
        let changed = false
        for (const { path, fiber } of hookFibers()) {
          const entry = byPath.get(path)
          if (entry !== undefined && isApplied(fiber)) changed = applyFiber(fiber, entry) === true || changed
        }
        await frame()
        if (!changed) break
      }
      // 그동안 그림 루프가 고쳐 쓴 객체(장면 칸 ref 의 스킬 판 따위)를 뜬 내용으로 — 이 뒤로는 그림 틀이 없다(r355)
      decoder.rewind()
      for (const { path, fiber } of hookFibers()) {
        const entry = byPath.get(path)
        if (entry !== undefined && isApplied(fiber)) applyFiber(fiber, entry, { refsOnly: true })
      }
      restoreModules()
      const handles = sceneHandlesNow()
      const cell = handles === null ? null : devRandomCellOf(handles.random)
      if (cell !== null && file.random !== null) cell.state = file.random
    },
    () => {
      isHolding = false
      rebaseAppTickForDev(file.appTick, performance.now() - (file.tickPhase ?? 0))
    },
  )
  const missing = file.fibers.map((entry) => entry.path).filter((path) => !appliedPaths.has(path))
  if (missing.length > 0) {
    const first = byPath.get(missing[0]!)!
    const standing = hookFibers().find((entry) => entry.path === first.path)
    throw new Error(
      `스냅샷이 낡았다 — 부품 자리 ${missing.length} 곳이 끝내 안 섰다. 처음: ${first.path} (훅 ${first.kinds} → ` +
        `${standing === undefined ? '자리 없음' : hooksOf(standing.fiber).map(kindOf).join('')}). yarn e2e:snapshot 으로 다시 뜰 것`,
    )
  }
  return { passes, fibers: file.fibers.length, restored: appliedPaths.size, missing }
}

// ─── 같음 견주기 ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * 지금 상태의 요약 — 같음 확인 도구(`e2e/snapshot.mjs verify`)가 실제로 진행한 쪽과 바로 연 쪽을 견준다.
 * `core` 는 진행 칸 · 커리어 · 미션 · 화면 · 난수 칸(꼭 같아야 하는 것), `fibers` 는 부품 자리마다 훅 칸 글의 짧은 해시(참고).
 */
export function snapshotDigest(): {
  readonly appTick: number
  readonly random: number | null
  readonly core: Readonly<Record<string, string>>
  readonly fibers: Readonly<Record<string, string>>
  readonly modules: Readonly<Record<string, string>>
  readonly storage: Readonly<Record<string, string>>
} {
  const handles = sceneHandlesNow()
  const core: Record<string, string> = {}
  if (handles !== null) {
    core.screen = standaloneKeyOf(handles.screen)
    core.career = standaloneKeyOf(handles.career.career)
    core.savedCareer = standaloneKeyOf(handles.career.savedCareer)
    core.progress = standaloneKeyOf(handles.career.progress)
    core.pitcherCareer = standaloneKeyOf(handles.pitcher.career)
    core.seasonScene = standaloneKeyOf(handles.season.scene)
    core.mission = standaloneKeyOf(missionCoreOf(handles.mission))
  }
  const fibers: Record<string, string> = {}
  for (const { path, fiber } of hookFibers()) {
    const hooks = hooksOf(fiber)
    const kinds = hooks.map(kindOf)
    const values = hooks.map((hook, index) => {
      if (kinds[index] === 's') return hook.memoizedState
      if (kinds[index] === 'r') return (hook.memoizedState as { current: unknown }).current
      return null
    })
    fibers[path] = hashOf(`${kinds.join('')}|${standaloneKeyOf(values)}`)
  }
  const modules: Record<string, string> = {}
  // 약한 표는 부품 · 모듈 칸에서 닿는 열쇠만 견준다(아직 거두지 않은 지난 객체는 빼고)
  const reach = new Encoder()
  for (const { fiber } of hookFibers()) {
    for (const hook of hooksOf(fiber)) {
      const kind = kindOf(hook)
      if (kind === 's') reach.put(hook.memoizedState)
      else if (kind === 'r') reach.put((hook.memoizedState as { current: unknown }).current)
    }
  }
  for (const [name, slot] of snapshotSlots()) {
    if (slot.weak === undefined) {
      const value = slot.capture()
      reach.put(value)
      modules[name] = standaloneKeyOf(value)
    }
  }
  for (const [name, slot] of snapshotSlots()) if (slot.weak !== undefined) modules[name] = standaloneKeyOf(reachableWeak(slot, reach))
  return { appTick: appTickNow(), random: randomStateNow(), core, fibers, modules, storage: storageNow() }
}

/** 미션 세션에서 데이터 칸만 (액션 함수 빼고) */
function missionCoreOf(mission: unknown): unknown {
  if (mission === null || typeof mission !== 'object') return mission
  const data: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(mission)) {
    if (key !== 'actions' && typeof value !== 'function') data[key] = value
  }
  return data
}

/** 부품 자리 하나의 훅 칸 값 (같음 확인 도구가 다른 자리를 자세히 볼 때) */
export function fiberValuesAt(path: string): unknown {
  for (const entry of hookFibers()) {
    if (entry.path !== path) continue
    const hooks = hooksOf(entry.fiber)
    return hooks.map((hook) => {
      const kind = kindOf(hook)
      if (kind === 's') return { kind, value: JSON.parse(standaloneKeyOf(hook.memoizedState)) as unknown }
      if (kind === 'r') return { kind, value: JSON.parse(standaloneKeyOf((hook.memoizedState as { current: unknown }).current)) as unknown }
      return { kind }
    })
  }
  return null
}

function hashOf(text: string): string {
  let hash = 0x811c9dc5
  for (let at = 0; at < text.length; at += 1) {
    hash ^= text.charCodeAt(at)
    hash = Math.imul(hash, 0x01000193)
  }
  return `${(hash >>> 0).toString(16)}:${text.length}`
}
