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

/** 폴더 하나에서 받을 것 */
export interface SpriteFolderPreload {
  /** `./sprites/num` · `./sprites/img_text/frames` 처럼 PNG 가 놓인 폴더 */
  readonly folder: string
  /** 받을 프레임 번호. `'all'` 이면 origins.json 의 칸을 모두 받는다 */
  readonly frames: readonly number[] | 'all'
  /** 같이 받을 JSON (폴더 기준 이름) — 합성 프레임 폴더면 보통 `origins.json` */
  readonly json?: readonly string[]
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
    } else {
      frames = request.frames
    }
    const imageDone = frames.map((frame) => enqueue(frameUrl(request.folder, frame), priority))
    pump()
    await Promise.all([...jsonDone, ...imageDone])
  }

  return {
    preload: async (requests, priority) => {
      await Promise.all(requests.map((request) => preloadFolder(request, priority)))
    },
  }
}
