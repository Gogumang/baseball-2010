/**
 * **정적 자산 주소의 앞부분** (웹 전용 — 원본에 없다, r318 · OPTIMIZATION-2026-10-27 A2).
 *
 * `public/` 의 그림(`sprites/`) · 소리(`sounds/`) · 글꼴(`font/`)은 코드 곳곳에서 문서 기준 상대 주소(`./sprites/…`)로 부른다.
 * 그 주소는 모두 이 함수를 거친다.
 *  - **개발 서버 · vitest**: 앞부분이 `./` 그대로다 — 주소 글자가 예전과 한 글자도 다르지 않다.
 *  - **빌드**: vite 플러그인(`tools/viteVersionedAssets.ts`)이 `__ASSET_ROOT__` 를 `./v/<내용 해시>/` 로 박는다. 산출물에서는
 *    `public/` 이 그 폴더로 옮겨 나가므로 주소마다 내용 해시가 들어 있다 — 호스트가 1년 · immutable 로 캐시해도
 *    배포 뒤 옛 그림과 새 코드가 섞이지 않는다(자산이 바뀌면 해시가 바뀌어 새 주소가 된다).
 *
 * 받는 바이트는 같고 주소 앞부분만 다르다 — 화면 · 난수 · 결과는 그대로다.
 */

/** 빌드 때만 vite `define` 이 글자로 바꾼다. 개발 서버 · vitest 에서는 정의되지 않는다 */
declare const __ASSET_ROOT__: string | undefined

/** 자산 주소 앞부분 — 개발 · 시험은 `./`, 빌드는 `./v/<해시>/` */
export const ASSET_ROOT: string = typeof __ASSET_ROOT__ === 'string' ? __ASSET_ROOT__ : './'

/**
 * `public/` 아래 자산 주소. `'./sprites/a/001.png'` · `'sprites/a/001.png'` · `'/sprites/a/001.png'` 를 받아
 * 앞부분을 {@link ASSET_ROOT} 로 바꾼다. 앞부분이 `./` 이면(개발 · 시험) 받은 글자를 그대로 돌려준다.
 */
export function assetUrl(path: string): string {
  if (ASSET_ROOT === './') return path
  if (path.startsWith('./')) return ASSET_ROOT + path.slice(2)
  if (path.startsWith('/')) return ASSET_ROOT + path.slice(1)
  return ASSET_ROOT + path
}
