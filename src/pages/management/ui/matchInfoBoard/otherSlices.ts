/**
 * 경기정보 판(공용 목록 0x63b15 k 4)이 쓰는 **다른 조각** — 일반모드 경기정보(상태 22)의 배치 · 줄 꼴 · 판 꾸밈(`pages/general-mode`).
 * 조각 경계를 넘는 import 를 이 파일 한 곳에 모은다(`lint.boundaries-baseline.js` 의 예외는 이 파일 하나).
 */
export {
  MATCH_INFO_LAYOUT,
  MATCH_INFO_PLAY_BALL_PRESS_RECT,
  TAG,
  TEAM_LOGO_HALF,
  firstBatTagPlacementOf,
  isPrepareBobOn,
  matchInfoLogoPressRectOf,
  matchInfoRowY,
} from '@/pages/general-mode/lib/prepareLayout'
export type { MatchInfoLine } from '@/pages/general-mode/lib/matchInfoLines'
export * as prepareStyles from '@/pages/general-mode/ui/prepareScreen.css'
