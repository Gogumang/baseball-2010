import type { PitchResolution } from '@/entities/at-bat/model/atBatState'
import { SCENE_STATE, type SceneStateEntry } from '@/shared/lib/commonWindow/sceneStateEntries'
import { hitEndTickOf } from '@/widgets/batting-stage/lib/pitcherSideStage/hitTicks'
import { HUMAN_PITCH_RELEASE_STATE_TICK, type PitcherHitClock } from '@/widgets/batting-stage/lib/pitcherSideStage/stageClock'
import { pitcherReleaseTicksOf } from '@/widgets/batting-stage/lib/stageScenery'

/** 0x4e6e2 — 타석을 안 끝낸 공의 0x12 문턱 */
const NOT_AT_BAT_END_RESULT_THRESHOLD = 0xf

/**
 * 공 하나의 원본 상태 경계(장면 틱) — `pitcherSideStageFrameOf` 와 같은 셈이다.
 * 0x11 은 놓은 틱 − 10 이 틱 0, 0x12 는 0x11 의 상태 틱 `pitcherReleaseTicksOf + N + 2` 가 틱 0(공 틱 N + 1 의 갱신이 예약한 다음 틀),
 * 0x12 문턱 갱신(0x4e6d4)이 예약한 다음 상태는 `resultTicks + 1` 틀 뒤에 선다 — 타석을 끝낸 공(문턱 0x1f)이면 0xd, 아니면 0xf.
 * 맞은 공(`resultTicks` 0)은 이 장면이 0x13 을 따로 세우지 않아 0x11 만 적는다.
 */
export function pitcherSideStateEntriesOf(
  releaseTick: number,
  frameCount: number,
  resultTicks: number,
  aceOrder?: number | null,
  /** 맞은 공이면 0x13 · 0x17 경계도 적는다 (`PitcherSideStageClock.hit`) */
  hit?: PitcherHitClock | null,
): SceneStateEntry[] {
  const flightEntry = releaseTick - HUMAN_PITCH_RELEASE_STATE_TICK
  const entries: SceneStateEntry[] = [{ tick: flightEntry, state: SCENE_STATE.투구 }]
  if (hit !== undefined && hit !== null) {
    // 판정 틀 J 의 메시지 0x6aa(0x51408)가 0x13 을 예약 — 다음 틀이 0x13 틱 0. 0x13 틱 `hitEndTickOf` 의 갱신 0x406e8 이 0x17 을 예약
    const hitEntry = flightEntry + pitcherReleaseTicksOf(aceOrder) + hit.judgeBallTick + 1
    entries.push({ tick: hitEntry, state: SCENE_STATE.타격 }, { tick: hitEntry + hitEndTickOf(hit) + 1, state: SCENE_STATE.인플레이 })
    return entries
  }
  if (resultTicks <= 0) return entries
  const resultEntry = flightEntry + pitcherReleaseTicksOf(aceOrder) + frameCount + 2
  entries.push(
    { tick: resultEntry, state: SCENE_STATE.결과 },
    { tick: resultEntry + resultTicks + 1, state: resultTicks > NOT_AT_BAT_END_RESULT_THRESHOLD ? SCENE_STATE.준비 : SCENE_STATE.선택 },
  )
  return entries
}

/**
 * 공을 놓은 틱(0x11 틱 10)에서 0x12 틱 0 까지 — 0x11 의 상태 틱 `pitcherReleaseTicksOf + N + 2` 가 0x12 틱 0 이다
 * (`pitcherSideStageFrameOf` 와 같은 셈). 0x12 진입 틀의 그리기(0x4ce9c — 삼진 진동 4d0ba)가 이 틱에 돈다.
 */
export function pitchResultEntryDelayTicksOf(frameCount: number, aceOrder?: number | null): number {
  return pitcherReleaseTicksOf(aceOrder) - HUMAN_PITCH_RELEASE_STATE_TICK + frameCount + 2
}

/**
 * 공을 놓은 틱에서 같은 타석 다음 공의 0xf 진입 틱까지 — 0x12 틱 0(`pitchResultEntryDelayTicksOf`)에서 문턱 갱신(상태 틱 `resultTicks`,
 * 0x4e6d4)이 0xf 를 예약하고 다음 틀이 진입 0x3d954 다(`pitcherSideStateEntriesOf` 의 `resultEntry + resultTicks + 1`)
 */
export function pitchSelectionEntryDelayTicksOf(frameCount: number, resultTicks: number, aceOrder?: number | null): number {
  return pitchResultEntryDelayTicksOf(frameCount, aceOrder) + resultTicks + 1
}

/**
 * 0x12 를 지나는 판정인가 — 맞히지 못한 공(볼 · 스트라이크 · 헛스윙 · 사구)만. 맞은 공(파울 포함)은 0x13 → 0x17 로 간다.
 */
export function passesHeldResult(resolution: PitchResolution): boolean {
  return resolution.kind !== '타구' && resolution.kind !== '파울'
}

/**
 * 공을 놓은 틱(0x11 틱 10)부터 장면이 다시 '대기' 로 돌아올 때까지의 틱 — 남은 0x11(공 틱 N + 1 — 0x12 를 예약한 틀 — 까지) + 0x12
 * (문턱 + 1 그림 — 정정: 예전엔 문턱 그림만 세어 0x12 의 마지막 틀(문턱 틱, 4e72c 가 다음 상태를 예약한 틀)을 빠뜨렸다).
 * 원본은 그동안 상태가 0x11 · 0x12 라 구질 키(0xf) · 견제 · '#' · 0xe 의 OK 를 받지 않는다 (키 갈래 0x53580 은 상태별 표).
 */
export function pitchSceneBusyTicksOf(frameCount: number, resultTicks: number, aceOrder?: number | null): number {
  return pitcherReleaseTicksOf(aceOrder) - HUMAN_PITCH_RELEASE_STATE_TICK + frameCount + (resultTicks > 0 ? 2 + resultTicks + 1 : 1)
}

/**
 * CPU 타자가 스윙을 거는 장면 틱 — 0x11 갱신 0x4e0dc: 공 틱 [+0x1098] ≥ 스윙 프레임 F(+0xfd8) 인 틱에 스윙 객체의
 * vtable +0x14 · +0x18 을 부른다. 공 틱은 놓은 틱(상태 틱 10)에서 `pitcherReleaseTicksOf(순번) − 10` 지난 뒤 0 이다
 * (`pitcherSideStageFrameOf` 와 같은 셈). 한 틱 안의 차례(r178 직접 떴다): 공 틱 [+0x1098] 을 올리는 곳은 틀 끝 0x3f378 의
3f450~3f454(53086 — 갱신 · 그리기 뒤) 하나뿐이고 0x11 진입 3de82 가 0 으로 둔다 — 그래서 같은 틀의 갱신 0x4e0d0(스윙 검사)과 그리기가
같은 공 틱을 본다. 공 경로 F 를 그리는 틱이 곧 스윙을 거는 틱이다.

 */
export function cpuSwingTickOf(releaseTick: number, swingFrame: number, aceOrder?: number | null): number {
  return releaseTick - HUMAN_PITCH_RELEASE_STATE_TICK + pitcherReleaseTicksOf(aceOrder) + Math.max(0, swingFrame)
}
