/**
 * 스프라이트 **미리 받기**.
 *
 * 장면이 열리기 전(로딩 판·앞 화면)에 그 장면이 쓰는 origins JSON 과 PNG 를 받아 `decode()` 해 둔다.
 * 받은 것은 공용 캐시(`spriteCache`)에 들어가므로 캔버스 `sprite()`·DOM `FrameSprite`·`useFrameOrigins` 가 그대로 쓴다.
 *
 * **게임 타이밍은 건드리지 않는다**: 누구도 미리 받기를 기다리지 않는다. 덜 끝났으면 예전처럼
 * 화면이 부르는 순간 받는 늦은 로딩으로 내려앉는다(원본에 없는 대기를 만들지 않는다).
 *
 * 줄은 둘이다.
 *  - 장면 줄(`scene`): 곧 열릴 장면 몫. 바로 받는다.
 *  - 유휴 줄(`idle`): 앱 첫 진입의 공용 폴더 등. 장면 줄이 비었을 때, 브라우저가 한가할 때(requestIdleCallback) 조금씩 받는다.
 *    유휴 줄에 서 있던 것을 장면이 부르면 장면 줄로 올린다.
 *
 * 쪼갠 파일: `spritePreloadTypes`(목록 · 의존 · 줄) · `spritePreloadLists`(동시 수 · 주소 · 목록 합치기 · 애니 프레임) ·
 * `preloadFolderPlan`(받을 프레임 정하기) · `spritePreloadQueue`(두 줄 미리 받기)
 */
export type { SpriteFolderPreload, SpritePreloadDeps, SpritePreloadPriority } from '@/shared/lib/sprite/spritePreloadTypes'
export { animationFramesOf, frameUrl, mergeSpritePreloads, preloadImageUrlsOf, sceneConcurrencyFor } from '@/shared/lib/sprite/spritePreloadLists'
export { createSpritePreloader } from '@/shared/lib/sprite/spritePreloadQueue'
