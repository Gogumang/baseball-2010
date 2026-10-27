/**
 * 스프라이트 **미리 받기**.
 *
 * 장면이 열리기 전(로딩 판·앞 화면)에 그 장면이 쓰는 origins JSON 과 PNG 를 받아 `decode()` 해 둔다.
 * 받은 것은 공용 캐시(`spriteCache`)에 들어가므로 캔버스 `sprite()`·DOM `FrameSprite`·`useFrameOrigins` 가 그대로 쓴다.
 *
 * **게임 타이밍은 건드리지 않는다**: 누구도 미리 받기를 기다리지 않는다. 덜 끝났으면 예전처럼
 * 화면이 부르는 순간 받는 늦은 로딩으로 내려앉는다(원본에 없는 대기를 만들지 않는다).
 *
 * 줄은 둘이다.
 *  - 장면 줄(`scene`): 곧 열릴 장면 몫. 바로 받는다.
 *  - 유휴 줄(`idle`): 앱 첫 진입의 공용 폴더 등. 장면 줄이 비었을 때, 브라우저가 한가할 때(requestIdleCallback) 조금씩 받는다.
 *    유휴 줄에 서 있던 것을 장면이 부르면 장면 줄로 올린다.
 */
import { frameLayersUrl, frameLayerUrlsOf, hasFrameLayers } from '@/shared/lib/sprite/frameLayers'
import { frameCopiesUrl, frameCopyUrlsOf, hasFrameCopies } from '@/shared/lib/sprite/frameCopies'
import { spriteMaskSrc } from '@/shared/lib/sprite/spriteMask'

/** 폴더 하나에서 받을 것 */
export interface SpriteFolderPreload {
  /** `./sprites/num` · `./sprites/img_text/frames` 처럼 PNG 가 놓인 폴더 */
  readonly folder: string
  /** 받을 프레임 번호. `'all'` 이면 origins.json 의 칸을 모두 받는다 */
  readonly frames: readonly number[] | 'all'
  /** 같이 받을 JSON (폴더 기준 이름) — 합성 프레임 폴더면 보통 `origins.json` */
  readonly json?: readonly string[]
  /**
   * CSS `mask-image` 로 쓰는 프레임 번호 — `?mask` 주소를 CORS 모드로 받는다 (`spriteMask` 머리말: `<img>` 몫과 캐시 칸이 갈린다)
   */
  readonly masks?: readonly number[]
  /**
   * 이 폴더의 `origins.json` 에 **있는 프레임만** 받는다 — 그리기(`placedFrame`)가 원점 없는 칸을 아예 안 받는 것과 같게.
   * 계산으로 만든 목록(자세표 × 겹 규칙)은 파일이 없는 칸(번트 앞몸 · 덧그림 없는 투구 단계 따위)을 낼 수 있어 이것으로 거른다.
   * 번호 지도 폴더(`frames/index`)는 원점 표가 없으니 그림 폴더(`frames`)를 가리킨다.
   */
  readonly framesListedIn?: string
  /** 번호가 아닌 이름의 PNG (`management/icon_selected_5` 따위) — 확장자 없이 */
  readonly names?: readonly string[]
  /**
   * 이 애니 번호들이 쓰는 프레임도 받는다 — `animationsIn`(없으면 이 폴더)의 `animations.json` 칸의 `frame` 을 모은다.
   * 이벤트 초상화처럼 **애니 번호만 아는** 계산 목록(`afterGameEventPreload`)이 프레임 번호를 손으로 옮겨 적지 않게 한다.
   */
  readonly animations?: readonly number[]
  /** `animations.json` 이 놓인 폴더 — 번호 지도 폴더(`frames/index`)는 그림 폴더(`frames`)를 가리킨다 */
  readonly animationsIn?: string
}

export type SpritePreloadPriority = 'scene' | 'idle'

export interface SpritePreloadDeps {
  /** 그림을 받아 decode 까지 — 실패해도 거부하지 않고 끝나기만 하면 된다 */
  readonly loadImage: (url: string, isLowPriority: boolean) => Promise<unknown>
  readonly loadJson: (url: string) => Promise<unknown>
  /** 브라우저가 한가할 때 부른다 */
  readonly scheduleIdle: (callback: () => void) => void
  /** 장면 줄 동시 요청 수 */
  readonly sceneConcurrency?: number
  /** 유휴 줄 동시 요청 수 (기본 4 — 2 로는 지연 80ms 에서 메뉴에 머무는 동안 다음 화면 목록에 닿지 못했다, r124 측정) */
  readonly idleConcurrency?: number
}

export interface SpritePreloader {
  /** 받기를 줄 세운다. 돌려주는 약속은 다 받으면(실패 포함) 풀린다 — 게임은 이것을 기다리지 않는다 */
  readonly preload: (requests: readonly SpriteFolderPreload[], priority: SpritePreloadPriority) => Promise<void>
}

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

/**
 * 여러 목록을 폴더별로 합친다 — 프레임·JSON·마스크는 합집합(오름차순), `'all'` 이 하나라도 있으면 `'all'`.
 * 계산으로 만든 목록(선수 그림)과 측정 목록을 겹쳐 쓸 때 같은 폴더가 두 번 나오지 않게 한다. 폴더는 처음 나온 차례다.
 */
export function mergeSpritePreloads(...lists: readonly (readonly SpriteFolderPreload[])[]): SpriteFolderPreload[] {
  const byFolder = new Map<string, {
    frames: Set<number> | 'all'; json: Set<string>; masks: Set<number>; names: Set<string>; listedIn?: string
    animations: Set<number>; animationsIn?: string
  }>()
  for (const list of lists) {
    for (const request of list) {
      let entry = byFolder.get(request.folder)
      if (entry === undefined) {
        entry = { frames: new Set(), json: new Set(), masks: new Set(), names: new Set(), animations: new Set() }
        byFolder.set(request.folder, entry)
      }
      if (request.framesListedIn !== undefined) entry.listedIn = request.framesListedIn
      if (request.frames === 'all') entry.frames = 'all'
      else if (entry.frames !== 'all') for (const frame of request.frames) entry.frames.add(frame)
      for (const name of request.json ?? []) entry.json.add(name)
      for (const frame of request.masks ?? []) entry.masks.add(frame)
      for (const name of request.names ?? []) entry.names.add(name)
      for (const animation of request.animations ?? []) entry.animations.add(animation)
      if (request.animationsIn !== undefined) entry.animationsIn = request.animationsIn
    }
  }
  const ascending = (a: number, b: number) => a - b
  return [...byFolder].map(([folder, entry]) => ({
    folder,
    frames: entry.frames === 'all' ? 'all' : [...entry.frames].sort(ascending),
    ...(entry.json.size === 0 ? {} : { json: [...entry.json].sort() }),
    ...(entry.masks.size === 0 ? {} : { masks: [...entry.masks].sort(ascending) }),
    ...(entry.names.size === 0 ? {} : { names: [...entry.names].sort() }),
    ...(entry.listedIn === undefined ? {} : { framesListedIn: entry.listedIn }),
    ...(entry.animations.size === 0 ? {} : { animations: [...entry.animations].sort(ascending) }),
    ...(entry.animationsIn === undefined ? {} : { animationsIn: entry.animationsIn }),
  }))
}

/**
 * `animations.json`(애니 × 칸 `{ frame, … }`)에서 고른 애니들이 쓰는 프레임 번호. 모양이 틀리면 빈 목록이다
 * — 받지 못한 표는 미리 받기를 줄일 뿐 진행은 같다.
 */
export function animationFramesOf(table: unknown, animations: readonly number[]): number[] {
  if (!Array.isArray(table)) return []
  const frames = new Set<number>()
  for (const animation of animations) {
    const steps: unknown = table[animation]
    if (!Array.isArray(steps)) continue
    for (const step of steps) {
      const frame = typeof step === 'object' && step !== null ? (step as { frame?: unknown }).frame : undefined
      if (typeof frame === 'number' && Number.isInteger(frame) && frame >= 0) frames.add(frame)
    }
  }
  return [...frames].sort((a, b) => a - b)
}

interface Task {
  readonly url: string
  priority: SpritePreloadPriority
  /** 유휴 줄 차례 — 나중에 부른 `preload` 일수록 크다. 유휴 줄은 큰 것부터(지금 화면에서 갈 수 있는 다음 화면이 먼저), 같으면 부른 차례대로 */
  generation: number
  readonly done: Promise<void>
  readonly finish: () => void
  isStarted: boolean
}

export function createSpritePreloader(deps: SpritePreloadDeps): SpritePreloader {
  const sceneConcurrency = deps.sceneConcurrency ?? 6
  const idleConcurrency = deps.idleConcurrency ?? 4
  const tasks = new Map<string, Task>()
  const sceneQueue: Task[] = []
  const idleQueue: Task[] = []
  let sceneActive = 0
  let idleActive = 0
  let isIdleScheduled = false
  let latestGeneration = 0

  /** 유휴 줄에 차례대로 끼운다 — 더 나중에 부른 묶음 뒤 · 더 먼저 부른 묶음 앞 */
  function insertIdle(task: Task) {
    const at = idleQueue.findIndex((queued) => queued.generation < task.generation)
    if (at < 0) idleQueue.push(task)
    else idleQueue.splice(at, 0, task)
  }

  function run(task: Task, priority: SpritePreloadPriority) {
    task.isStarted = true
    if (priority === 'scene') sceneActive += 1
    else idleActive += 1
    deps
      .loadImage(task.url, priority === 'idle')
      .catch(() => {})
      .then(() => {
        if (priority === 'scene') sceneActive -= 1
        else idleActive -= 1
        task.finish()
        pump()
      })
  }

  function pump() {
    while (sceneActive < sceneConcurrency && sceneQueue.length > 0) {
      const task = sceneQueue.shift()
      if (task !== undefined && !task.isStarted) run(task, 'scene')
    }
    if (sceneQueue.length === 0 && idleQueue.length > 0 && !isIdleScheduled) {
      isIdleScheduled = true
      deps.scheduleIdle(() => {
        isIdleScheduled = false
        // 그새 장면 줄이 생겼으면 그쪽이 먼저다 — 장면 줄이 끝나면 다시 부른다
        if (sceneQueue.length > 0 || sceneActive > 0) return
        while (idleActive < idleConcurrency && idleQueue.length > 0) {
          const task = idleQueue.shift()
          if (task !== undefined && !task.isStarted) run(task, 'idle')
        }
      })
    }
  }

  function enqueue(url: string, priority: SpritePreloadPriority, generation: number): Promise<void> {
    const existing = tasks.get(url)
    if (existing !== undefined) {
      if (existing.priority === 'idle' && !existing.isStarted) {
        if (priority === 'scene') {
          existing.priority = 'scene'
          idleQueue.splice(idleQueue.indexOf(existing), 1)
          sceneQueue.push(existing)
        } else if (generation > existing.generation) {
          // 지금 화면이 다시 부른 유휴 그림은 그 묶음 차례로 앞당긴다
          idleQueue.splice(idleQueue.indexOf(existing), 1)
          existing.generation = generation
          insertIdle(existing)
        }
      }
      return existing.done
    }
    let finish: () => void = () => {}
    const done = new Promise<void>((resolve) => {
      finish = resolve
    })
    const task: Task = { url, priority, generation, done, finish, isStarted: false }
    tasks.set(url, task)
    if (priority === 'scene') sceneQueue.push(task)
    else insertIdle(task)
    return done
  }

  async function preloadFolder(request: SpriteFolderPreload, priority: SpritePreloadPriority, generation: number): Promise<void> {
    const jsonNames = request.json ?? []
    const jsonDone = jsonNames.map((name) => deps.loadJson(`${request.folder}/${name}`).catch(() => null))
    let frames: readonly number[] = []
    if (request.frames === 'all') {
      const origins = await deps.loadJson(`${request.folder}/origins.json`).catch(() => null)
      if (origins !== null && typeof origins === 'object') {
        frames = Object.keys(origins)
          .map(Number)
          .filter((frame) => Number.isInteger(frame))
      }
    } else if (request.framesListedIn !== undefined && request.frames.length > 0) {
      const origins = await deps.loadJson(`${request.framesListedIn}/origins.json`).catch(() => null)
      const listed = origins !== null && typeof origins === 'object' ? (origins as Record<string, unknown>) : null
      // 원점 표를 못 받았으면 목록대로 받는다(없는 칸은 실패로 끝날 뿐 진행은 같다)
      frames = listed === null ? request.frames : request.frames.filter((frame) => String(frame).padStart(3, '0') in listed)
    } else {
      frames = request.frames
    }
    if (request.animations !== undefined && request.animations.length > 0) {
      const table = await deps.loadJson(`${request.animationsIn ?? request.folder}/animations.json`).catch(() => null)
      frames = [...new Set([...frames, ...animationFramesOf(table, request.animations)])]
    }
    // 0x67(더하기) 파트가 든 폴더면 받는 프레임의 겹 그림도 받는다 — 그리기(`drawFrameAt`)가 구운 프레임 대신 겹을 쓴다
    const layerUrls = hasFrameLayers(request.folder) && frames.length > 0
      ? frameLayerUrlsOf(request.folder, await deps.loadJson(frameLayersUrl(request.folder)).catch(() => null), frames)
      : []
    // 반투명 파트를 뒤집어(0x11) 그리는 폴더면 복사판도 받는다 — 뒤집을지는 그릴 때 정해지므로 목록에 든 칸을 다 받는다(`frameCopies`)
    const copyUrls = hasFrameCopies(request.folder) && frames.length > 0
      ? frameCopyUrlsOf(request.folder, await deps.loadJson(frameCopiesUrl(request.folder)).catch(() => null), frames)
      : []
    const imageDone = [
      ...(request.names ?? []).map((name) => enqueue(`${request.folder}/${name}.png`, priority, generation)),
      ...frames.map((frame) => enqueue(frameUrl(request.folder, frame), priority, generation)),
      ...layerUrls.map((url) => enqueue(url, priority, generation)),
      ...copyUrls.map((url) => enqueue(url, priority, generation)),
      ...(request.masks ?? []).map((frame) => enqueue(spriteMaskSrc(frameUrl(request.folder, frame)), priority, generation)),
    ]
    pump()
    await Promise.all([...jsonDone, ...imageDone])
  }

  return {
    preload: async (requests, priority) => {
      latestGeneration += 1
      const generation = latestGeneration
      await Promise.all(requests.map((request) => preloadFolder(request, priority, generation)))
    },
  }
}
