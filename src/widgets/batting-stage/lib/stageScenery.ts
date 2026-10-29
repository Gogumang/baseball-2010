/**
 * 타석 화면 배경·투수·판정 연출 (위치 분석 6차 — 바이트 확인, 추정은 표시).
 *
 * - 하늘 줄 · 색(`sky`) · 구름(`clouds`) · 결과 창 구장 밀기(`resultBackdrop`) · 하늘 조명(`skyLight`)
 * - 투수 그림 객체 vtable 0xd73d0 — 표(`pitchStepTables`) · 단계 셈(`pitchSteps`) · 상태(`pitcherAnimation`) · 자세(`pitcherPose`)
 * - 판정 글자 애니 · 팀 아이콘(`judgeText`)
 */

export { SKY_ROW_COUNT, skyColumnOfInning, stadiumSkyRowOf, skyColorsOf } from '@/widgets/batting-stage/lib/stageScenery/sky'
export {
  CLOUD_WRAP_WIDTH,
  cloudScrollAt,
  LOADING_CLOUD_CALLS,
  isCloudVisible,
  cloudPaletteRowOf,
} from '@/widgets/batting-stage/lib/stageScenery/clouds'
export { RESULT_BACKDROP_LIMIT, resultBackdropOffsetAt } from '@/widgets/batting-stage/lib/stageScenery/resultBackdrop'
export {
  SKY_LIGHT_LAST_COLOR_INDEX,
  isSkyLightModeShown,
  skyLightPaletteRowOf,
  skyLightFrameAt,
} from '@/widgets/batting-stage/lib/stageScenery/skyLight'
export {
  pitchLastStepOf,
  pitchStepAt,
  pitchStepStartTickOf,
  pitcherReleaseTicksOf,
  PITCHER_RELEASE_TICKS,
  PITCHER_IDLE_TICKS,
} from '@/widgets/batting-stage/lib/stageScenery/pitchSteps'
export { pitcherAnimationAt, pitcherStepRuleOf } from '@/widgets/batting-stage/lib/stageScenery/pitcherAnimation'
export type { PitcherAnimation } from '@/widgets/batting-stage/lib/stageScenery/pitcherAnimation'
export {
  pitcherPoseFramesOf,
  pitcherPoseOf,
  pitcherFrameAt,
  PITCHER_OVERLAY_FRAME_OFFSET,
} from '@/widgets/batting-stage/lib/stageScenery/pitcherPose'
export { judgeAnimationOf, judgeFrameAt, teamIconOf } from '@/widgets/batting-stage/lib/stageScenery/judgeText'
