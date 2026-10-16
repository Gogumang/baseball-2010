import { useEffect } from 'react'
import type { Screen } from '@/app/model/screen'
import { preloadSpriteScene, retainScreenSprites } from '@/shared/lib/sprite/scenePreload'
import type { SpriteSceneKey } from '@/shared/lib/sprite/scenePreload'
import type { SpritePreloadPriority } from '@/shared/lib/sprite/spritePreload'

export interface ScreenSpritePreload {
  readonly scene: SpriteSceneKey
  readonly priority: SpritePreloadPriority
}

/** 경기(타석) 장면으로 이어지는 앞 화면 — 여기 서 있는 동안 경기 진입 그림을 받아 둔다 */
const BEFORE_GAME_SCREENS: ReadonlySet<Screen['kind']> = new Set<Screen['kind']>([
  '팀선택', '선수등록', '일반모드', '시즌모드', '관리', '경기준비', '미션선택', '마선수대결',
])

/**
 * 화면마다 **다음에 올 장면** 그림을 미리 받는다 — 화면 흐름·시간은 그대로이고, 받기는 뒤에서 돈다.
 *  - 메인메뉴: 팀선택·홈런더비 선택 그림을 유휴로
 *  - 경기로 이어지는 화면: 경기 진입 그림을 바로 (로딩 판 30갱신 안에 다 못 받는 몫을 앞당긴다)
 *  - 홈런더비: 더비 장면을 바로
 *  - 경기 장면이 서 있으면: 타석 진행을 바로, 수비·중계 같은 경기 진행 그림을 유휴로
 */
export function screenSpritePreloadsOf(kind: Screen['kind'], isInGameScene: boolean): readonly ScreenSpritePreload[] {
  const list: ScreenSpritePreload[] = []
  if (kind === '메인메뉴') {
    list.push({ scene: 'teamSelect', priority: 'idle' }, { scene: 'homeRunDerbySelect', priority: 'idle' })
  }
  if (BEFORE_GAME_SCREENS.has(kind)) list.push({ scene: 'gameEntry', priority: 'scene' })
  if (kind === '홈런더비') list.push({ scene: 'homeRunDerby', priority: 'scene' })
  if (isInGameScene || kind === '경기') {
    list.push({ scene: 'gameAtBat', priority: 'scene' }, { scene: 'gamePlay', priority: 'idle' })
  }
  return list
}

/**
 * 앱 첫 진입에 공용 그림을 유휴로, 화면이 바뀔 때마다 다음 장면 그림을 받는다.
 * 화면에 한 번 뜬 스프라이트는 공용 캐시가 붙들어 다시 띄울 때 바로 나오게 한다.
 */
export function useScreenSpritePreload(kind: Screen['kind'], isInGameScene: boolean): void {
  useEffect(() => {
    preloadSpriteScene('common', 'idle')
    return retainScreenSprites()
  }, [])
  useEffect(() => {
    for (const { scene, priority } of screenSpritePreloadsOf(kind, isInGameScene)) preloadSpriteScene(scene, priority)
  }, [kind, isInGameScene])
}
