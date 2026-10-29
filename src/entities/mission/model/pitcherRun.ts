/**
 * 투수편 미션 진행.
 *
 * 타자편과 제한 규칙은 같지만("제한 조건 내에서 목표 달성"),
 * 제한이 타석이 아니라 **투구 수**인 미션이 있다 — 원본 레코드의 투구 수 제한
 * ("10개의 공으로 2삼진을 잡아라!", "6개의 공으로 삼진을 잡아라!").
 *
 * 공개 이름 모음 — 하위 폴더 (`pitcherRun/`): `types`(판 · 결과 선택 · 모드 5) · `start` · `pitch`(공 하나 · MAX게이지) ·
 * `outcome/`(수비 진행 `missionPlay` · 허용 한도 0xaac76 · 결과 먹이기 0xa8024) · `judge/`(판 끝 판정 0xaaa6c 모드 5) ·
 * `auto/`(3아웃 뒤 자동진행 0x21 · 마타자 다시 끼우기 0xaae7c) · `otherSlices`(다른 조각 · 위 층 값)
 */
export { MISSION_PITCHER_MODE, type PitcherRun } from '@/entities/mission/model/pitcherRun/types'
export { inningGoalOf, OUTS_PER_INNING } from '@/entities/mission/model/missionGoal'
export { startPitcherMission } from '@/entities/mission/model/pitcherRun/start'
export { recordPitch } from '@/entities/mission/model/pitcherRun/pitch'
export { applyPitcherOutcome, withHalfEnd } from '@/entities/mission/model/pitcherRun/outcome/applyOutcome'
export { checkPitchExhausted, judgePitcherRun } from '@/entities/mission/model/pitcherRun/judge/judgeStatus'
export { pitcherMissionAutoTicks, runPitcherMissionAutoHalves } from '@/entities/mission/model/pitcherRun/auto/autoHalves'
