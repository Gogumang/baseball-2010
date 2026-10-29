import { frameLayersUrl, frameLayerUrlsOf } from '@/shared/lib/sprite/frameLayers'
import { frameCopiesUrl, frameCopyUrlsOf } from '@/shared/lib/sprite/frameCopies'
import { spriteMaskSrc } from '@/shared/lib/sprite/spriteMask'
import { frameUrl } from '@/shared/lib/sprite/spritePreloadLists'
import {
  animationsUrlOf,
  framesAfterOrigins,
  framesOriginsUrlOf,
  needsFrameCopies,
  needsFrameLayers,
  withAnimationFrames,
} from '@/shared/lib/sprite/preloadFolderPlan'
import type { SpriteFolderPreload, SpritePreloadDeps, SpritePreloader, SpritePreloadPriority } from '@/shared/lib/sprite/spritePreloadTypes'

interface Task {
  readonly url: string
  priority: SpritePreloadPriority
  /** 유휴 줄 차례 — 나중에 부른 `preload` 일수록 크다. 유휴 줄은 큰 것부터(지금 화면에서 갈 수 있는 다음 화면이 먼저), 같으면 부른 차례대로 */
  generation: number
  readonly done: Promise<void>
  readonly finish: () => void
  isStarted: boolean
}

/**
 * 미리 받기 두 줄(장면 · 유휴) — 받기 차례가 곧 그림 요청 차례라 줄 · 동시 수 칸을 닫힌 함수 하나에 둔다(원래 모양 그대로).
 * 장면 줄은 바로 `sceneConcurrency` 개까지, 유휴 줄은 장면 줄이 비었을 때 한가한 틈(`scheduleIdle`)에 `idleConcurrency` 개까지 돈다.
 */
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
  const loadJsonOrNull = (url: string) => deps.loadJson(url).catch(() => null)

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

  /** 한가한 틈 — 그새 장면 줄이 생겼으면 그쪽이 먼저다(장면 줄이 끝나면 다시 부른다) */
  function startIdleTasks() {
    isIdleScheduled = false
    if (sceneQueue.length > 0 || sceneActive > 0) return
    while (idleActive < idleConcurrency && idleQueue.length > 0) {
      const task = idleQueue.shift()
      if (task !== undefined && !task.isStarted) run(task, 'idle')
    }
  }

  function pump() {
    while (sceneActive < sceneConcurrency && sceneQueue.length > 0) {
      const task = sceneQueue.shift()
      if (task !== undefined && !task.isStarted) run(task, 'scene')
    }
    if (sceneQueue.length === 0 && idleQueue.length > 0 && !isIdleScheduled) {
      isIdleScheduled = true
      deps.scheduleIdle(startIdleTasks)
    }
  }

  /** 유휴 줄에 서 있던 그림을 다시 부르면 — 장면이면 장면 줄로 올리고, 더 나중 묶음이면 그 차례로 앞당긴다 */
  function promoteWaiting(existing: Task, priority: SpritePreloadPriority, generation: number) {
    if (priority === 'scene') {
      existing.priority = 'scene'
      idleQueue.splice(idleQueue.indexOf(existing), 1)
      sceneQueue.push(existing)
      return
    }
    if (generation <= existing.generation) return
    // 지금 화면이 다시 부른 유휴 그림은 그 묶음 차례로 앞당긴다
    idleQueue.splice(idleQueue.indexOf(existing), 1)
    existing.generation = generation
    insertIdle(existing)
  }

  function enqueue(url: string, priority: SpritePreloadPriority, generation: number): Promise<void> {
    const existing = tasks.get(url)
    if (existing !== undefined) {
      if (existing.priority === 'idle' && !existing.isStarted) promoteWaiting(existing, priority, generation)
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

  /** 폴더의 그림들을 줄에 세운다 — 이름 · 프레임 · 겹 · 복사판 · 마스크 차례 */
  function enqueueFolder(
    request: SpriteFolderPreload,
    frames: readonly number[],
    extraUrls: readonly string[],
    priority: SpritePreloadPriority,
    generation: number,
  ): Promise<void>[] {
    return [
      ...(request.names ?? []).map((name) => enqueue(`${request.folder}/${name}.png`, priority, generation)),
      ...frames.map((frame) => enqueue(frameUrl(request.folder, frame), priority, generation)),
      ...extraUrls.map((url) => enqueue(url, priority, generation)),
      ...(request.masks ?? []).map((frame) => enqueue(spriteMaskSrc(frameUrl(request.folder, frame)), priority, generation)),
    ]
  }

  /** 표를 받는 걸음(원점 → 애니 → 겹 → 복사판)은 예전 차례 그대로 — 받는 사이의 판단만 `preloadFolderPlan` 에 있다 */
  async function preloadFolder(request: SpriteFolderPreload, priority: SpritePreloadPriority, generation: number): Promise<void> {
    const jsonDone = (request.json ?? []).map((name) => loadJsonOrNull(`${request.folder}/${name}`))
    const originsUrl = framesOriginsUrlOf(request)
    let frames = originsUrl === null ? (request.frames as readonly number[]) : framesAfterOrigins(request, await loadJsonOrNull(originsUrl))
    const animationsUrl = animationsUrlOf(request)
    if (animationsUrl !== null) frames = withAnimationFrames(frames, await loadJsonOrNull(animationsUrl), request.animations ?? [])
    const layerUrls = needsFrameLayers(request.folder, frames)
      ? frameLayerUrlsOf(request.folder, await loadJsonOrNull(frameLayersUrl(request.folder)), frames)
      : []
    const copyUrls = needsFrameCopies(request.folder, frames)
      ? frameCopyUrlsOf(request.folder, await loadJsonOrNull(frameCopiesUrl(request.folder)), frames)
      : []
    const imageDone = enqueueFolder(request, frames, [...layerUrls, ...copyUrls], priority, generation)
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
