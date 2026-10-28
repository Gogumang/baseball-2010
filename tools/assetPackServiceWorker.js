/**
 * **자산 묶음 서비스 워커** (r322) — 빌드가 산출물 `asset-sw.js` 로 복사한다(`tools/viteAssetPacks.ts`).
 *
 * 앱(`src/app/assetPacks/assetPackGate.ts`)이 첫 진입에 받아 Cache Storage `asset-packs-<판>` 에 넣어 둔 묶음에서
 * 낱개 자산 요청(`<img>` · `new Image()` · CSS mask · `fetch` · 덩이 `import()` · 글꼴)에 **그 파일 바이트 그대로** 답한다.
 *  - 판은 등록 주소 `asset-sw.js?v=<판>` 에서 읽는다. 자기 판 캐시만 본다 — 배포가 바뀌면 새 워커 · 새 캐시다.
 *  - 묶음에 없는 주소 · 묶음이 아직 없으면 손대지 않는다(브라우저가 예전처럼 망에서 받는다).
 *  - 질의(`?mask` 따위)는 떼고 찾는다 — 같은 파일이다.
 *  - 쪽 이동(index.html)은 망 먼저, 망이 안 되면 마지막으로 받은 것(오프라인 두 번째 방문).
 *  - 묶음 꼴: `[u32 LE 머리 길이][머리 JSON {"entries":[[경로, 자리, 길이], …]}][바이트 …]`(푼 것). 경로는 워커 범위 기준.
 */
const VERSION = new URL(self.location.href).searchParams.get('v') ?? ''
const CACHE = `asset-packs-${VERSION}`
const STORED = 'asset-packs/stored.json'
const ASSET = /\.(png|js|css|json|mp3|woff2|ttf|otf)$/
const TYPES = {
  png: 'image/png',
  js: 'text/javascript',
  css: 'text/css',
  json: 'application/json',
  mp3: 'audio/mpeg',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
}

/** 경로 → { data(Blob), offset, length }. null 이면 아직 안 읽음 */
let index = null
let loading = null

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// 앱이 묶음을 다 넣었다 — 다음 요청에서 목록을 다시 읽는다
self.addEventListener('message', (event) => {
  if (event.data !== null && typeof event.data === 'object' && event.data.type === 'asset-packs-updated') {
    index = null
    loading = null
  }
})

function scoped(path) {
  return new URL(path, self.registration.scope).href
}

async function readIndex() {
  const map = new Map()
  try {
    const cache = await caches.open(CACHE)
    const stored = await cache.match(scoped(STORED))
    if (stored !== undefined) {
      const packFiles = await stored.json()
      for (const file of packFiles) {
        const response = await cache.match(scoped(`asset-packs/${file}`))
        if (response === undefined) continue
        const blob = await response.blob()
        const headLength = new DataView(await blob.slice(0, 4).arrayBuffer()).getUint32(0, true)
        const head = JSON.parse(await blob.slice(4, 4 + headLength).text())
        const data = blob.slice(4 + headLength)
        for (const [path, offset, length] of head.entries) map.set(path, { data, offset, length })
      }
    }
  } catch {
    // 못 읽으면 빈 목록 — 모두 망으로 간다
  }
  index = map
  return map
}

function respond(path, hit) {
  const extension = path.slice(path.lastIndexOf('.') + 1)
  return new Response(hit.data.slice(hit.offset, hit.offset + hit.length), {
    status: 200,
    headers: { 'Content-Type': TYPES[extension] ?? 'application/octet-stream', 'Content-Length': String(hit.length) },
  })
}

async function navigate(request) {
  try {
    const response = await fetch(request)
    if (response.ok && response.type === 'basic') {
      const copy = response.clone()
      caches
        .open(CACHE)
        .then((cache) => cache.put(self.registration.scope, copy))
        .catch(() => {})
    }
    return response
  } catch (error) {
    const cache = await caches.open(CACHE)
    const cached = await cache.match(self.registration.scope)
    if (cached !== undefined) return cached
    throw error
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (request.mode === 'navigate') {
    event.respondWith(navigate(request))
    return
  }
  if (!ASSET.test(url.pathname) || request.headers.has('range')) return
  const scopePath = new URL(self.registration.scope).pathname
  if (!url.pathname.startsWith(scopePath)) return
  let path
  try {
    path = decodeURIComponent(url.pathname.slice(scopePath.length))
  } catch {
    return
  }
  if (index !== null) {
    // 목록을 읽은 뒤에는 곧바로 가른다 — 묶음에 없으면 손대지 않는다
    const hit = index.get(path)
    if (hit !== undefined) event.respondWith(respond(path, hit))
    return
  }
  loading ??= readIndex()
  event.respondWith(
    loading.then((map) => {
      const hit = map.get(path)
      return hit === undefined ? fetch(request) : respond(path, hit)
    }),
  )
})
