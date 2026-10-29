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
export {
  ASSET_PACK_CACHE_PREFIX,
  ASSET_PACK_MANIFEST,
  ASSET_PACK_SERVICE_WORKER,
  ASSET_PACK_STORED,
  missingPacks,
  parseAssetPackManifest,
  versionOfCacheName,
} from '@/app/assetPacks/assetPackGate/manifest'
export type { AssetPackEntry, AssetPackGateResult, AssetPackManifest } from '@/app/assetPacks/assetPackGate/manifest'
export { runAssetPackGate } from '@/app/assetPacks/assetPackGate/gate'
