/**
 * 스페셜 에디트가 쓰는 **다른 조각** — 팀 고르기 배치 · ABILITY 판 · 칸 바탕(`pages/create-player`), 격자 커서(`pages/record`),
 * 메뉴 바탕(`pages/special`). 조각 경계를 넘는 import 를 이 파일 한 곳에 모은다(`lint.boundaries-baseline.js` 의 예외는 이 파일 하나)
 */
export {
  ABILITY_CHART,
  ANCHOR_A,
  ANCHOR_B,
  GRID,
  NAME_BAR,
  TAG,
  abilityAxisMaximumLengthOf,
  cellPositionOf,
  teamGridOpenShapeOf,
} from '@/pages/create-player/lib/teamSelectLayout'
export { AbilityRadarPanel } from '@/pages/create-player/ui/AbilityRadarPanel'
export { ABILITY_RADAR_LABELS } from '@/pages/create-player/lib/abilityRadarPanel'
export { GridCellBack } from '@/pages/create-player/ui/GridCellBack'
export { moveGridCursor } from '@/pages/record/lib/annalsGrid'
export type { AnnalsDirection } from '@/pages/record/lib/annalsGrid'
export { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
