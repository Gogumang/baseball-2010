// 인트로 그리기가 읽는 다른 조각(점수판 틀 · 배경 겹) — 이 폴더 · `gameIntro/` 의 조각 경계 넘기는 여기 한 곳에서만 (`lint.boundaries-baseline.js`)
export {
  NAME_PLATE_COLOR,
  SCOREBOARD_AT,
  SCOREBOARD_FRAME,
  effectOpacityOf,
  namePlateOpacityOf,
  roundPlateRectsOf,
  scoreboardPlacementOf,
  type ScoreboardSide,
} from '@/widgets/scoreboard-frame/lib/scoreboardFrameLayout'
export { ScoreboardFrame } from '@/widgets/scoreboard-frame/ui/ScoreboardFrame'
export type { SceneryOverlay } from '@/widgets/batting-stage/ui/SceneryBackdrop'
