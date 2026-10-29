/**
 * **자산 묶음 받기 문** (r322) — 앱 첫 진입(이용안내 앞)에 게임 자산 전부를 묶음 몇 개로 한꺼번에 받는다.
 *
 * 빌드가 만든 `asset-packs/manifest.json` · 묶음(`tools/viteAssetPacks.ts`)을 진행 막대 화면(`loadingScreen`)을 띄운 채 받아
 * Cache Storage `asset-packs-<판>` 에 넣고, 서비스 워커 `asset-sw.js?v=<판>`(`tools/assetPackServiceWorker.js`)가 그 뒤의
 * 낱개 자산 요청에 묶음에서 잘라 답한다.
 *
 * - **바이트만 미리 받는다.** 그림 디코드 · 소리 디코드는 지금처럼 장면이 쓸 때 낱개 주소로 한다 — 받는 바이트가 같으니
 *   화면 · 소리 · 디코드 메모리가 같다. 게임 진행(난수 · 저장)은 이 문을 지난 뒤에야 시작하므로 차례도 같다.
 * - **두 번째 방문**: 캐시에 묶음이 다 있으면 화면 없이 곧바로 지난다. 망이 끊겨도 마지막 판 캐시로 지난다(워커가 index.html 도 낸다).
 * - **배포가 바뀌면** 목록의 판이 바뀐다 — 새 판 캐시에 새로 받고, 다른 판 캐시는 지운다.
 * - **실패**: 묶음마다 세 번까지 다시 받는다. 끝내 못 받은 묶음은 빼고 지난다 — 그 자산은 예전처럼 낱개로 받는다.
 * - **건너뜀**: 개발 서버 · 시험, 서비스 워커 · Cache Storage · `DecompressionStream` 이 없는 브라우저.
 * 결과는 `<html data-asset-packs="…">` 에 적는다.
 */
import { hideAssetLoadingScreen, showAssetLoadingScreen } from '@/app/assetPacks/loadingScreen'
import { tryOrAsync, tryOrElseAsync } from '@/shared/lib/safe/tryOr'

export const ASSET_PACK_MANIFEST = './asset-packs/manifest.json'
export const ASSET_PACK_SERVICE_WORKER = './asset-sw.js'
export const ASSET_PACK_CACHE_PREFIX = 'asset-packs-'
/** 다 넣은 묶음 이름 목록 — 워커가 이것만 본다 */
export const ASSET_PACK_STORED = './asset-packs/stored.json'
const RETRIES = 3
/**
 * 한 번에 받는 묶음 수 — 묶음은 7개 안팎이라 사실상 다 함께 받는다. 둘씩만 받으면 느린 4G(CDP 늦추기)에서 받기가 29.9 → 72.5초로
 * 늘었다(받는 흐름 하나가 줄의 일부만 썼다). 묶음 하나는 푼 크기 2MB 안팎이라 한꺼번에 쥐는 Blob 은 많아야 11MB 남짓이다.
 */
const PARALLEL = 8

/** 일을 `limit` 개씩 */
async function inPool<T>(items: readonly T[], limit: number, work: (item: T) => Promise<void>): Promise<void> {
  let next = 0
  const runner = async () => {
    while (next < items.length) {
      const item = items[next]
      next += 1
      await work(item)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runner))
}

export interface AssetPackEntry {
  readonly file: string
  /** 받는(gzip) 크기 */
  readonly bytes: number
  /** 푼 크기 */
  readonly raw: number
}

export interface AssetPackManifest {
  readonly version: string
  readonly packs: readonly AssetPackEntry[]
}

export type AssetPackGateResult = 'downloaded' | 'cached' | 'offline' | 'partial' | 'failed' | 'skipped' | 'unsupported'

/** 목록 꼴 검사 — 틀리면 null */
export function parseAssetPackManifest(value: unknown): AssetPackManifest | null {
  if (value === null || typeof value !== 'object') return null
  const { version, packs } = value as { version?: unknown; packs?: unknown }
  if (typeof version !== 'string' || !/^[0-9a-f]+$/.test(version) || !Array.isArray(packs)) return null
  const parsed: AssetPackEntry[] = []
  for (const pack of packs) {
    if (pack === null || typeof pack !== 'object') return null
    const { file, bytes, raw } = pack as { file?: unknown; bytes?: unknown; raw?: unknown }
    if (typeof file !== 'string' || !/^[\w.-]+\.bin$/.test(file) || typeof bytes !== 'number' || typeof raw !== 'number') return null
    parsed.push({ file, bytes, raw })
  }
  return { version, packs: parsed }
}

/** 판 캐시 이름에서 판 — 우리 캐시가 아니면 null */
export function versionOfCacheName(name: string): string | null {
  return name.startsWith(ASSET_PACK_CACHE_PREFIX) ? name.slice(ASSET_PACK_CACHE_PREFIX.length) : null
}

/** 아직 캐시에 없는 묶음 */
export function missingPacks(manifest: AssetPackManifest, stored: readonly string[]): AssetPackEntry[] {
  return manifest.packs.filter((pack) => !stored.includes(pack.file))
}

function isSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof caches !== 'undefined' &&
    typeof DecompressionStream !== 'undefined' &&
    typeof TransformStream !== 'undefined'
  )
}

function setResult(result: AssetPackGateResult): AssetPackGateResult {
  document.documentElement.dataset['assetPacks'] = result
  return result
}

const absolute = (path: string) => new URL(path, document.baseURI).href

async function fetchManifest(): Promise<AssetPackManifest | null> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    // 던지면 undefined — 한 번 더
    const manifest = await tryOrAsync(async () => {
      const response = await fetch(ASSET_PACK_MANIFEST, { cache: 'no-store' })
      if (!response.ok) return null
      return parseAssetPackManifest(await response.json())
    }, undefined)
    if (manifest !== undefined) return manifest
  }
  return null
}

async function storedPacks(cache: Cache): Promise<string[]> {
  return tryOrAsync(async () => {
    const response = await cache.match(absolute(ASSET_PACK_STORED))
    const value: unknown = response === undefined ? [] : await response.json()
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  }, [])
}

/** 묶음 하나를 받아 풀고(gzip) 캐시에 넣는다. 받은(gzip) 바이트를 알린다 */
async function downloadPack(cache: Cache, pack: AssetPackEntry, onBytes: (bytes: number) => void): Promise<void> {
  const response = await fetch(new URL(`asset-packs/${pack.file}`, document.baseURI), { cache: 'no-store' })
  if (!response.ok || response.body === null) throw new Error(`묶음 ${pack.file}: ${response.status}`)
  const counted = response.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        onBytes(chunk.byteLength)
        controller.enqueue(chunk)
      },
    }),
  )
  // DecompressionStream 의 쓰는 쪽 타입이 BufferSource 라 Uint8Array 흐름에 맞춰 준다(값은 같다)
  const gunzip = new DecompressionStream('gzip') as unknown as ReadableWritablePair<Uint8Array, Uint8Array>
  const blob = await new Response(counted.pipeThrough(gunzip)).blob()
  if (blob.size !== pack.raw) throw new Error(`묶음 ${pack.file}: 크기 ${blob.size} ≠ ${pack.raw}`)
  await cache.put(absolute(`./asset-packs/${pack.file}`), new Response(blob, { headers: { 'Content-Type': 'application/octet-stream' } }))
}

/** 이 판 워커가 이 쪽을 맡을 때까지 — 끝내 안 오면(한도) 그냥 지난다(맡지 않은 요청은 망으로 가서 결과가 같다) */
function waitForController(version: string, timeoutMs: number): Promise<void> {
  const container = navigator.serviceWorker
  const isOurs = () => container.controller?.scriptURL.endsWith(`v=${version}`) === true
  if (isOurs()) return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => {
      container.removeEventListener('controllerchange', check)
      clearTimeout(timer)
      resolve()
    }
    const check = () => {
      if (isOurs()) done()
    }
    const timer = setTimeout(done, timeoutMs)
    container.addEventListener('controllerchange', check)
  })
}

function notifyWorker(): void {
  navigator.serviceWorker.controller?.postMessage({ type: 'asset-packs-updated' })
}

/** 망이 안 될 때 — 묶음을 넣어 둔 판 캐시 하나 */
async function storedVersion(): Promise<string | null> {
  for (const name of await caches.keys()) {
    const version = versionOfCacheName(name)
    if (version !== null && (await storedPacks(await caches.open(name))).length > 0) return version
  }
  return null
}

/** 문을 지난다. 기다린 뒤에 앱을 그린다 */
export async function runAssetPackGate(): Promise<AssetPackGateResult> {
  if (import.meta.env.DEV || import.meta.env.MODE === 'test') return 'skipped'
  if (!isSupported()) return setResult('unsupported')
  return tryOrElseAsync(
    async () => {
      const manifest = await fetchManifest()
      if (manifest === null) {
        // 오프라인(또는 묶음 없는 빌드) — 넣어 둔 판이 있으면 그 판 워커로
        const version = await storedVersion()
        if (version === null) return setResult('failed')
        await navigator.serviceWorker.register(`${ASSET_PACK_SERVICE_WORKER}?v=${version}`)
        await waitForController(version, 3000)
        return setResult('offline')
      }
      const registering = navigator.serviceWorker.register(`${ASSET_PACK_SERVICE_WORKER}?v=${manifest.version}`)
      for (const name of await caches.keys()) {
        const version = versionOfCacheName(name)
        if (version !== null && version !== manifest.version) await caches.delete(name)
      }
      const cache = await caches.open(`${ASSET_PACK_CACHE_PREFIX}${manifest.version}`)
      const stored = await storedPacks(cache)
      const missing = missingPacks(manifest, stored)
      let result: AssetPackGateResult = 'cached'
      if (missing.length > 0) {
        const total = missing.reduce((sum, pack) => sum + pack.bytes, 0)
        let received = 0
        const screen = showAssetLoadingScreen()
        screen.update(0, total)
        const failed: string[] = []
        await inPool(missing, PARALLEL, async (pack) => {
          let counted = 0
          for (let attempt = 0; attempt < RETRIES; attempt += 1) {
            // 던지면 다시 받는다
            const isDone = await tryOrAsync(async () => {
              received -= counted
              counted = 0
              await downloadPack(cache, pack, (bytes) => {
                counted += bytes
                received += bytes
                screen.update(received, total)
              })
              stored.push(pack.file)
              await cache.put(absolute(ASSET_PACK_STORED), new Response(JSON.stringify(stored), { headers: { 'Content-Type': 'application/json' } }))
              return true
            }, false)
            if (isDone) return
          }
          failed.push(pack.file)
        })
        hideAssetLoadingScreen()
        result = failed.length === 0 ? 'downloaded' : failed.length < missing.length ? 'partial' : 'failed'
      }
      await registering
      if (stored.length > 0) {
        await waitForController(manifest.version, 10000)
        notifyWorker()
      }
      return setResult(result)
    },
    () => {
      hideAssetLoadingScreen()
      return setResult('failed')
    },
  )
}
