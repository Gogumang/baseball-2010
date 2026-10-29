import { castOfRosterBatters, gameEntryCastPreloadsOf, stageSpritePreloadsOf } from '@/app/model/gameSpritePreload'
import { mergeSpritePreloads } from '@/shared/lib/sprite/spritePreload'
import type { SpriteFolderPreload } from '@/shared/lib/sprite/spritePreload'
import type { SpriteSceneKey } from '@/shared/lib/sprite/scenePreload'

/**
 * 미션 경기 로딩 판 동안 받을 그림 — 미션은 로딩 판 뒤 곧바로 첫 판(0x18, 미션 목표 · 경기 끝 판과 같은 글자 칸)이라 `afterGame` 도,
 * 선수는 첫 그림 몫(대기 자세 · 수비 서 있기)을 먼저 그 뒤 기본 출연진 전부(두 몸통 폼 · 평범한 투수 · 루 주자)
 */
export const MISSION_LOADING_SCENES: readonly SpriteSceneKey[] = ['gameEntry', 'gameAtBat', 'afterGame']
const MISSION_STAGE_PRELOADS = mergeSpritePreloads(gameEntryCastPreloadsOf(), stageSpritePreloadsOf())

/**
 * 로딩 판 목록 — 투수 미션이면 CPU 팀 마스터 줄의 장비 니블 그림(타석 교대 0x47cc8 47e80 → 0x78fd8)까지.
 * 같은 팀이면 같은 배열을 돌려준다(`LoadingTip` 이 다시 받지 않게)
 */
const missionStagePreloadCache = new Map<number, readonly SpriteFolderPreload[]>()
export function missionStagePreloadsOf(cpuTeamId: number | undefined): readonly SpriteFolderPreload[] {
  if (cpuTeamId === undefined) return MISSION_STAGE_PRELOADS
  const cached = missionStagePreloadCache.get(cpuTeamId)
  if (cached !== undefined) return cached
  const preloads = mergeSpritePreloads(MISSION_STAGE_PRELOADS, stageSpritePreloadsOf(castOfRosterBatters(cpuTeamId)))
  missionStagePreloadCache.set(cpuTeamId, preloads)
  return preloads
}
