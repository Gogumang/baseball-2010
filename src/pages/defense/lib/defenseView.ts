/**
 * 수비 화면이 받는 순수 데이터와 그림 고르기 (R3-field-view 2·7절 · R2-game-effects 2절).
 *
 * 스냅샷 모양(`DefenseViewState`)은 `entities/fielding/model/defenseView`, 동작 번호 표는 `shared/config/original/defenseAnimations` 에 있다.
 * 화면은 진행기가 낸 **한 틱치 스냅샷**만 받아 그림을 고른다.
 */
export {
  ACE_BATTER_DEFENDER_FRAMES,
  ACE_PITCHER_DEFENDER_FRAMES,
  BALL_FRAMES,
  DEADLY_EFFECT_FRAMES,
  DEFENDER_FRAMES,
  DEFENSE_BACKGROUND_HEIGHT,
  DEFENSE_BACKGROUND_URL,
  DEFENSE_BACKGROUND_WIDTH,
  FIELDER_ACTION_TICKS,
  FIELDER_FRAME_OFFSET,
  RUNNER_SLIDE_TICKS,
  TICKS_PER_ACTION_FRAME,
  fielderActionFrameOf,
  fielderFrameOf,
} from '@/pages/defense/lib/defenseView/fielderFrames'
export {
  cameraTargetOf,
  defenderPaletteIndexOf,
  fielderSpriteOf,
  flashOffsetOf,
  isBallDrawn,
  runnerFrameOf,
  runnerSpriteFolderOf,
} from '@/pages/defense/lib/defenseView/defenseSprites'
export { BALL_GROUND_FRAME, ballFrameOf, ballShadowOf } from '@/pages/defense/lib/defenseView/defenseBall'
export { BALL_SHADOW_RIM_COLOR } from '@/shared/lib/ballShadow/ballShadowPieces'
