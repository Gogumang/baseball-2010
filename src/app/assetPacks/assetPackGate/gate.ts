import { hideAssetLoadingScreen } from '@/app/assetPacks/loadingScreen'
import { tryOrElseAsync } from '@/shared/lib/safe/tryOr'
import { ASSET_PACK_SERVICE_WORKER, ASSET_PACK_CACHE_PREFIX, versionOfCacheName, missingPacks } from '@/app/assetPacks/assetPackGate/manifest'
import type { AssetPackGateResult } from '@/app/assetPacks/assetPackGate/manifest'
import { downloadMissingPacks } from '@/app/assetPacks/assetPackGate/downloadMissing'
import { isSupported, setResult, waitForController, notifyWorker } from '@/app/assetPacks/assetPackGate/serviceWorker'
import { fetchManifest, storedPacks, storedVersion } from '@/app/assetPacks/assetPackGate/packCache'

/** 오프라인(또는 묶음 없는 빌드) — 넣어 둔 판이 있으면 그 판 워커로 */
async function passOffline(): Promise<AssetPackGateResult> {
  const version = await storedVersion()
  if (version === null) return setResult('failed')
  await navigator.serviceWorker.register(`${ASSET_PACK_SERVICE_WORKER}?v=${version}`)
  await waitForController(version, 3000)
  return setResult('offline')
}

/** 지금 판이 아닌 캐시를 지운다 */
async function deleteOtherVersions(version: string): Promise<void> {
  for (const name of await caches.keys()) {
    const cached = versionOfCacheName(name)
    if (cached !== null && cached !== version) await caches.delete(name)
  }
}

/** 문을 지난다. 기다린 뒤에 앱을 그린다 */
export async function runAssetPackGate(): Promise<AssetPackGateResult> {
  if (import.meta.env.DEV || import.meta.env.MODE === 'test') return 'skipped'
  if (!isSupported()) return setResult('unsupported')
  return tryOrElseAsync(
    async () => {
      const manifest = await fetchManifest()
      if (manifest === null) return passOffline()
      const registering = navigator.serviceWorker.register(`${ASSET_PACK_SERVICE_WORKER}?v=${manifest.version}`)
      await deleteOtherVersions(manifest.version)
      const cache = await caches.open(`${ASSET_PACK_CACHE_PREFIX}${manifest.version}`)
      const stored = await storedPacks(cache)
      const missing = missingPacks(manifest, stored)
      let result: AssetPackGateResult = 'cached'
      if (missing.length > 0) {
        result = await downloadMissingPacks(cache, missing, stored)
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
