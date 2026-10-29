import { spriteMaskSrc } from '@/shared/lib/sprite/spriteMask'
import type { SpriteFolderPreload } from '@/shared/lib/sprite/spritePreloadTypes'

/**
 * 장면 줄 동시 요청 수 — 문서를 받은 HTTP 판(`nextHopProtocol`)으로 고른다 (r322, OPTIMIZATION-2026-10-27 A3).
 *
 * HTTP/1.1 은 호스트당 연결이 6개라 장면 줄도 6 이다(더 올리면 JS · JSON 이 그림 뒤에 줄을 선다 — 개발 서버 · `vite preview`).
 * HTTP/2 · 3(배포 호스트)은 요청이 한 연결에 겹쳐 가므로 6 이 오히려 병목이었다: 느린 4G(왕복 150ms · 1.6Mbps)에서 줄이 늘
 * 4~6 개뿐이라 망은 5~30% 만 쓰였고, 장면 그림이 ready 뒤 1.0~3.1초 더 걸렸다. 24 로 올리면 ready 는 그대로(±0.1초)이고
 * 장면 그림은 ready 무렵에 다 온다. 유휴 줄(기본 4)은 그대로 둔다 — 16 으로 올리면 JS 와 대역을 다퉈 ready 가 0.4~0.6초 늦었다.
 * 판을 모르면(빈 글자 · 옛 브라우저) 예전 값 6.
 */
export function sceneConcurrencyFor(protocol: string | undefined): number {
  return protocol === 'h2' || protocol === 'h3' ? 24 : 6
}

export function frameUrl(folder: string, frame: number): string {
  return `${folder}/${String(frame).padStart(3, '0')}.png`
}

/** 목록이 받을 PNG 주소 (프레임 · 마스크, `'all'` · `animations` 는 빼고 — 표를 받아야 안다) — 시험 · 측정용 */
export function preloadImageUrlsOf(requests: readonly SpriteFolderPreload[]): string[] {
  return requests.flatMap((request) => [
    ...(request.frames === 'all' ? [] : request.frames.map((frame) => frameUrl(request.folder, frame))),
    ...(request.masks ?? []).map((frame) => spriteMaskSrc(frameUrl(request.folder, frame))),
    ...(request.names ?? []).map((name) => `${request.folder}/${name}.png`),
  ])
}

/** 폴더 하나에 모은 칸들 */
interface MergedFolder {
  frames: Set<number> | 'all'
  json: Set<string>
  masks: Set<number>
  names: Set<string>
  listedIn?: string
  animations: Set<number>
  animationsIn?: string
}

const addAll = <T>(target: Set<T>, items: readonly T[] | undefined) => {
  for (const item of items ?? []) target.add(item)
}

/** 목록 한 줄을 폴더 칸에 더한다 — 프레임은 `'all'` 이 이기고, 원점 · 애니 표 폴더는 나중 것이 이긴다 */
function mergeInto(entry: MergedFolder, request: SpriteFolderPreload): void {
  if (request.framesListedIn !== undefined) entry.listedIn = request.framesListedIn
  if (request.frames === 'all') entry.frames = 'all'
  else if (entry.frames !== 'all') addAll(entry.frames, request.frames)
  addAll(entry.json, request.json)
  addAll(entry.masks, request.masks)
  addAll(entry.names, request.names)
  addAll(entry.animations, request.animations)
  if (request.animationsIn !== undefined) entry.animationsIn = request.animationsIn
}

const ascending = (a: number, b: number) => a - b

/** 모은 칸을 목록 한 줄로 — 빈 칸은 싣지 않는다 */
function mergedRequestOf(folder: string, entry: MergedFolder): SpriteFolderPreload {
  return {
    folder,
    frames: entry.frames === 'all' ? 'all' : [...entry.frames].sort(ascending),
    ...(entry.json.size === 0 ? {} : { json: [...entry.json].sort() }),
    ...(entry.masks.size === 0 ? {} : { masks: [...entry.masks].sort(ascending) }),
    ...(entry.names.size === 0 ? {} : { names: [...entry.names].sort() }),
    ...(entry.listedIn === undefined ? {} : { framesListedIn: entry.listedIn }),
    ...(entry.animations.size === 0 ? {} : { animations: [...entry.animations].sort(ascending) }),
    ...(entry.animationsIn === undefined ? {} : { animationsIn: entry.animationsIn }),
  }
}

/**
 * 여러 목록을 폴더별로 합친다 — 프레임·JSON·마스크는 합집합(오름차순), `'all'` 이 하나라도 있으면 `'all'`.
 * 계산으로 만든 목록(선수 그림)과 측정 목록을 겹쳐 쓸 때 같은 폴더가 두 번 나오지 않게 한다. 폴더는 처음 나온 차례다.
 */
export function mergeSpritePreloads(...lists: readonly (readonly SpriteFolderPreload[])[]): SpriteFolderPreload[] {
  const byFolder = new Map<string, MergedFolder>()
  for (const request of lists.flat()) {
    let entry = byFolder.get(request.folder)
    if (entry === undefined) {
      entry = { frames: new Set(), json: new Set(), masks: new Set(), names: new Set(), animations: new Set() }
      byFolder.set(request.folder, entry)
    }
    mergeInto(entry, request)
  }
  return [...byFolder].map(([folder, entry]) => mergedRequestOf(folder, entry))
}

/** 애니 칸 한 줄의 프레임 번호 — `{ frame }` 이 0 이상 정수일 때만 */
function stepFrameOf(step: unknown): number | null {
  const frame = typeof step === 'object' && step !== null ? (step as { frame?: unknown }).frame : undefined
  return typeof frame === 'number' && Number.isInteger(frame) && frame >= 0 ? frame : null
}

/** 애니 하나의 칸들이 쓰는 프레임 — 칸 목록이 아니면 없음 */
function stepFramesOf(steps: unknown): number[] {
  if (!Array.isArray(steps)) return []
  return steps.map(stepFrameOf).filter((frame): frame is number => frame !== null)
}

/**
 * `animations.json`(애니 × 칸 `{ frame, … }`)에서 고른 애니들이 쓰는 프레임 번호. 모양이 틀리면 빈 목록이다
 * — 받지 못한 표는 미리 받기를 줄일 뿐 진행은 같다.
 */
export function animationFramesOf(table: unknown, animations: readonly number[]): number[] {
  if (!Array.isArray(table)) return []
  const frames = new Set<number>()
  for (const animation of animations) addAll(frames, stepFramesOf(table[animation]))
  return [...frames].sort(ascending)
}
