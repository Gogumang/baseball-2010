import { useRef } from 'react'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { HitByPitchHoldPhase } from '@/features/play-game/model/benchClearingScene'
import { claimSceneParticleTick, sceneParticleScene } from '@/entities/particle/model/sceneParticleManager'
import { tickParticles } from '@/entities/particle/model/particleScene'
import { appTickOfGameSceneTick, gameSceneTickNow } from '@/shared/lib/commonWindow/commonWindow'
import { useSceneTick } from '@/widgets/game-scene/model/useSceneTick'

/**
 * **볼넷 · 사구의 0x12 대기 → 판정 → 벤치 클리어링 진입** (A-22, `features/play-game/model/benchClearingScene` 머리말).
 * 볼넷도 같은 틀(틱 31 갱신 0x4e6d4 의 4e78c 판정 A 0xae24c)에서 밀어내기 판 · 정산으로 가므로 진행기가 같은 칸에 붙든다 — 볼넷은
 * 판정에서 벤치 클리어링 굴림 없이 보통 길로 끝나 `'entry'` 에 닿지 않는다(r295, `holdsUntilResultWaitEnd`).
 *
 * 원본은 공 도착 틀 T 에 0x12 를 예약하고, 0x12 그림 32 장(상태 틱 0~31)을 그린 뒤 틱 31 갱신 0x4e6d4 가 4e74c 에서 벤치 클리어링을
 * 굴린다(들어가지 않으면 같은 갱신의 판정 A 0xae24c 가 진루 · 정산). 그 틀 끝에 관리자 틱 0x6de85(입자, 경기 난수)가 돌고, 들어갔으면
 * 다음 틀에 진입 0x3a5f0 이 굴림 45 번을 낸다. 웹 진행기는 공 도착 걸음에 사구를 붙들기만 하므로(단계 `'wait'`) 화면이 이 대기를
 * 장면 틱으로 세어 `onJudge`(판정) · `onEnter`(진입)를 한 틀씩 부른다. 그동안 타석 · 투구 화면은 0x12 를 그대로 그린다.
 *
 * 틱 셈은 공 끝 칸 채우기(`useBatterPitchEnd`)와 같다 — 붙든 칸이 처음 보인 그림부터 장면 틱마다 1, `waitTicks` 번째 틱 콜백이
 * 0x12 틱 31 의 갱신 자리다(타석 화면은 판정 틀 T 다음 그림이 0x12 틱 0 이라 `waitTicks` = 0x1f, 투구 화면은 놓은 틱에서 0x12 틱 0
 * 까지를 더한다 — `pitchResultEntryDelayTicksOf` − 1 + 0x1f). 이 콜백은 앞 틀(0x12 틱 30)을 끝내는 자리라, 그 틀의 관리자 틱이
 * 아직 안 돌았으면(타석 장면의 그림 시계 requestAnimationFrame 이 아직 안 울렸으면) 먼저 돌린 뒤 판정한다 — 원본 차례
 * "틱 30 의 관리자 틱 → 틱 31 갱신의 판정"을 시계 울림 차례와 무관하게 고정한다(`claimSceneParticleTick` 표지로 앱 틀당 한 번, r284 의
 * 벤치 클리어링 `holdSceneParticleTicks` 와 같은 생각). 진입도 같은 식으로 다음 콜백에서 판정 틀의 관리자 틱 뒤에 돈다.
 *
 * 팝업(0x52cc6)이 0x12 틱을 세우면(`isFrozen`) 함께 선다 — 공용 창은 장면 틱 시계가 스스로 선다(`useSceneTick`).
 */
export function useHitByPitchWait({
  hold,
  waitTicks,
  isFrozen,
  random,
  onJudge,
  onEnter,
}: {
  /** 붙든 볼넷 · 사구 (`pendingBenchClearing`) — 없으면 null. 단계가 `'scene'` 이면 연출이 맡는다 */
  readonly hold: { readonly phase: HitByPitchHoldPhase } | null
  /** 붙든 칸이 처음 보인 그림에서 0x12 틱 31 갱신까지의 장면 틱 수 */
  readonly waitTicks: number
  /** 팝업이 떠 있다 — 0x12 상태 틱이 멈춘다 */
  readonly isFrozen: boolean
  /** 경기 난수 — 판정 · 진입 앞 틀의 관리자 틱을 대신 돌릴 때 */
  readonly random: RandomPort
  /** 0x12 틱 31 갱신 — 4e74c 판정(진행기 `judgeHitByPitch`) */
  readonly onJudge: () => void
  /** 판정이 0x1e 를 예약한 다음 틀 — 진입 0x3a5f0(진행기 `enterBenchClearing`) */
  readonly onEnter: () => void
}): void {
  /** 지금 세는 대기 칸과 지난 틱 수 */
  const waitingRef = useRef<{ readonly hold: object; elapsed: number } | null>(null)
  if (hold !== null && hold.phase === 'wait' && waitingRef.current?.hold !== hold) {
    waitingRef.current = { hold, elapsed: 0 }
  }
  const holdRef = useRef(hold)
  holdRef.current = hold
  const latestRef = useRef({ waitTicks, random, onJudge, onEnter })
  latestRef.current = { waitTicks, random, onJudge, onEnter }

  useSceneTick(() => {
    const current = holdRef.current
    if (current === null) return
    const latest = latestRef.current
    if (current.phase === 'wait') {
      const waiting = waitingRef.current
      if (waiting === null || waiting.hold !== current) return
      waiting.elapsed += 1
      if (waiting.elapsed < latest.waitTicks) return
      waitingRef.current = null
      finishFrameParticles(latest.random)
      latest.onJudge()
      return
    }
    if (current.phase === 'entry') {
      finishFrameParticles(latest.random)
      latest.onEnter()
    }
  }, hold !== null && hold.phase !== 'scene' && !isFrozen)
}

/**
 * 앞 틀의 프레임 끝 관리자 틱 0x6de85 — 장면 부품(타석 장면 · 앱 층)이 이 앱 틀을 아직 안 굴렸으면 여기서 굴린다(앱 틀당 한 번).
 * 이미터가 없으면 굴림이 없다.
 */
function finishFrameParticles(random: RandomPort): void {
  const scene = sceneParticleScene()
  if (scene.emitters.length === 0) return
  if (claimSceneParticleTick(scene, appTickOfGameSceneTick(gameSceneTickNow()))) tickParticles(scene, random)
}
