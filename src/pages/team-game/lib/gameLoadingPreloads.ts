/**
 * 팀 경기(일반 · 시즌 · 대전) · 나리 투수편 **로딩 판(상태 7 · 9 · 8) 동안 미리 받을 그림** — 경기 첫 그림 몫(타자 대기 자세 ·
 * 투수 선 자세 · 루 주자 · 수비 서 있기 · 달리기)과 기본 출연진의 타석 그림(두 몸통 폼 · 평범한 투수). 미션 로딩 판
 * (`MissionRoutes` 의 `MISSION_STAGE_PRELOADS`)과 같은 목록이다. 아무도 기다리지 않는다 — 판 길이(진행 칸 0x24)는 그대로다.
 */
import { defenseEntrySpritePreloadsOf } from '@/pages/defense/lib/defenseSpritePreload'
import { mergeSpritePreloads } from '@/shared/lib/sprite/spritePreload'
import type { SpriteFolderPreload } from '@/shared/lib/sprite/spritePreload'
import { stageCastSpritePreloadsOf, stageEntrySpritePreloadsOf } from '@/widgets/batting-stage/lib/stageSpritePreload'

export const GAME_LOADING_PRELOADS: readonly SpriteFolderPreload[] = mergeSpritePreloads(
  stageEntrySpritePreloadsOf(),
  defenseEntrySpritePreloadsOf(),
  stageCastSpritePreloadsOf(),
)
