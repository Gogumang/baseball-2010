import { tryOrAsync } from '@/shared/lib/safe/tryOr'
import {
  ASSET_PACK_MANIFEST,
  ASSET_PACK_STORED,
  AssetPackEntry,
  AssetPackManifest,
  parseAssetPackManifest,
  versionOfCacheName,
} from '@/app/assetPacks/assetPackGate/manifest'

export const absolute = (path: string) => new URL(path, document.baseURI).href

export async function fetchManifest(): Promise<AssetPackManifest | null> {
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

export async function storedPacks(cache: Cache): Promise<string[]> {
  return tryOrAsync(async () => {
    const response = await cache.match(absolute(ASSET_PACK_STORED))
    const value: unknown = response === undefined ? [] : await response.json()
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  }, [])
}

/** 묶음 하나를 받아 풀고(gzip) 캐시에 넣는다. 받은(gzip) 바이트를 알린다 */
export async function downloadPack(cache: Cache, pack: AssetPackEntry, onBytes: (bytes: number) => void): Promise<void> {
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

/** 망이 안 될 때 — 묶음을 넣어 둔 판 캐시 하나 */
export async function storedVersion(): Promise<string | null> {
  for (const name of await caches.keys()) {
    const version = versionOfCacheName(name)
    if (version !== null && (await storedPacks(await caches.open(name))).length > 0) return version
  }
  return null
}
