/**
 * **미션 한 판** — 시작(0xaa57c · 0xaae7c) · 타석 · 견제 · 도루 · 제한 시간 0xaada4 · 판정 0xaaa6c / 0xaa958 · 타자 미션 자동진행(0xc2198).
 * 공개 이름 모음 — 하위 폴더 (`missionRun/`): `types`(판 · 상태) · `start/`(시작 · 미션 타자 차례) · `play/`(수비 진행기 입력 ·
 * 타석 판 · 주자 옮기기) · `judge/`(남은 기회 0xaa958 · 스윙 · 경기 끝) · `clock/`(제한 시간) · `outcome/`(타석 · 도루 · 견제 결과) ·
 * `auto/`(3아웃 뒤 자동진행 반 이닝) · `otherSlices`(다른 조각 · 위 층 값)
 */
export type { MissionRun, MissionStatus } from '@/entities/mission/model/missionRun/types'
export { limitOrNull, missionStartFielderZeroOf, startMission } from '@/entities/mission/model/missionRun/start/startMission'
export { isMissionBatterUp, missionFirstHalfIsHuman } from '@/entities/mission/model/missionRun/start/batterUp'
export { MISSION_BATTER_MODE, isMissionPlayOutcome, missionDefensePlayInputOf } from '@/entities/mission/model/missionRun/play/defensePlayInput'
export { missionAdvance, missionPlay } from '@/entities/mission/model/missionRun/play/missionPlay'
export { checkSwingsExhausted, giveUp, recordSwing } from '@/entities/mission/model/missionRun/judge/swings'
export { missionClockStep, tick } from '@/entities/mission/model/missionRun/clock/missionClock'
export { applyOutcome } from '@/entities/mission/model/missionRun/outcome/applyOutcome'
export { applySteal, canSteal } from '@/entities/mission/model/missionRun/outcome/steal'
export { applyPickoff } from '@/entities/mission/model/missionRun/outcome/pickoff'
export { batterMissionAutoTicks, runBatterMissionAutoHalves } from '@/entities/mission/model/missionRun/auto/batterAutoHalves'
