import { hideAssetLoadingScreen, showAssetLoadingScreen } from '@/app/assetPacks/loadingScreen'
import { tryOrAsync } from '@/shared/lib/safe/tryOr'
import { ASSET_PACK_STORED } from '@/app/assetPacks/assetPackGate/manifest'
import type { AssetPackEntry, AssetPackGateResult } from '@/app/assetPacks/assetPackGate/manifest'
import { absolute, downloadPack } from '@/app/assetPacks/assetPackGate/packCache'
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

/**
 * 빠진 묶음을 진행 막대 화면을 띄운 채 받아 캐시에 넣는다 — 묶음마다 세 번까지 다시 받고, 다 넣은 묶음은 `stored` 에 더해
 * 목록(`ASSET_PACK_STORED`)을 그때마다 다시 쓴다. 받은 바이트 셈(`received` · `counted`)은 다시 받을 때 그 묶음 몫을 되돌린다
 */
export async function downloadMissingPacks(cache: Cache, missing: readonly AssetPackEntry[], stored: string[]): Promise<AssetPackGateResult> {
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
  hideAssetLoadingScreen()
  return failed.length === 0 ? 'downloaded' : failed.length < missing.length ? 'partial' : 'failed'
}
