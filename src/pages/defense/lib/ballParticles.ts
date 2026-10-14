import { toScreenX, toScreenY } from '@/pages/defense/lib/defenseCamera'
import { isBallDrawn, type DefenseViewState } from '@/pages/defense/lib/defenseView'

/**
 * **수비 화면 공 그리기 0x36dfc 가 쏘는 파티클** (2026-10-14 직접 뜸 — 진행기 쪽 조건은 `defenseView.BallParticleFacts`).
 *
 * 공 자리는 공 점 (x, y, z) 를 두 번 투영한다 — 0xb94b5(카메라 +0x1f0, (x, z)) → (px, py) 와 0xb94b5(카메라, (0, y)) → (·, h).
 * 화면 좌표는 카메라 오프셋 (+0xfec, +0xff0) 을 더한 것이다. 0xbbc85 는 `emitParticles` 와 같은 꼴(x, y, id, img, 0, −1, 0, 0)이다.
 * ```
 * 36f76  경기+0x199a && state[0x26] ∈ {1, 8}:
 * 36f94    0xbbc85(+0xfec + px, +0xff0 + py − h, 4, 10)          ; 큰 타구 — ptc id 4 (005.ptc) · ptcimg 10
 * 36fba  h < 0 → 끝 ; +0xff0 + py < 1 → 끝                         ; (`bpl` — 땅점 화면 y ≥ 1)
 * 36fd4  h ≠ 0 → 레이저 잔상 갈래(0x37076)
 * 36fe0  공+0x6c − 1 ≤ 공+0x68 → 끝 ; h' = (0, 0xa25fd(공 틱 + 1).y) 의 투영 ; 0x357e0 → 끝 ; +0xfd4 ∈ {9,10,11} → 끝 ; h' == 0 → 끝
 * 37042    공+0xab4 = 1 ; 0xbbc85(+0xfec + px, +0xff0 + py, 0, 8)   ; 튐 — ptc id 0 (001.ptc) · ptcimg 8
 * ```
 * - 공 그리기는 그리기 0x46c88 가 그리기 목록을 채울 때(야수 0x43278 · 주자 0x43a0c 다음) 돈다 — HOMERUN 글자(0x40b18)의
 *   홈런 효과 틱보다 먼저, 프레임 끝 파티클 틱(0x6de84)보다 먼저다. 키 건너뛰기(+0xfe7) 동안은 그리지 않아 안 쏜다.
 * - 판이 닫힌 뒤 그림(+0x1094 셈)도 그리므로 마지막 그림의 조건이 그대로 서 있으면 그림마다 다시 쏜다.
 * - 공+0xab4 는 0x17 진입 0x46734 가 0 으로 내리는 것 말고 읽는 곳을 못 찾았다(리터럴 0xab4 는 0x37174 · 0x46824 둘뿐,
 *   `0xab << 4` 에 4 를 더하는 꼴도 없다) ⚠️ 미확인 — 웹은 효과 칸(`DefenseEffects.ballBounced`)에만 적는다.
 * - 높이 투영 h 는 웹 배율 `toScreenY`(0xb9480 세로)다 — 투영 수식은 새로 풀지 않았다.
 */

/** 큰 타구 파티클 — 0x36fb0 `movs r2, #4` · `movs r3, #0xa` */
export const BIG_HIT_BALL_PARTICLE = { id: 4, img: 10 } as const
/** 튐 파티클 — 0x3706a `movs r3, #8` · `movs r2, #0` */
export const BOUNCE_BALL_PARTICLE = { id: 0, img: 8 } as const

export interface BallParticleShot {
  readonly id: number
  readonly img: number
  readonly x: number
  readonly y: number
  /** 튐 갈래(공+0xab4 = 1 을 적는 쪽)인가 */
  readonly bounce: boolean
}

/** 이 그림의 공 그리기가 쏠 파티클 — `offset` 은 이 그림의 카메라 오프셋(+0xfec, +0xff0) */
export function ballParticleShotsOf(
  state: Pick<DefenseViewState, 'ball' | 'ballParticles'>,
  offset: { readonly x: number; readonly y: number },
): BallParticleShot[] {
  const facts = state.ballParticles ?? null
  if (facts === null || !isBallDrawn(state.ball)) return []
  const shots: BallParticleShot[] = []
  const x = offset.x + toScreenX(state.ball.x)
  const groundY = offset.y + toScreenY(state.ball.z)
  const height = toScreenY(state.ball.height)
  if (facts.bigHit) shots.push({ ...BIG_HIT_BALL_PARTICLE, x, y: groundY - height, bounce: false })
  if (height < 0 || groundY < 1 || height !== 0) return shots
  if (facts.bounceNextHeight === null || toScreenY(facts.bounceNextHeight) === 0) return shots
  shots.push({ ...BOUNCE_BALL_PARTICLE, x, y: groundY, bounce: true })
  return shots
}
