/**
 * 시즌 경기정보 0xdd 가 쓰는 **다른 조각** — 들어올 때 연출 · 배너와 경기정보 판(공용 목록 0x63b15 k 4 — 나리 142 와 같은 그림,
 * `pages/management`). 조각 경계를 넘는 import 를 이 파일 한 곳에 모은다(`lint.boundaries-baseline.js` 의 예외는 이 파일 하나).
 */
export { useMatchInfoEntry } from '@/pages/management/ui/useMatchInfoEntry'
export { MatchInfoPhase } from '@/pages/management/ui/matchInfoBoard/MatchInfoBody'
export { MatchInfoPressAreas } from '@/pages/management/ui/matchInfoBoard/MatchInfoPressAreas'
export { IMG_TEXT_FRAME, SLT_FRAME, pressKey, runMatchInfoKey } from '@/pages/management/ui/matchInfoBoard/matchInfoAssets'
export { isPrepareBobOn, type MatchInfoLine } from '@/pages/management/ui/matchInfoBoard/otherSlices'
