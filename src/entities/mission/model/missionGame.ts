/**
 * **미션 경기** — 이닝 · 공수 · 점수판 · 자동진행 반 이닝(0x21 간이 타석 0xc262c).
 * 공개 이름 모음 — 하위 폴더 (`missionGame/`): `types`(경기 · 타선 · 자동진행 반 이닝 끝 — 머리글에 3아웃 · 0x18 · 0x21 흐름) ·
 * `start/`(사람 칸 · 다른 칸 팀 0xaa57c · 미션 타자 레코드 0xb87cc · 시작 타순 표) · `board/`(점수판 0xa5c34 · 경기 끝 0xb68fc ·
 * 반 이닝 넘김 0xb6b6c · 투지 갈래 0xb570c) · `auto/`(자동진행 반 이닝 · 중계 판) · `otherSlices`(다른 조각 값)
 */
export {
  MISSION_NARI_RECORD,
  MISSION_NARI_RECORD_FALLBACK,
  type MissionAutoHalf,
  type MissionGame,
  type MissionTeamBatting,
} from '@/entities/mission/model/missionGame/types'
export { humanRecordsOf, missionHumanRecordSlotOf } from '@/entities/mission/model/missionGame/start/humanRecords'
export { MISSION_HUMAN_START_ORDER } from '@/entities/mission/model/missionGame/start/startOrder'
export {
  cpuSideOf,
  humanSideOf,
  missionHumanTeamIdOf,
  missionTeamIdsOf,
  type MissionAceMatchOrigin,
} from '@/entities/mission/model/missionGame/start/sides'
export { startMissionGame, type MissionGameSetup } from '@/entities/mission/model/missionGame/start/startGame'
export {
  battingRecordAt,
  flipMissionHalf,
  isMissionGameOver,
  withMissionAutoRelay,
  withMissionScore,
} from '@/entities/mission/model/missionGame/board/board'
export { missionFightingSpiritOf } from '@/entities/mission/model/missionGame/board/fightingSpirit'
export { simulateMissionAutoHalf, simulateMissionAutoHalfTicks } from '@/entities/mission/model/missionGame/auto/autoHalf'
export { simulateHumanTeamAutoHalf, simulateHumanTeamAutoHalfTicks } from '@/entities/mission/model/missionGame/auto/humanTeamAutoHalf'
