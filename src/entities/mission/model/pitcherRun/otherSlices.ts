/**
 * 투수편 미션 한 판이 쓰는 **다른 조각**(타석 결과 · 루 · 주자 신원)과 **위 층**(`features/defense-play` 수비 진행기 결과 · 주자 운명)의 값 —
 * 경계를 넘는 import 를 이 파일 한 곳에 모은다(`lint.boundaries-baseline.js` 의 층 방향 · cross-slice 예외는 이 파일 하나).
 *
 * 주자 운명을 위 층에서 꺼내는 까닭: 실점 R+0x128 · 출루 허용 R+0x130 은 정산 0xa8024 가 수비 판(상태 0x17)의 주자 목록으로 센다 —
 * 타자편 미션과 같은 진행기(`missionPlay`)의 결과를 그대로 읽는다.
 */
export { isHit, type AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
export { EMPTY_BASE_RUNNERS } from '@/entities/game/model/baseRunners'
export { EMPTY_BASES } from '@/entities/game/model/baseState'
export type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
export { baserunnerAllowedOfFates, chargedRunsOfFates, survivorsFromBaseOfFates, type RunnerFate } from '@/features/defense-play/model/runnerFates'
