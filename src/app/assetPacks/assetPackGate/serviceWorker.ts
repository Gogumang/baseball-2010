import { AssetPackGateResult } from '@/app/assetPacks/assetPackGate/manifest'

export function isSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof caches !== 'undefined' &&
    typeof DecompressionStream !== 'undefined' &&
    typeof TransformStream !== 'undefined'
  )
}

export function setResult(result: AssetPackGateResult): AssetPackGateResult {
  document.documentElement.dataset['assetPacks'] = result
  return result
}

/** 이 판 워커가 이 쪽을 맡을 때까지 — 끝내 안 오면(한도) 그냥 지난다(맡지 않은 요청은 망으로 가서 결과가 같다) */
export function waitForController(version: string, timeoutMs: number): Promise<void> {
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

export function notifyWorker(): void {
  navigator.serviceWorker.controller?.postMessage({ type: 'asset-packs-updated' })
}
