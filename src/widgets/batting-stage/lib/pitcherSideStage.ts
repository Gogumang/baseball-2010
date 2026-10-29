/**
 * **사람이 던지는 타석의 장면** — 투수편(모드 3) · 투수 미션(모드 5) · 팀 경기 수비 반 이닝.
 *
 * 원본은 누가 던지든 같은 경기 장면 프레임 0x52c50 이 같은 그리기 표 0xd05a0 을 부른다(R10 2절 — 표에 모드 갈래가 없다).
 * 상태 그리기 머리가 모두 같은 장면 부품을 같은 차례로 부른다 (2026-10-09 직접 뜸):
 * ```
 * 0xd  0x4db2c   0x38d1c(투수) · 0x49e64(타자) · 0x35b94(주자) · 0x42f2c · 0x4c4bc(HUD)
 * 0xe  0x4d9ec   0x38d1c · 0x49e64 · 0x35b94 · 0x42f2c · 0x4c4bc · 0x44944(소개 판)
 * 0xf  0x4d9b0   0x38d1c · 0x35b94 · 0x49e64 · 0x42f2c · 0x4c4bc            ; 구질 목록은 그 위
 * 0x10 0x4d780   0x38d1c · 0x35b94 · 0x49e64 · 0x33fe4 …                      ; 조준 그림은 그 위
 * 0x11 0x4d2ac   0x38d1c · 0x42f2c · 0x35b94 · 0x49e64 …                      ; 게이지 0x4d3f8 은 그 위
 * 0x12 0x4ce9c   0x38d1c · 0x35b94 · 0x49e64 · 0x3b2f4(공)
 * ```
 * 그 앞에 상태가 7·8·9 가 아니면 공용 0x41230(배경)을 그린다. 곧 투수편 화면도 타자편 타석과 **같은 캔버스 장면**이고,
 * 구질 고르기 · 조준 · 게이지는 그 장면 위에 얹힌 UI 다. 마운드 투수는 장면 셋업 0x108f8 이 모드 ≠ 4 면 세우는
 * 투수 그림 객체(0x79368)라 장비 겹(0x79790)을 입는다 (`batterLayers.pitcherEquipmentOf`).
 *
 * - 장면 시계 꼴(`stageClock`) · 지금 그림의 단계(`stageFrame`) · 상태 경계와 지연(`stateEntries`)
 * - 맞은 공의 0x13 길이(`hitTicks`) · 0x11 끝 · 0x13 재료(`hitScene`) · 판정 틀의 타격점 그림 · 파티클(`hitContact`)
 *
 * 이 파일은 웹 투수 화면의 "던진 공 하나"를 장면 단계로 바꾼다. 웹 진행기는 공을 놓는 그 순간(0x11 틱 10, 0x4e060) 판정까지
 * 한 번에 내므로, 장면은 그 시각에서 거꾸로 0x11 진입을 잡아 투수 동작 · 공 비행 · 0x12 를 그림으로만 다시 돈다(굴림 없음).
 */

export { HUMAN_PITCH_RELEASE_STATE_TICK } from '@/widgets/batting-stage/lib/pitcherSideStage/stageClock'
export type { PitcherHitClock, PitcherSideStageFrame } from '@/widgets/batting-stage/lib/pitcherSideStage/stageClock'
export { pitcherSideStageFrameOf } from '@/widgets/batting-stage/lib/pitcherSideStage/stageFrame'
export {
  pitcherSideStateEntriesOf,
  pitchResultEntryDelayTicksOf,
  pitchSelectionEntryDelayTicksOf,
  passesHeldResult,
  pitchSceneBusyTicksOf,
  cpuSwingTickOf,
} from '@/widgets/batting-stage/lib/pitcherSideStage/stateEntries'
export { hitEndTickOf, pitchHitSceneTicksOf } from '@/widgets/batting-stage/lib/pitcherSideStage/hitTicks'
export { pitcherHitSceneOf } from '@/widgets/batting-stage/lib/pitcherSideStage/hitScene'
export type { PitcherHitScene } from '@/widgets/batting-stage/lib/pitcherSideStage/hitScene'
export { pitcherHitContactOf } from '@/widgets/batting-stage/lib/pitcherSideStage/hitContact'
