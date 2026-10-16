/**
 * 앱이 쓰는 미리 받기 한 벌 — 장면 목록(`shared/config/spritePreloadScenes`)을 공용 캐시로 받는다.
 *
 * 부르는 쪽은 결과를 기다리지 않는다(`void`). 덜 받았으면 화면은 예전처럼 늦게 뜰 뿐 진행은 같다.
 */
import { SPRITE_PRELOAD_SCENES } from '@/shared/config/spritePreloadScenes'
import type { SpriteSceneKey } from '@/shared/config/spritePreloadScenes'
import { loadSpriteImage, loadSpriteJson, retainDisplayedSprites } from '@/shared/lib/sprite/spriteCache'
import { createSpritePreloader } from '@/shared/lib/sprite/spritePreload'
import type { SpritePreloadPriority } from '@/shared/lib/sprite/spritePreload'

/**
 * 시험(vitest)에서는 받지 않는다 — 가짜 fetch·가짜 타이머로 도는 화면 시험에 요청을 끼워 넣지 않게.
 * 미리 받기 자체는 `spritePreload.test.ts` 가 주입한 가짜로 시험한다.
 */
const isDisabled = typeof process !== 'undefined' && process.env['VITEST'] !== undefined

/** 한가할 때 부른다. 끝내 한가하지 않아도 2초 안에는 부른다 */
function scheduleIdle(callback: () => void): void {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(() => callback(), { timeout: 2000 })
  else setTimeout(callback, 50)
}

const preloader = createSpritePreloader({
  loadImage: loadSpriteImage,
  loadJson: loadSpriteJson,
  scheduleIdle,
})

/** 장면 하나를 미리 받는다. 기다리지 않는다 */
export function preloadSpriteScene(scene: SpriteSceneKey, priority: SpritePreloadPriority = 'scene'): void {
  if (isDisabled) return
  void preloader.preload(SPRITE_PRELOAD_SCENES[scene], priority)
}

/** 화면 `<img>` 가 띄운 스프라이트를 공용 캐시에 붙들기 시작한다(앱 첫 진입에 한 번). 떼는 함수를 돌려준다 */
export function retainScreenSprites(): () => void {
  if (isDisabled || typeof document === 'undefined') return () => {}
  return retainDisplayedSprites(document)
}

export type { SpriteSceneKey }
