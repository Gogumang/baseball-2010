import { ASSET_ROOT, assetUrl } from '@/shared/lib/assetUrl/assetUrl'
/**
 * **스프라이트 JSON 묶음** (r311, OPTIMIZATION-2026-10-27 A5).
 *
 * `public/sprites/**\/*.json`(origins · animations · palette · boxes · layers · copy · particles, 265개)을 파일 하나
 * `sprites/sprite-json.bundle.json` 로 묶어 받는다. 장면 하나에 31~73개이던 JSON 요청이 한 번이 된다(gzip 약 60KB).
 * 묶음은 vite 플러그인(`tools/viteSpriteJsonBundle.ts`)이 개발 서버에서는 요청 때 만들어 내주고, 빌드에서는 산출물에 쓴다.
 *
 * **값이 같다**: 묶음에는 각 파일의 글을 **바이트 그대로 문자열로** 담는다. 꺼낼 때마다 그 글을 `JSON.parse` 하므로
 * 낱개 `fetch(url).json()` 과 같은 값의 새 객체를 돌려준다(부르는 쪽이 고쳐도 다른 쪽에 새지 않는 것도 같다).
 *
 * - 주소는 다른 스프라이트처럼 문서 기준 상대 주소(`./sprites/…`)라 `base: './'` 와 하위 경로 배포를 지킨다.
 * - 묶음은 처음 스프라이트 JSON 을 청할 때 받기 시작한다 — 이용안내(첫 화면)는 JSON 을 안 쓰므로 첫 화면을 늦추지 않는다.
 * - 묶음에 없는 주소이거나 묶음을 못 받았으면 예전처럼 낱개 파일을 받는다.
 * - vitest(MODE `test`)에서는 끈다 — 시험들이 가짜 `fetch` 로 낱개 주소를 받는다. 묶음 시험은 `setSpriteJsonBundleForTests` 로 켠다.
 */

export const SPRITE_JSON_BUNDLE_URL = assetUrl('./sprites/sprite-json.bundle.json')

/** 묶음 파일 꼴 — `files` 열쇠는 `sprites/` 아래 경로, 값은 그 파일의 글 */
export interface SpriteJsonBundleFile {
  readonly version: 1
  readonly files: Readonly<Record<string, string>>
}

let bundleUrl: string | null = import.meta.env.MODE === 'test' ? null : SPRITE_JSON_BUNDLE_URL
let bundle: Promise<Readonly<Record<string, string>> | null> | null = null

/**
 * `./sprites/a/b.json` · `sprites/a/b.json` → `a/b.json`. 스프라이트 JSON 이 아니면 null.
 * 빌드에서는 주소 앞부분이 `./v/<해시>/`(`assetUrl`)이라 그 앞부분도 떼어 본다.
 */
export function spriteJsonBundleKey(url: string): string | null {
  const path = ASSET_ROOT !== './' && url.startsWith(ASSET_ROOT) ? url.slice(ASSET_ROOT.length) : url
  const match = /^(?:\.\/)?sprites\/([^?#]+\.json)$/.exec(path)
  return match === null ? null : match[1]
}

function loadBundle(url: string): Promise<Readonly<Record<string, string>> | null> {
  return fetch(url)
    .then((response) => (response.ok ? (response.json() as Promise<SpriteJsonBundleFile>) : null))
    .then((value) => (value !== null && value.version === 1 && typeof value.files === 'object' ? value.files : null))
    .catch(() => null)
}

/** 낱개 파일 — 예전 `spriteCache.startJson` 과 같은 오류 글 */
function fetchJsonFile(url: string): Promise<unknown> {
  return fetch(url).then((response) => {
    if (!response.ok) throw new Error(`스프라이트 정보를 불러오지 못했습니다 (${response.status}): ${url}`)
    return response.json() as Promise<unknown>
  })
}

/**
 * 스프라이트 JSON 하나 — 묶음에 있으면 묶음에서, 없으면 낱개 파일을 받는다. 못 받으면 거부한다(`fetch` + `ok` 검사와 같다).
 * 묶음 글을 그대로 `JSON.parse` 하므로 낱개로 받은 것과 같은 값의 새 객체다.
 */
export function fetchSpriteJson(url: string): Promise<unknown> {
  const key = spriteJsonBundleKey(url)
  if (bundleUrl === null || key === null) return fetchJsonFile(url)
  bundle ??= loadBundle(bundleUrl)
  return bundle.then((files) => {
    const text = files === null || !Object.hasOwn(files, key) ? undefined : files[key]
    return text === undefined ? fetchJsonFile(url) : (JSON.parse(text) as unknown)
  })
}

/** 시험 전용 — 묶음 주소를 켜거나(null 이면 끈다) 받은 묶음을 비운다 */
export function setSpriteJsonBundleForTests(url: string | null): void {
  bundleUrl = url
  bundle = null
}
