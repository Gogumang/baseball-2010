import { playSoundIds, type SoundPort } from '@/shared/api/audio/soundPort'
import {
  appTickOfGameSceneTick,
  clearGameSceneTimeout,
  gameSceneTickNow,
  isGameSceneFrozen,
  setGameSceneTickTimeout,
} from '@/shared/lib/commonWindow/commonWindow'
import { runBeforeSceneParticleTick } from '@/entities/particle/model/sceneParticleManager'

/**
 * **경기 장면 틱 `ticks` 뒤 틀 머리에 소리를 낸다** — 0 이하면 지금 낸다. 원본 경기 장면은 소리를 그 소리를 부른 상태 전이의 틀에서
 * 낸다(틀 차례 52cd4 적용 → 진입 → 키 → 갱신 → 그리기). 웹 진행기는 한 걸음에 여러 틀 몫의 판정을 미리 내므로, 뒤 틀의 소리는
 * 그 틀까지 장면 틱으로 미뤄 낸다(`setGameSceneTickTimeout` — 공용 창이 서 있으면 함께 선다, 52cc6).
 *
 * 소리 통로는 하나다(`shared/api/audio/soundPort` 머리말) — 같은 틀의 소리는 원본처럼 뒤 소리가 앞 소리를 끊고, 다른 틀의 소리는
 * 그 사이만큼 들린다.
 */
export function playSoundIdsAfterSceneTicks(
  sound: SoundPort,
  ids: readonly (number | null | undefined)[],
  ticks: number,
): void {
  const live = ids.filter((id): id is number => id !== null && id !== undefined)
  if (live.length === 0) return
  if (ticks <= 0) {
    playSoundIds(sound, live)
    return
  }
  setGameSceneTickTimeout(() => playSoundIds(sound, live), ticks)
}

/**
 * **사람이 던진 공 한 걸음의 소리 때** — 웹 진행기는 공을 놓는 틀(0x11 틱 10)에 판정까지 다 내지만 원본은 틀이 셋이다.
 * - 놓는 틀: 투구 순간 소리 12 / 28 (0x3f378) — `releaseSoundId`
 * - 0x12 진입 틀(놓은 틀에서 `pitchResultEntryDelayTicksOf` 뒤): 0x3dfac 가 판정 0x9d57c 를 메시지 0xbba 로 곧바로 보내(3e1e2~3e1e8 →
 *   0xbfbac) 화면 0x51a56 이 심판 콜(표 0xd0488)을 낸다. 볼넷 뒤 함성 29 · 공 도착 판 콜 · 돌발 소리도 이 걸음의 소리라 이 틀에 둔다
 *   — `resultEntryTicks`
 * - 같은 타석 다음 공의 0xf 진입 틀(0x12 문턱 갱신 0x4e6d4 가 예약한 다음 틀 — 0x12 틱 0 에서 문턱 + 1 뒤): 0x3d954 의 CPU 교체
 *   "Time!" 22(3da88) — `pitchSelectionTicks`
 */
export interface PitchStepSoundTiming {
  /** 지금 틀(걸음을 낸 틀)에 낼 소리 — 사람이 던진 공이면 투구 순간 소리, 타석 공이면 타구음(타석 화면이 이미 냈으면 null) */
  readonly releaseSoundId: number | null
  readonly resultEntryTicks: number
  readonly pitchSelectionTicks: number
}

/**
 * **0x12 진입 틀에 부르는 걸음의 소리 때** — 놓는 걸음이 공 도착 0x3dfac 을 그 틀까지 붙들면(`pendingPitchArrival` 따위) 걸음의 소리
 * (`resultEntryTicks`)는 이제 그 틀(지금)이고, 0xf 진입의 교체 소리는 거기서 남은 틱 뒤다. 놓는 틀의 소리는 이미 났다
 */
export function resultEntryStepTimingOf(release: PitchStepSoundTiming): PitchStepSoundTiming {
  return {
    releaseSoundId: null,
    resultEntryTicks: 0,
    pitchSelectionTicks: Math.max(0, release.pitchSelectionTicks - release.resultEntryTicks),
  }
}

/**
 * **장면 틱 `ticks` 뒤 틀의 갱신** — 그 틀 머리(장면 틱 시계)에 `update` 를 부르되, 그 틀의 관리자 틱 0x6de85 가 먼저 그 틀을 잡으려
 * 하면 그 앞에서 부른다(`runBeforeSceneParticleTick`) — 원본 틀 차례 갱신(52e14) → 관리자 틱(53048)을 두 시계 울림 차례와 무관하게 고정한다.
 * 사람이 던진 공의 0x12 진입 0x3dfac(공 도착 — `enterPitchResult` 따위)이 쓴다: 공이 나는 틀들의 관리자 틱 굴림은 그 앞, 진입 틀의 것은
 * 그 뒤다. 공용 창이 서 있으면 함께 선다. 돌려준 함수로 거둔다(이미 돌았으면 아무 일 없다).
 */
export function scheduleSceneFrameUpdate(update: () => void, ticks: number): () => void {
  const dueTick = gameSceneTickNow() + Math.max(0, ticks)
  let isDone = false
  let timer: number | null = null
  let removeHook: () => void = () => {}
  const cancel = () => {
    isDone = true
    clearGameSceneTimeout(timer)
    removeHook()
  }
  const run = () => {
    if (isDone) return
    cancel()
    update()
  }
  removeHook = runBeforeSceneParticleTick(
    (appTick) => !isGameSceneFrozen() && appTick >= appTickOfGameSceneTick(dueTick),
    run,
  )
  timer = setGameSceneTickTimeout(run, ticks)
  return cancel
}

/**
 * **사람 타석의 0x12 진입 틀까지** — 타석 화면은 못 맞힌 공의 결과를 0x12 를 예약한 틀(공 끝 0x4e24e → 0xbcb49)에 넘기고
 * (`BattingStage.showResult`), 0x12 는 다음 틀 머리 0xbc9c8 이 세워 진입 0x3dfac 가 그 틀에 심판 콜을 낸다 — 한 틀 뒤다
 */
export const BATTER_PITCH_RESULT_ENTRY_TICKS = 1
