import type { PitchResolution } from '@/entities/at-bat/model/atBatState'
import type { StagePhaseSnapshot } from '@/widgets/batting-stage/lib/softKeyLabels'
import { PITCHER_RELEASE_TICKS } from '@/widgets/batting-stage/lib/stageScenery'

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
 * 이 파일은 웹 투수 화면의 "던진 공 하나"를 장면 단계로 바꾼다. 웹 진행기는 공을 놓는 그 순간(0x11 틱 10, 0x4e060) 판정까지
 * 한 번에 내므로, 장면은 그 시각에서 거꾸로 0x11 진입을 잡아 투수 동작 · 공 비행 · 0x12 를 그림으로만 다시 돈다(굴림 없음).
 */

/** 0x4e060 `[+0x2c] > 9` — 사람 공은 0x11 의 틱 10 에 놓는다 (`PitchGradeGauge`) */
export const HUMAN_PITCH_RELEASE_STATE_TICK = 10

export interface PitcherSideStageClock {
  /** 지금 장면 틱 */
  readonly nowTick: number
  /** 마지막 공을 놓은 장면 틱 (0x11 틱 10). 이 화면에서 던진 공이 없으면 null */
  readonly releaseTick: number | null
  /** 그 공의 경로 점 수 N */
  readonly frameCount: number
  /** 0x12 대기 틱 (0x4e6d4 — 15, 타석이 끝났으면 31). 0 이면 0x12 를 안 지난다(맞은 공) */
  readonly resultTicks: number
  /** 0xd · 0xe 확인 대기 따위 — 쉬는 '대기' */
  readonly isPaused: boolean
  /** 쉬기 시작한 장면 틱 (쉬지 않으면 무시) */
  readonly pausedSinceTick: number
}

export interface PitcherSideStageFrame {
  readonly phase: StagePhaseSnapshot
  /** 공 경로 번호 F (0 = 릴리스). 공이 날지 않으면 −1 */
  readonly ballFrame: number
  /** 0x11 진입 뒤 틱 — 투수 단계 표가 본다. 투구 중이 아니면 null(대기 동작) */
  readonly pitcherTick: number | null
}

/**
 * 지금 그림의 장면 단계.
 * - 0x11: 공을 놓은 틱 − 10 에서 들어선다. 투수 단계가 릴리스(`PITCHER_RELEASE_TICKS`)에 닿은 틱부터 공 틱이 오르고(0x3f378),
 *   공 틱 N + 1 에서 0x12 로 간다(0x4e24e).
 * - 0x12: `resultTicks` 동안 — 공은 마지막 점(`heldBall`).
 * - 그 밖은 '대기'(0xd~0xf · 0x10 조준 — 장면은 대기 동작이다).
 * ⚠️ 근사: 웹 게이지는 rAF 가 아니라 setInterval 로 틱을 세므로 놓은 틱이 한 틱 안쪽으로 어긋날 수 있다.
 */
export function pitcherSideStageFrameOf(clock: PitcherSideStageClock): PitcherSideStageFrame {
  const idle: PitcherSideStageFrame = {
    phase: {
      kind: '대기',
      tick: clock.isPaused ? Math.max(0, clock.nowTick - clock.pausedSinceTick) : 0,
      isPaused: clock.isPaused,
    },
    ballFrame: -1,
    pitcherTick: null,
  }
  if (clock.releaseTick === null) return idle
  const stateTick = clock.nowTick - clock.releaseTick + HUMAN_PITCH_RELEASE_STATE_TICK
  if (stateTick < 0) return idle
  const ballFrame = stateTick - PITCHER_RELEASE_TICKS
  const flightEndFrame = clock.frameCount + 1
  if (ballFrame < flightEndFrame) {
    return { phase: { kind: '투구중', tick: stateTick, isPaused: false }, ballFrame, pitcherTick: stateTick }
  }
  const resultTick = ballFrame - flightEndFrame
  if (resultTick < clock.resultTicks) {
    return { phase: { kind: '결과', tick: resultTick, isPaused: false, isInPlay: false }, ballFrame: -1, pitcherTick: null }
  }
  return idle
}

/**
 * 0x12 를 지나는 판정인가 — 맞히지 못한 공(볼 · 스트라이크 · 헛스윙 · 사구)만. 맞은 공(파울 포함)은 0x13 → 0x17 로 간다.
 */
export function passesHeldResult(resolution: PitchResolution): boolean {
  return resolution.kind !== '타구' && resolution.kind !== '파울'
}

/**
 * 공을 놓은 틱(0x11 틱 10)부터 장면이 다시 '대기' 로 돌아올 때까지의 틱 — 남은 0x11(공 틱 N + 1 까지) + 0x12 대기.
 * 원본은 그동안 상태가 0x11 · 0x12 라 구질 키(0xf) · 견제 · '#' · 0xe 의 OK 를 받지 않는다 (키 갈래 0x53580 은 상태별 표).
 */
export function pitchSceneBusyTicksOf(frameCount: number, resultTicks: number): number {
  return PITCHER_RELEASE_TICKS - HUMAN_PITCH_RELEASE_STATE_TICK + frameCount + 1 + resultTicks
}
