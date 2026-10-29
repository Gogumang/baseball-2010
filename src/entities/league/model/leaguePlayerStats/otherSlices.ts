/**
 * 리그 선수 기록표가 쓰는 **다른 조각**(타석 결과 · 팀 명단 크기)의 값 — 조각 경계를 넘는 import 를 이 파일 한 곳에 모은다
 * (`lint.boundaries-baseline.js` 의 cross-slice 예외는 이 파일 하나).
 */
export { countsAsAtBat, isHit, type AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
export { BATTERS_PER_TEAM, PITCHERS_PER_TEAM } from '@/entities/team/model/teamRoster'
