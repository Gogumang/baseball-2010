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
  /** 유휴 줄 동시 요청 수 */
  readonly idleConcurrency?: number
}

export interface SpritePreloader {
  /** 받기를 줄 세운다. 돌려주는 약속은 다 받으면(실패 포함) 풀린다 — 게임은 이것을 기다리지 않는다 */
  readonly preload: (requests: readonly SpriteFolderPreload[], priority: SpritePreloadPriority) => Promise<void>
}

export function frameUrl(folder: string, frame: number): string {
  return `${folder}/${String(frame).padStart(3, '0')}.png`
}

/** 목록이 받을 PNG 주소 (프레임 · 마스크, `'all'` 은 빼고) — 시험 · 측정용 */
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
  const byFolder = new Map<string, { frames: Set<number> | 'all'; json: Set<string>; masks: Set<number>; names: Set<string>; listedIn?: string }>()
  for (const list of lists) {
    for (const request of list) {
      let entry = byFolder.get(request.folder)
      if (entry === undefined) {
        entry = { frames: new Set(), json: new Set(), masks: new Set(), names: new Set() }
        byFolder.set(request.folder, entry)
      }
      if (request.framesListedIn !== undefined) entry.listedIn = request.framesListedIn
      if (request.frames === 'all') entry.frames = 'all'
      else if (entry.frames !== 'all') for (const frame of request.frames) entry.frames.add(frame)
      for (const name of request.json ?? []) entry.json.add(name)
      for (const frame of request.masks ?? []) entry.masks.add(frame)
      for (const name of request.names ?? []) entry.names.add(name)
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
  }))
}

interface Task {
  readonly url: string
  priority: SpritePreloadPriority
  readonly done: Promise<void>
  readonly finish: () => void
  isStarted: boolean
}

export function createSpritePreloader(deps: SpritePreloadDeps): SpritePreloader {
  const sceneConcurrency = deps.sceneConcurrency ?? 6
  const idleConcurrency = deps.idleConcurrency ?? 2
  const tasks = new Map<string, Task>()
  const sceneQueue: Task[] = []
  const idleQueue: Task[] = []
  let sceneActive = 0
  let idleActive = 0
  let isIdleScheduled = false

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

  function enqueue(url: string, priority: SpritePreloadPriority): Promise<void> {
    const existing = tasks.get(url)
    if (existing !== undefined) {
      if (priority === 'scene' && existing.priority === 'idle' && !existing.isStarted) {
        existing.priority = 'scene'
        idleQueue.splice(idleQueue.indexOf(existing), 1)
        sceneQueue.push(existing)
      }
      return existing.done
    }
    let finish: () => void = () => {}
    const done = new Promise<void>((resolve) => {
      finish = resolve
    })
    const task: Task = { url, priority, done, finish, isStarted: false }
    tasks.set(url, task)
    ;(priority === 'scene' ? sceneQueue : idleQueue).push(task)
    return done
  }

  async function preloadFolder(request: SpriteFolderPreload, priority: SpritePreloadPriority): Promise<void> {
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
    const imageDone = [
      ...(request.names ?? []).map((name) => enqueue(`${request.folder}/${name}.png`, priority)),
      ...frames.map((frame) => enqueue(frameUrl(request.folder, frame), priority)),
      ...(request.masks ?? []).map((frame) => enqueue(spriteMaskSrc(frameUrl(request.folder, frame)), priority)),
    ]
    pump()
    await Promise.all([...jsonDone, ...imageDone])
  }

  return {
    preload: async (requests, priority) => {
      await Promise.all(requests.map((request) => preloadFolder(request, priority)))
    },
  }
}
