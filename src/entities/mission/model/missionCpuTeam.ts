/**
 * **미션 상대 CPU 팀** — 미션 경기 준비 `0xaa57c`(모드 5·6)가 세운 다른 칸 팀과, 그 팀의 CPU 교체가 보는 칸들.
 * 공개 이름 모음 — 하위 폴더 (`missionCpuTeam/`): `types`(팀 · 투수진 · 타선 · 마투수 · 교체) · `start/`(시작 칸 표 · 0xaa57c · 0xaae7c ·
 * 0x66864) · `roster/`(레코드 칸 · 마스터 줄 능력치 0xb6415) · `defense/`(0xac428 재료) · `play/`(공 · 득점 · 타석 정산 · 0xf 진입 0x3d954) ·
 * `otherSlices`(다른 조각 값)
 *
 * 원본 미션도 보통 경기 장면(0x104)이라 상태 0xf 진입 `0x3d954` 가 **공마다** CPU 교체를 묻는다 (직접 재역어셈 3d9ca~3da94):
 * ```
 * 3d9cc  r4 = 0x66864()
 * 3d9e4  수비 팀이 CPU(state[0x31 + state[0xa]] == 1)
 *          돌발 진행 중(0x8eb94) 또는 r4 == 0 → 건너뜀
 *          그 밖 → 0xac428([장면+0x21c], 수비 팀 [장면+0x224], 주자관리 [장면+0x20c], state, R, 0, 0, 0)   ; 3da3e
 *        아니면(수비가 사람)
 *          돌발 진행 중 → 건너뜀
 *          그 밖 → 0xac228([장면+0x21c], 공격 팀 [장면+0x220], 주자관리, state)                       ; 3da70
 * 3da74  참이면 22 "Time!"(3da88) · 0x16 예약(3da94) → 0xd(이전 0x16 이라 지우기 건너뜀, 48e94) → 0xe → 0xf 재진입
 * 66864  모드 5·6 이 아니면 1 · 모드 6 이면 미션 객체 +0xbd ∈ {3, 7} 일 때 0 · 모드 5 면 수비가 사람일 때 0
 * ```
 * 부르는 함수는 **다른 모드와 같다** — 0xac428 은 나리 타자편(`features/play-game` `changeOpponentPitcher`)과 같은 3da3e 자리,
 * 0xac228 은 나리 투수편(`features/play-pitcher-game` `enterPitchSelection`)과 같은 3da70 자리다. 그래서 판정은 공용 부품
 * (`changePitcherIfNeeded` · `tryQuickCpuPinchHit`)을 그대로 쓴다. 미션이 다른 것은 **팀과 그 칸**뿐이다:
 * - 모드 6(타자 미션) — 수비가 CPU 라 0xac428 투수 교체. 모드 5(투수 미션) — 수비가 사람이라 0xac228 대타(가림막 안 봄).
 * - 미션 객체 +0xbd = 고른 레코드 번호 = `id − 1` (보통 미션은 목록 칸, 마선수 대결은 SYS 8 이 team − 1 로 적는다 — 0xa5268 이
 *   ≤ 13 이면 그 줄, ≥ 15 면 한 줄 앞). 0x66864 가 막는 것은 **타자 4(레오니) · 8(발렌타인)** 둘뿐이다.
 *
 * 팀(직접 재역어셈 0xaa57c · 0xb8680 · 0x1ff98 · 0xaae7c):
 * - aa72a~aa76c `0xb891c(팀객체[칸], 모드, 팀, −1)` — 다른 칸 팀 = 레코드 +2 아래 4비트(`sideTeams[1 − humanSide]`).
 *   명부 0xb8680 은 모드 5·6 이면(b86e2) 마선수 대결이고 원래 모드가 시즌이 아닐 때 말고는 **마스터 팀**
 *   `0x1f8c0(저장, 팀)` = Xls 줄 그대로(0x1ff98 이 팀마다 투수 8 · 타자 12 줄을 통째 복사, 투수 +0x2c 는 모두 10000).
 *   마스터 팀은 미션 끝 정산 0x4ea0c(모드 5·6 갈래 4ef18) · 다시하기 · 나가기가 `0x20094(앱, 5)` → 0x1ff98 로 다시 싣는다
 *   → 미션마다 새 줄에서 선다(아래 맞바꾸기가 다음 미션으로 이어지지 않는다).
 * - aa87c~aa8ac 다른 칸 팀+0x32(타순) = 레코드 +7 아래 4비트 · `0xb8c94(다른 칸, 0, 레코드 +6 아래 4비트)` = 명부 투수
 *   0번 ↔ 그 칸 맞바꾸기 → 그 투수가 선발이다.
 * - 마선수 미션(레코드 +8 윗 4비트 > 0)은 0xd 메시지 0xaae7c(aafca~)가 마선수를 끼운다 — 모드 6 이면 마투수를 명부 투수
 *   8번(0xb521c, 옛 8번은 끝)에 베끼고 0 ↔ 8 맞바꿈, 모드 5 면 마타자를 명부 타자 9번(0xb53f0)에 베끼고 지금 타순 ↔ 9 맞바꿈.
 *   팀 객체의 투수 수 +0x26 · 벤치 +0x33 · +0x28c 는 0xb891c 때 값 그대로다(0xaae7c 는 안 고친다).
 */
export {
  MISSION_ACE_ROSTER_SLOT,
  type MissionAcePitcher,
  type MissionCpuBatting,
  type MissionCpuPitching,
  type MissionCpuTeam,
} from '@/entities/mission/model/missionCpuTeam/types'
export { MISSION_CPU_START } from '@/entities/mission/model/missionCpuTeam/start/cpuStart'
export { isMissionPitcherChangeBlocked } from '@/entities/mission/model/missionCpuTeam/start/missionSlot'
export { insertMissionAceBatter, startMissionCpuPitching, startMissionCpuTeam } from '@/entities/mission/model/missionCpuTeam/start/startTeam'
export {
  isMissionCpuBatterAce,
  isMissionCpuMoundAce,
  missionRecordNibbleRowOf,
  withMissionCpuSpecialSwing,
} from '@/entities/mission/model/missionCpuTeam/roster/records'
export {
  masterBatterAbilityOf,
  masterGameAbilityOf,
  missionAcePitcherOf,
  missionCpuBatterAbilityOf,
  missionCpuBatterOf,
  missionCpuMoundPitcherAbilityOf,
  missionCpuMoundPitcherEquipmentOf,
  missionCpuMoundPitcherSkinIndexOf,
} from '@/entities/mission/model/missionCpuTeam/roster/abilities'
export { missionPitchingDefenseOf } from '@/entities/mission/model/missionCpuTeam/defense/pitchingDefense'
export {
  missionCpuAfterBenchClearing,
  missionCpuAfterPitch,
  missionCpuAfterPlateAppearance,
  missionCpuAfterRuns,
  missionCpuAtNewPlateAppearance,
} from '@/entities/mission/model/missionCpuTeam/play/afterPlay'
export { enterMissionPitchSelection } from '@/entities/mission/model/missionCpuTeam/play/pitchSelection'
