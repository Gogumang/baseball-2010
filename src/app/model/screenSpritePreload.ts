import { useEffect } from 'react'
import type { Screen } from '@/app/model/screen'
import { afterGameEvaluationPreloads } from '@/app/model/afterGameEventPreload'
import { defensePreloadsOf, gameEntryCastPreloadsOf, stageSpritePreloadsOf } from '@/app/model/gameSpritePreload'
import { mainMenuSpritePreloads } from '@/pages/main-menu/lib/mainMenuSpritePreload'
import { SPRITE_PRELOAD_SCENES } from '@/shared/config/spritePreloadScenes'
import { preloadSpriteScene, preloadSprites, retainScreenSprites } from '@/shared/lib/sprite/scenePreload'
import type { SpriteSceneKey } from '@/shared/lib/sprite/scenePreload'
import type { SpriteFolderPreload, SpritePreloadPriority } from '@/shared/lib/sprite/spritePreload'

/**
 * 미리 받을 장면 — 측정 목록(`SpriteSceneKey`)과 계산 목록 셋:
 *  - `mainMenu`: 메인 메뉴 글자 · 그림자 마스크 (`mainMenuSpritePreloads`)
 *  - `stageCast`: 타석 선수 그림 — 두 몸통 폼 · 평범한 투수 · 루 주자 (명단을 모를 때의 기본 출연진)
 *  - `defense`: 수비 화면 야수 · 주자 · 공
 *  - `gameEntryCast`: 경기 첫 그림 몫 — 타자 대기 자세 · 투수 선 자세 · 수비 서 있기 · 달리기 (`gameEntryCastPreloadsOf`)
 *  - `afterGameEvaluation`: 경기 뒤 평가 감독이 띄울 수 있는 표정 전부 (`afterGameEvaluationPreloads`, 표 0xcc600 · 0xcc570)
 */
export type AppSpriteSceneKey = SpriteSceneKey | ComputedSceneKey
type ComputedSceneKey = 'mainMenu' | 'stageCast' | 'defense' | 'gameEntryCast' | 'afterGameEvaluation'

export interface ScreenSpritePreload {
  readonly scene: AppSpriteSceneKey
  readonly priority: SpritePreloadPriority
}

/** 경기(타석) 장면으로 이어지는 앞 화면 — 여기 서 있는 동안 경기 진입 그림을 받아 둔다 */
const BEFORE_GAME_SCREENS: ReadonlySet<Screen['kind']> = new Set<Screen['kind']>([
  '팀선택', '선수등록', '일반모드', '시즌모드', '관리', '경기준비', '미션선택', '마선수대결', '투수편', '다음경기순위', '투수미션',
])

/**
 * 메인메뉴 앞 화면(이용안내 · 로고 · 타이틀) — 다음이 메인메뉴뿐이라 메뉴에서 갈 화면 그림을 여기서부터 유휴로 받는다.
 * r124 측정(지연 80ms): 공용 그림이 끝난 뒤 메뉴까지 10초 가까이 유휴 줄이 비어 있었고, 메뉴에 1초 남짓 머물고
 * 관리 · 미션 고르기로 가면 첫 0.5초에 mode_ui · mode_icon · slt_frame 이 비었다.
 */
const BEFORE_MAIN_MENU_SCREENS: ReadonlySet<Screen['kind']> = new Set<Screen['kind']>(['이용안내', '로고', '타이틀'])

/** 메인메뉴에서 갈 수 있는 화면 그림 — 나리(최근게임 · 나만의리그)가 먼저: 메뉴 커서가 처음 서는 칸이 최근게임이다 */
const MAIN_MENU_NEXT_SCENES: readonly SpriteSceneKey[] = ['nariMenu', 'teamSelect', 'missionSelect', 'homeRunDerbySelect']

/** 나리(나만의리그) 관리 쪽 화면 — 관리 · 순위 · 경기 준비 그림을 바로 받는다 */
const NARI_MENU_SCREENS: ReadonlySet<Screen['kind']> = new Set<Screen['kind']>([
  '관리', '다음경기순위', '경기준비', '투수편', '이벤트', '외출', '아이템',
])

/**
 * 화면마다 **다음에 올 장면** 그림을 미리 받는다 — 화면 흐름·시간은 그대로이고, 받기는 뒤에서 돈다.
 *  - 메인메뉴(와 그 앞 화면): 나리 관리·팀선택·미션 고르기·홈런더비 선택 그림을 유휴로
 *  - 경기로 이어지는 화면: 경기 진입 그림을 바로, 선수 그림(기본 출연진)을 유휴로
 *  - 나리 관리 쪽 화면: 관리 · 순위 · 경기 준비 그림을 바로
 *  - 홈런더비: 더비 장면을 바로
 *  - 경기 장면이 서 있으면: 타석 진행을 바로, 경기 진행 · 선수 · 수비 · 경기 끝 그림을 유휴로
 */
export function screenSpritePreloadsOf(kind: Screen['kind'], isInGameScene: boolean): readonly ScreenSpritePreload[] {
  const list: ScreenSpritePreload[] = []
  if (kind === '메인메뉴' || BEFORE_MAIN_MENU_SCREENS.has(kind)) {
    for (const scene of MAIN_MENU_NEXT_SCENES) list.push({ scene, priority: 'idle' })
  }
  if (NARI_MENU_SCREENS.has(kind)) list.push({ scene: 'nariMenu', priority: 'scene' })
  if (BEFORE_GAME_SCREENS.has(kind)) {
    list.push(
      { scene: 'gameEntry', priority: 'scene' },
      { scene: 'gameEntryCast', priority: 'scene' },
      { scene: 'stageCast', priority: 'idle' },
      { scene: 'defense', priority: 'idle' },
    )
  }
  if (kind === '홈런더비') list.push({ scene: 'homeRunDerby', priority: 'scene' })
  if (isInGameScene || kind === '경기') {
    list.push(
      { scene: 'gameAtBat', priority: 'scene' },
      { scene: 'stageCast', priority: 'idle' },
      { scene: 'gamePlay', priority: 'idle' },
      { scene: 'defense', priority: 'idle' },
      { scene: 'afterGame', priority: 'idle' },
      { scene: 'afterGameEvaluation', priority: 'idle' },
    )
  }
  return list
}

const computedScenes = new Map<string, readonly SpriteFolderPreload[]>()

/** 계산 장면의 목록 — 한 번 계산해 둔다(입력이 없는 기본 목록이다) */
const COMPUTED_SCENES: Readonly<Record<ComputedSceneKey, () => readonly SpriteFolderPreload[]>> = {
  mainMenu: mainMenuSpritePreloads,
  stageCast: () => stageSpritePreloadsOf(),
  defense: () => defensePreloadsOf(),
  gameEntryCast: gameEntryCastPreloadsOf,
  afterGameEvaluation: afterGameEvaluationPreloads,
}

function isComputedScene(scene: AppSpriteSceneKey): scene is ComputedSceneKey {
  return scene in COMPUTED_SCENES
}

function computedSceneOf(scene: ComputedSceneKey): readonly SpriteFolderPreload[] {
  const cached = computedScenes.get(scene)
  if (cached !== undefined) return cached
  const list = COMPUTED_SCENES[scene]()
  computedScenes.set(scene, list)
  return list
}

/** 장면 하나를 미리 받는다(측정 · 계산 어느 쪽이든). 기다리지 않는다 */
export function preloadAppSpriteScene(scene: AppSpriteSceneKey, priority: SpritePreloadPriority): void {
  if (isComputedScene(scene)) preloadSprites(computedSceneOf(scene), priority)
  else preloadSpriteScene(scene, priority)
}

function sceneListOf(scene: AppSpriteSceneKey): readonly SpriteFolderPreload[] {
  return isComputedScene(scene) ? computedSceneOf(scene) : SPRITE_PRELOAD_SCENES[scene]
}

/**
 * 화면 하나의 목록을 받는다. 장면 줄은 장면마다, **유휴 줄은 한 묶음으로** 넘긴다 — 미리 받기는 나중에 부른 유휴 묶음을
 * 앞세우므로(지금 화면에서 갈 다음 화면이 지난 화면의 남은 몫보다 먼저) 한 화면 안의 차례(나리 → 팀선택 → …)는 묶음 안 차례로 지킨다.
 */
export function preloadScreenSprites(preloads: readonly ScreenSpritePreload[]): void {
  for (const { scene, priority } of preloads) if (priority === 'scene') preloadAppSpriteScene(scene, 'scene')
  const idle = preloads.filter(({ priority }) => priority === 'idle').flatMap(({ scene }) => sceneListOf(scene))
  preloadSprites(idle, 'idle')
}

/**
 * 앱 첫 진입에 메인 메뉴 글자를 바로, 공용 그림을 유휴로, 화면이 바뀔 때마다 다음 장면 그림을 받는다.
 * 화면에 뜬 스프라이트는 공용 캐시가 붙들어 다시 띄울 때 바로 나오게 한다.
 */
export function useScreenSpritePreload(kind: Screen['kind'], isInGameScene: boolean): void {
  useEffect(() => {
    preloadAppSpriteScene('mainMenu', 'scene')
    preloadSpriteScene('common', 'idle')
    return retainScreenSprites()
  }, [])
  useEffect(() => {
    preloadScreenSprites(screenSpritePreloadsOf(kind, isInGameScene))
  }, [kind, isInGameScene])
}
