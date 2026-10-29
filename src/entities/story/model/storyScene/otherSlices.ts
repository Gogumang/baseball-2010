/**
 * 이벤트 일정 판정이 쓰는 **다른 조각**(나리 타자편 커리어 · 타순의 빈 장소 번호)의 값 — 조각 경계를 넘는 import 를 이 파일 한 곳에
 * 모은다(`lint.boundaries-baseline.js` 의 cross-slice 예외는 이 파일 하나).
 */
export type { PlayerCareer, SeasonEndState } from '@/entities/career/model/playerCareer'
export { GAMES_PER_SEASON } from '@/entities/career/model/playerCareer'
export { isEmptyPlaceEventId } from '@/entities/career/model/battingOrder'
