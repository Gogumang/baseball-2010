/**
 * 스프라이트 PNG·JSON **공용 캐시**.
 *
 * 캔버스(`widgets/batting-stage/lib/spriteLoader` 의 `sprite()`·`placedFrame()`)와
 * DOM(`useSpriteJson`·`useFrameOrigins`·`FrameSprite`)이 같은 캐시를 본다. 미리 받기(`spritePreload`)도
 * 여기로 받아 두므로, 장면이 열릴 때 이미 와 있는 그림은 첫 프레임부터 그려진다.
 *
 * 동작은 예전 각자 캐시와 같다:
 *  - 아직 안 온 그림·JSON 은 null — 화면은 그림 없이 진행되고, 도착하면 다음 프레임부터 그려진다(늦은 로딩).
 *  - 그림은 `onload` 순간 준비된 것으로 본다. 미리 받기만 `decode()` 까지 기다린다.
 *  - 받은 그림(HTMLImageElement)을 붙들고 있어서 브라우저 메모리 캐시에서 밀려나지 않는다 —
 *    같은 주소의 `<img>` 를 다시 세워도 서버에 다시 묻지 않고(`Cache-Control: no-cache` 재검증 없이) 곧바로 뜬다.
 */

type ImageStatus = 'loading' | 'ready' | 'failed'

interface ImageEntry {
  readonly image: HTMLImageElement
  status: ImageStatus
  readonly loaded: Promise<HTMLImageElement | null>
  decoded: Promise<HTMLImageElement | null> | null
}

const images = new Map<string, ImageEntry>()

function canLoadImages(): boolean {
  return typeof Image !== 'undefined'
}

function startImage(url: string, isLowPriority: boolean): ImageEntry {
  const image = new Image()
  // 유휴 미리 받기는 지금 화면이 부르는 그림보다 뒤에 서게 한다.
  if (isLowPriority) image.setAttribute('fetchpriority', 'low')
  let settle: (value: HTMLImageElement | null) => void = () => {}
  const entry: ImageEntry = {
    image,
    status: 'loading',
    loaded: new Promise((resolve) => {
      settle = resolve
    }),
    decoded: null,
  }
  image.onload = () => {
    entry.status = 'ready'
    settle(image)
  }
  image.onerror = () => {
    entry.status = 'failed'
    settle(null)
  }
  image.src = url
  images.set(url, entry)
  return entry
}

/**
 * 캔버스용 — 준비된 그림이면 돌려주고, 아니면 null(처음 부르면 받기 시작).
 * 실패한 그림은 다시 받지 않는다(매 프레임 요청을 막는다 — 예전 `sprite()` 와 같다).
 */
export function spriteImage(url: string): HTMLImageElement | null {
  if (!canLoadImages()) return null
  const entry = images.get(url) ?? startImage(url, false)
  return entry.status === 'ready' ? entry.image : null
}

/** 그림을 받아 `decode()` 까지 마친다. 실패하면 null. 이미 받는 중이면 그 요청을 같이 기다린다. */
export function loadSpriteImage(url: string, isLowPriority = false): Promise<HTMLImageElement | null> {
  if (!canLoadImages()) return Promise.resolve(null)
  const entry = images.get(url) ?? startImage(url, isLowPriority)
  if (entry.decoded === null) {
    entry.decoded = entry.loaded.then((image) =>
      image === null || typeof image.decode !== 'function'
        ? image
        : image.decode().then(
            () => image,
            () => image,
          ),
    )
  }
  return entry.decoded
}

/** 받기를 시작했거나 끝낸 그림인가 */
export function isSpriteImageRequested(url: string): boolean {
  return images.has(url)
}

/**
 * 화면의 `<img>` 가 띄운 스프라이트도 공용 캐시에 붙들어 둔다 — 문서에 `load` 를 잡는 귀 하나(캡처 단계).
 *
 * 붙들지 않은 그림은 `<img>` 가 내려가거나 src 가 바뀌면(애니 칸 넘기기) 브라우저 메모리 캐시에서 밀려날 수 있고,
 * 그러면 다음에 다시 띄울 때 `Cache-Control: no-cache` 재검증 한 바퀴(지연 80ms 면 80ms 남짓) 동안 빈 그림이 된다.
 * 그 `<img>` 요소 자체가 아니라 같은 주소의 새 Image 를 캐시에 둔다(요소는 src 를 바꿔 다른 그림이 될 수 있다).
 * 돌려주는 함수로 귀를 뗀다.
 */
export function retainDisplayedSprites(target: Document): () => void {
  const onLoad = (event: Event) => {
    const element = event.target
    if (!(element instanceof HTMLImageElement)) return
    const src = element.getAttribute('src')
    if (src === null || !src.includes('sprites/') || images.has(src)) return
    spriteImage(src)
  }
  target.addEventListener('load', onLoad, true)
  return () => target.removeEventListener('load', onLoad, true)
}

// ── JSON (origins·animations·boxes …) ─────────────────────────────────────────

type JsonStatus = 'loading' | 'ready' | 'failed'

interface JsonEntry {
  status: JsonStatus
  value: unknown
  readonly request: Promise<unknown>
}

const jsons = new Map<string, JsonEntry>()

function startJson(url: string): JsonEntry {
  const entry: JsonEntry = {
    status: 'loading',
    value: null,
    request: fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`스프라이트 정보를 불러오지 못했습니다 (${response.status}): ${url}`)
        return response.json() as Promise<unknown>
      })
      .then(
        (value) => {
          entry.status = 'ready'
          entry.value = value
          return value
        },
        (error: unknown) => {
          entry.status = 'failed'
          throw error
        },
      ),
  }
  // 거부를 아무도 안 받아도 경고가 뜨지 않게
  entry.request.catch(() => {})
  jsons.set(url, entry)
  return entry
}

/**
 * JSON 을 받는다. **실패했던 주소는 다시 받는다** — 일시적 오류가 영영 고착되지 않게(예전 `useSpriteJson` 과 같다).
 */
export function loadSpriteJson<T>(url: string): Promise<T> {
  const cached = jsons.get(url)
  const entry = cached === undefined || cached.status === 'failed' ? startJson(url) : cached
  return entry.request as Promise<T>
}

/** 이미 도착한 JSON 이면 `{ value }`, 아니면 undefined. 받기를 시작하지 않는다. */
export function readySpriteJson<T>(url: string): { readonly value: T } | undefined {
  const entry = jsons.get(url)
  return entry?.status === 'ready' ? { value: entry.value as T } : undefined
}

/**
 * 캔버스용 — 도착했으면 값, 아니면 null(처음 부르면 받기 시작).
 * 실패한 주소는 다시 받지 않는다(매 프레임 요청을 막는다 — 예전 캔버스 캐시와 같다).
 */
export function spriteJsonNow<T>(url: string): T | null {
  const entry = jsons.get(url) ?? startJson(url)
  return entry.status === 'ready' ? (entry.value as T) : null
}

/** 시험 전용 — 캐시를 비운다 */
export function resetSpriteCacheForTest(): void {
  images.clear()
  jsons.clear()
}
