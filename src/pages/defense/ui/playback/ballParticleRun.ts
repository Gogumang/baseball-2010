import type { DefenseViewState } from '@/entities/fielding/model/defenseView/defenseViewState'
import { clearParticles, type ParticleScene } from '@/entities/particle/model/particleScene'
import { ballParticleShotsOf, type BallParticleShot } from '@/pages/defense/lib/ballParticles'
import { cameraBoundsOf, centerOn, screenOffsetOf } from '@/pages/defense/lib/defenseCamera'
import {
  DEFENSE_SCENE_START,
  defenseEffectsOf,
  endDefenseEffects,
  stepDefenseEffects,
  type DefenseEffects,
} from '@/pages/defense/lib/defenseHomeRunEffects'
import * as screenStyles from '@/pages/defense/ui/DefenseScreen.css'
import type { CameraOffset } from '@/pages/defense/ui/playback/playbackClock'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { appTickOfGameSceneTick, isCommonWindowShown } from '@/shared/lib/commonWindow/commonWindow'
import { particleConfigOf } from '@/widgets/particles/lib/particleCatalog'
import { sceneParticleScene } from '@/widgets/particles/model/sceneParticles'

/**
 * 이 그림의 공 그리기 0x36dfc 가 쏠 파티클 (`lib/ballParticles`) — 화면 좌표는 카메라 오프셋을 더한 것이다.
 * 원본 카메라는 그 그림의 0x3f060(목록 틱, 플레이 틱 앞)이 옮긴 자리다. 웹 화면은 갱신마다 앞 그림의 대상으로 카메라를 옮긴 뒤
 * 그리므로 **이 갱신에 화면이 적은 오프셋**이 같은 자리다. 첫 그림(아직 안 그림)은 화면 진입의 가운데 맞춤(공 (x, z))과 같다.
 * ⚠️ 한 갱신에 여러 틱을 따라잡으면 그 틱들은 같은 오프셋으로 쏜다(근사).
 */
export function ballShotsAt(drawn: DefenseViewState | undefined, cameraOffset: CameraOffset): readonly BallParticleShot[] {
  if (drawn === undefined) return []
  const offset =
    cameraOffset ??
    screenOffsetOf(
      centerOn(cameraBoundsOf(screenStyles.SCREEN_WIDTH, screenStyles.SCREEN_HEIGHT), drawn.cameraTarget ?? { x: drawn.ball.x, z: drawn.ball.z }),
    )
  return ballParticleShotsOf(drawn, offset)
}

/**
 * **주자 판 · 재생 갈래의 공 그리기 파티클** — 0x17 진입 0x46418 이 파티클 관리자를 비우고(4673e 0x6dee4), 그림마다 0x46c88 이 공 그리기
 * 0x36dfc(판 종류를 안 본다 — `features/defense-play/model/ballParticleFacts`)로 튐 파티클을 쏘고 프레임 끝 0x6de84 가 굴린다.
 * 판이 닫힌 뒤 그림(+0x1094 셈)도 마지막 그림의 공을 그대로 그린다. 0x35108(끝) · 키 건너뛰기 0x519cc 가 치운다.
 * 주자 판에는 홈런 연출(글자 · 효과)이 없어 연출 칸은 빈 장면에서 시작한다.
 */
export interface BallParticleRun {
  readonly scene: ParticleScene
  effects: DefenseEffects
  version: number
  cleared: boolean
}

export function startBallParticleRun(): BallParticleRun {
  // 0x17 진입 0x46418 의 4673e — 앱 전역 관리자를 갈래 없이 비운다(0x6dee4, 굴림 없음)
  const scene = sceneParticleScene()
  clearParticles(scene)
  return { scene, effects: defenseEffectsOf(DEFENSE_SCENE_START), version: 0, cleared: false }
}

/** 그림 하나 — 공 그리기의 파티클을 쏘고 프레임 끝 파티클 틱을 돌린다 */
export function drawBallParticles(
  run: BallParticleRun,
  drawn: DefenseViewState | undefined,
  cameraOffset: CameraOffset,
  random: RandomPort,
  sceneTick: number | null,
): void {
  if (run.cleared) return
  const frame = stepDefenseEffects(
    run.effects,
    null,
    // 53048 — 공용 창이 서 있는 그림은 관리자 틱이 없다(위 `effectsPorts` 와 같은 게이트). 관리자 틱은 앱 틀당 한 번
    {
      particles: run.scene,
      random: isCommonWindowShown() ? undefined : random,
      configOf: particleConfigOf,
      ...(sceneTick === null ? {} : { appTick: appTickOfGameSceneTick(sceneTick) }),
    },
    ballShotsAt(drawn, cameraOffset),
  )
  run.effects = frame.effects
  run.version += 1
}

/** 0x35108 · 0x519cc — 파티클을 치운다 */
export function clearBallParticles(run: BallParticleRun): void {
  if (run.cleared) return
  run.effects = endDefenseEffects(run.effects, run.scene)
  run.cleared = true
  run.version += 1
}
