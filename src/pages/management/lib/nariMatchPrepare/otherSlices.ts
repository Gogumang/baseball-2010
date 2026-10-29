/**
 * 142 경기정보가 쓰는 **다른 조각** — 경기정보 줄 꼴 · 빈 값(`pages/general-mode`) · 시즌 0xdd 의 다섯 줄 셈(`pages/season`).
 * 조각 경계를 넘는 import 를 이 파일 한 곳에 모은다(`lint.boundaries-baseline.js` 의 예외는 이 파일 하나).
 */
export { EMPTY_VALUE, type MatchInfoLine } from '@/pages/general-mode/lib/matchInfoLines'
export { seasonMatchInfoLines } from '@/pages/season/lib/seasonMatchInfo'
