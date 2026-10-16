import { describe, expect, it } from 'vitest'
import { createSpritePreloader, frameUrl, mergeSpritePreloads, preloadImageUrlsOf } from '@/shared/lib/sprite/spritePreload'
import type { SpritePreloadDeps } from '@/shared/lib/sprite/spritePreload'

interface Pending {
  readonly url: string
  readonly isLowPriority: boolean
  readonly resolve: () => void
}

function harness(options: Partial<Pick<SpritePreloadDeps, 'sceneConcurrency' | 'idleConcurrency'>> = {}) {
  const pending: Pending[] = []
  const started: string[] = []
  const idleCallbacks: (() => void)[] = []
  const jsonRequests: string[] = []
  const jsonValues = new Map<string, unknown>()
  const preloader = createSpritePreloader({
    loadImage: (url, isLowPriority) =>
      new Promise<void>((resolve) => {
        started.push(url)
        pending.push({ url, isLowPriority, resolve })
      }),
    loadJson: (url) => {
      jsonRequests.push(url)
      return jsonValues.has(url) ? Promise.resolve(jsonValues.get(url)) : Promise.reject(new Error('없음'))
    },
    scheduleIdle: (callback) => {
      idleCallbacks.push(callback)
    },
    ...options,
  })
  const flush = async () => {
    for (let i = 0; i < 10; i += 1) await Promise.resolve()
  }
  const finishAll = async () => {
    while (pending.length > 0) {
      pending.splice(0).forEach((item) => item.resolve())
      await flush()
    }
  }
  const runIdle = async () => {
    idleCallbacks.splice(0).forEach((callback) => callback())
    await flush()
  }
  return { preloader, pending, started, idleCallbacks, jsonRequests, jsonValues, flush, finishAll, runIdle }
}

describe('frameUrl', () => {
  it('프레임 번호를 세 자리로 채운다', () => {
    expect(frameUrl('./sprites/num', 7)).toBe('./sprites/num/007.png')
    expect(frameUrl('./sprites/img_text/frames', 123)).toBe('./sprites/img_text/frames/123.png')
  })
})

describe('createSpritePreloader', () => {
  it('장면 줄은 바로 받되 동시 요청 수를 넘지 않는다', async () => {
    const h = harness({ sceneConcurrency: 2 })
    const done = h.preloader.preload([{ folder: './sprites/num', frames: [0, 1, 2, 3, 4] }], 'scene')
    await h.flush()
    expect(h.started).toEqual(['./sprites/num/000.png', './sprites/num/001.png'])
    expect(h.pending.every((item) => !item.isLowPriority)).toBe(true)

    let isDone = false
    void done.then(() => {
      isDone = true
    })
    await h.finishAll()
    expect(h.started).toHaveLength(5)
    expect(isDone).toBe(true)
  })

  it('같은 그림은 한 번만 받는다', async () => {
    const h = harness()
    void h.preloader.preload([{ folder: './sprites/num', frames: [1, 1, 2] }], 'scene')
    void h.preloader.preload([{ folder: './sprites/num', frames: [2, 3] }], 'scene')
    await h.finishAll()
    expect(h.started).toEqual(['./sprites/num/001.png', './sprites/num/002.png', './sprites/num/003.png'])
  })

  it('JSON 을 같이 받고, frames: all 이면 origins 의 칸을 모두 받는다', async () => {
    const h = harness()
    h.jsonValues.set('./sprites/a/frames/origins.json', { '000': {}, '002': {}, '010': {} })
    void h.preloader.preload(
      [{ folder: './sprites/a/frames', frames: 'all', json: ['origins.json', 'animations.json'] }],
      'scene',
    )
    await h.flush()
    await h.finishAll()
    expect(h.jsonRequests).toContain('./sprites/a/frames/animations.json')
    expect(h.started).toEqual([
      './sprites/a/frames/000.png',
      './sprites/a/frames/002.png',
      './sprites/a/frames/010.png',
    ])
  })

  it('JSON·그림이 실패해도 약속은 풀린다 (기다리는 쪽이 멈추지 않게)', async () => {
    const h = createSpritePreloader({
      loadImage: () => Promise.reject(new Error('404')),
      loadJson: () => Promise.reject(new Error('404')),
      scheduleIdle: (callback) => callback(),
    })
    await expect(
      h.preload(
        [
          { folder: './sprites/x/frames', frames: 'all' },
          { folder: './sprites/y', frames: [0], json: ['origins.json'] },
        ],
        'scene',
      ),
    ).resolves.toBeUndefined()
  })

  it('유휴 줄은 한가할 때만, 낮은 우선순위로 조금씩 받는다', async () => {
    const h = harness({ idleConcurrency: 1 })
    void h.preloader.preload([{ folder: './sprites/num', frames: [0, 1] }], 'idle')
    await h.flush()
    expect(h.started).toEqual([])
    expect(h.idleCallbacks).toHaveLength(1)

    await h.runIdle()
    expect(h.started).toEqual(['./sprites/num/000.png'])
    expect(h.pending[0]?.isLowPriority).toBe(true)

    h.pending.splice(0).forEach((item) => item.resolve())
    await h.flush()
    // 다음 것은 또 한가할 때
    expect(h.started).toHaveLength(1)
    await h.runIdle()
    expect(h.started).toEqual(['./sprites/num/000.png', './sprites/num/001.png'])
  })

  it('장면 줄이 있으면 유휴 줄은 기다리고, 장면이 부른 유휴 그림은 장면 줄로 올라간다', async () => {
    const h = harness({ sceneConcurrency: 1 })
    void h.preloader.preload([{ folder: './sprites/num', frames: [0, 1, 2] }], 'idle')
    await h.flush()
    void h.preloader.preload([{ folder: './sprites/game', frames: [5] }, { folder: './sprites/num', frames: [2] }], 'scene')
    await h.flush()
    expect(h.started).toEqual(['./sprites/game/005.png'])

    // 장면 줄이 도는 동안 유휴 콜백이 와도 아무것도 시작하지 않는다
    await h.runIdle()
    expect(h.started).toEqual(['./sprites/game/005.png'])

    h.pending.splice(0).forEach((item) => item.resolve())
    await h.flush()
    expect(h.started).toEqual(['./sprites/game/005.png', './sprites/num/002.png'])
    expect(h.pending[0]?.isLowPriority).toBe(false)

    h.pending.splice(0).forEach((item) => item.resolve())
    await h.flush()
    await h.runIdle()
    expect(h.started.slice(2)).toEqual(['./sprites/num/000.png', './sprites/num/001.png'])
  })
})

describe('r111 — 마스크 · 이름 · 원점 표 거르기 · 합치기', () => {
  it('마스크 프레임은 ?mask 주소로, 이름 PNG 는 이름 그대로 받는다', async () => {
    const h = harness()
    void h.preloader.preload([{ folder: './sprites/img_text/frames', frames: [6], masks: [6, 9] }, { folder: './sprites/management', frames: [], names: ['icon_selected_5'] }], 'scene')
    await h.flush()
    expect(h.started).toEqual([
      './sprites/img_text/frames/006.png',
      './sprites/img_text/frames/006.png?mask',
      './sprites/img_text/frames/009.png?mask',
      './sprites/management/icon_selected_5.png',
    ])
  })

  it('framesListedIn 이면 그 폴더 origins.json 에 있는 칸만 받는다 — 표를 못 받으면 목록대로', async () => {
    const h = harness()
    h.jsonValues.set('./sprites/pitcher/frames/origins.json', { '000': {}, '022': {} })
    void h.preloader.preload([
      { folder: './sprites/pitcher/frames', frames: [0, 22, 29], json: ['origins.json'], framesListedIn: './sprites/pitcher/frames' },
      { folder: './sprites/pitcher/frames/index', frames: [0, 29], framesListedIn: './sprites/pitcher/frames' },
      { folder: './sprites/x/frames', frames: [1], framesListedIn: './sprites/x/frames' },
    ], 'scene')
    await h.flush()
    expect(h.started.sort()).toEqual([
      './sprites/pitcher/frames/000.png',
      './sprites/pitcher/frames/022.png',
      './sprites/pitcher/frames/index/000.png',
      './sprites/x/frames/001.png',
    ])
  })

  it('mergeSpritePreloads 는 폴더별 합집합이고 all 이 이긴다', () => {
    const merged = mergeSpritePreloads(
      [{ folder: 'a', frames: [3, 1], json: ['origins.json'] }, { folder: 'b', frames: 'all' }],
      [{ folder: 'a', frames: [2, 1], masks: [5], framesListedIn: 'a' }, { folder: 'b', frames: [1] }, { folder: 'c', frames: [], names: ['z', 'y'] }],
    )
    expect(merged).toEqual([
      { folder: 'a', frames: [1, 2, 3], json: ['origins.json'], masks: [5], framesListedIn: 'a' },
      { folder: 'b', frames: 'all' },
      { folder: 'c', frames: [], names: ['y', 'z'] },
    ])
    expect(preloadImageUrlsOf(merged)).toEqual(['a/001.png', 'a/002.png', 'a/003.png', 'a/005.png?mask', 'c/y.png', 'c/z.png'])
  })
})
