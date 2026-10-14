import type { BattedBallTrajectory } from '@/entities/fielding/model/catchPrediction'
import type { BallParticleFacts } from '@/features/defense-play/model/defensePlayView'

/** 0x357e0 — 결과 코드 24~26(홈런성) */
const HOME_RUN_HIT_CODES: readonly number[] = [24, 25, 26]
/** 0x37028~0x37038 — 튐 파티클을 안 쏘는 결과 코드 */
const NO_BOUNCE_PARTICLE_CODES: readonly number[] = [9, 10, 11]
/** 0x36f84~0x36f92 — 큰 타구 파티클을 쏘는 판 종류(state[0x26]): 1 타구 판 · 8 더비 판 */
const BIG_HIT_PARTICLE_PLAY_KINDS: readonly number[] = [1, 8]

/**
 * 공 그리기 0x36dfc 의 파티클 조건 중 진행기 몫 (`defenseView.BallParticleFacts` 머리말 — 화면 쪽은 `pages/defense/lib/ballParticles`).
 *
 * 0x36dfc 는 0x17 그리기 0x46c88 이 이름 판 0x43cb0 · 야수 0x43278 · 주자 0x43a0c 다음에 **판 종류를 안 보고** 늘 부른다(46cce, 유일한 호출).
 * 그래서 주자 판(밀어내기 2 · 견제 4 · 도루 5 · 폭투 · 포일 9)도 같은 조건으로 쏜다 — 큰 타구 갈래만 판 종류 ∈ {1, 8} 을 본다(36f84~36f92).
 * - 36e24 `공+0x68 > 0` — 공 재생 틱(`ballTick`, 깐 그림이 0).
 * - 36fe0 `공+0x6c − 1 > 공+0x68` — 판 틱 `at` 이 궤적 끝 점 앞(궤적은 판 틱으로 읽는다), 다음 점 = `trajectory.pointAt(at + 1)`.
 * - 37010 `!0x357e0` · 37022 `+0xfd4 ∉ {9, 10, 11}` — 결과 코드(`resultCode`, 모르면 null = 둘 다 지난다).
 * `onTrajectory` 가 거짓이면(웹 공이 궤적이 아닌 근사로 그려지는 틱) 튐을 안 본다.
 */
export function ballParticleFactsOf(input: {
  /** 공+0x68 — 이 공을 깐 그림부터 센 재생 틱 */
  readonly ballTick: number
  /** 판 틱 — 궤적을 읽는 틱 (타구 판은 `ballTick` 과 같다) */
  readonly at: number
  readonly trajectory: BattedBallTrajectory
  readonly onTrajectory: boolean
  readonly bigHitWatch: boolean
  readonly playKind: number
  readonly resultCode: number | null
}): BallParticleFacts | null {
  if (input.ballTick <= 0) return null
  const bigHit = input.bigHitWatch && BIG_HIT_PARTICLE_PLAY_KINDS.includes(input.playKind)
  const bounces =
    input.onTrajectory &&
    input.at < input.trajectory.length - 1 &&
    !HOME_RUN_HIT_CODES.includes(input.resultCode ?? -1) &&
    !NO_BOUNCE_PARTICLE_CODES.includes(input.resultCode ?? -1)
  return { bigHit, bounceNextHeight: bounces ? input.trajectory.pointAt(input.at + 1).y : null }
}
