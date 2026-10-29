/**
 * 원본에서 뽑은 PNG를 캔버스에 쓰기 위해 불러오고 캐시한다.
 * 아직 안 불러온 그림은 null을 돌려주고, 도착하면 다음 프레임부터 그려진다 —
 * 로딩 때문에 게임 루프가 멈추면 안 된다. 장면 앞에서 미리 받아 두면(`spritePreload`) 첫 프레임부터 있다.
 *
 * - 그림 · 원점 · 애니 표 · 팔레트 JSON(`spriteJson`) · 폴더 주소(`spriteFolders`)
 * - 대체 팔레트로 칠한 그림(`recoloredSprite`) · 칠하기 미리 걸기(`warmRecolor`) · 프레임 놓기 · 겹 그리기(`placedFrame`)
 */

export {
  JUDGE_FRAMES,
  GAME_EFFECT_IMAGE,
  GAME_EFFECT_FRAMES,
  PITCHER_FRAMES,
  CLOUD_FRAMES,
  SKY_LIGHT_FRAMES,
  FENCE_FRAMES,
  CROWD_FRAMES,
  SCOREBOARD_FRAMES,
  TEAM_ICON,
  FENCE_SEASON_FRAMES,
  HIDDEN_FENCE_FRAMES,
  FENCE_BOARD_FRAMES,
  HIDDEN_BOARD_FRAMES,
} from '@/widgets/batting-stage/lib/spriteLoader/spriteFolders'
export { sprite, frameAnimations } from '@/widgets/batting-stage/lib/spriteLoader/spriteJson'
export type { PlacedFrame, StageAnimationEntry } from '@/widgets/batting-stage/lib/spriteLoader/spriteJson'
export { fieldBackground, warmFieldBackground } from '@/widgets/batting-stage/lib/spriteLoader/recoloredSprite'
export { warmRecoloredFrame, warmRecoloredFrames, resetWarmedRecolorsForTest } from '@/widgets/batting-stage/lib/spriteLoader/warmRecolor'
export type { RecolorFrame } from '@/widgets/batting-stage/lib/spriteLoader/warmRecolor'
export { placedFrame, drawFrameAt } from '@/widgets/batting-stage/lib/spriteLoader/placedFrame'
