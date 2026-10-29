/**
 * 미션 한 판이 쓰는 **다른 조각**(타석 결과 · 루 · 타구 궤적 · 간이 타순)과 **위 층**(`features/defense-play` 수비 진행기)의 값 —
 * 경계를 넘는 import 를 이 파일 한 곳에 모은다. 안쪽 파일은 이 이름들을 여기서만 꺼낸다(`lint.boundaries-baseline.js` 의
 * 층 방향 · cross-slice 예외는 이 파일 하나).
 *
 * 수비 진행기를 위 층에서 꺼내는 까닭: 미션도 사람이 치는 타석이라 원본은 간이 엔진(0xc11f0)이 아니라 수비 시뮬레이션
 * (0xae24c · 0xae3e8)을 돌린다 — 타자편 · 팀경기 · 투수편과 **같은 진행기**다(`missionPlay`).
 */
export type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
export { battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
export { contactOfOutcome } from '@/entities/batting/model/battedContact'
export type { BaseRunners } from '@/entities/game/model/baseRunners'
export { EMPTY_BASES, advanceRunners, type AdvanceResult, type BaseState } from '@/entities/game/model/baseState'
export { lineupSlotOf, recordLineupPlay } from '@/entities/game/model/quickLineup'
export { isBattedBallKind } from '@/features/defense-play/model/playOutcome'
export { fixturePatternFor } from '@/features/defense-play/model/representativePattern'
export { isBattedBallInPlay, runDefensePlay, type DefensePlayInput, type DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
export { runnerFatesWithoutPlay, survivorsFromBaseOfFates, type RunnerFate } from '@/features/defense-play/model/runnerFates'
