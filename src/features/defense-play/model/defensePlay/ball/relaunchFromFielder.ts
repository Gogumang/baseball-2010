import { isBallTrajectory, launchTrajectory } from '@/entities/batting/model/battedBallFlight'
import { withPoseCleared } from '@/entities/fielding/model/fielderPose'
import { takeLooseBall } from '@/features/defense-play/model/defensePlay/ball/takeLooseBall'
import { runCoverOnce } from '@/features/defense-play/model/defensePlay/cover/coverOnce'
import type { TickFrame } from '@/features/defense-play/model/defensePlay/step/tickFrame'
import type { DefensePlayState } from '@/features/defense-play/model/defensePlay/types/defensePlayState'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { pushPlayLog } from '@/features/defense-play/model/playLog'

/**
 * **플레이.vt70 = 0xb3148 — 공을 야수에게서 튕겨 다시 쏜다** (직접 뜬 것). 틱 끝 b45a0 이 사건(sp+0x24)이면 부른다.
 * ```
 * b3148 p = 공.vt60(지금 점) ; 속도 = max(p.속도·60/100, 300) · v0 = min(p.수직속도·30/100, 100) · 각 = p.각 + rand(−20, 20)
 * b31c8 f = 0xb0c90(+0x130 공 가진 야수) ; f+0xb4 ≤ 0 && !f+0xbc 면 f.vt10
 * b3200 0xbef58(공, f 위치) · 공.vt44(속도, v0, 각) · 메시지 0x12 → 세계 0xbfed0 (궤적 다시 깔기, 0x51f2e)
 * b323c state[0x1f] = 0 · (파울이면 state[0x1c] 다시) · state[0x20] = aa4 · state[0x80] = ab0 · +0x12c = 0
 * b3294 vt24(1) = 0xb12d0 예보(공+0x68 = 0 — b12da) · vt34 = 0xb3b38 고르기 · vt30 = 0xb1c90 커버
 * ```
 * 무작위 방향으로 튀기는 vt78 = 0xb32e8 은 부르는 곳을 못 찾았다(vtable 0xd8690 외 참조 없음) — 펌블도 이 0xb3148 이다.
 * 다시 쏜 공은 속성 목록 +0x5c 가 0xa2610 에서 비워져 필살타법 표시(비트 4)가 없는 보통 공이다.
 */
/** b3148 — 다시 쏜 공의 속도 = 지금 점 속도의 60% */
const RELAUNCH_SPEED_PERCENT = 60
/** b3148 — 다시 쏜 공 속도의 아래끝 */
const RELAUNCH_MINIMUM_SPEED = 300
/** b3148 — 다시 쏜 공의 수직 속도 = 지금 점 수직 속도의 30% */
const RELAUNCH_VERTICAL_PERCENT = 30
/** b3148 — 다시 쏜 공 수직 속도의 위끝 */
const RELAUNCH_MAXIMUM_VERTICAL_SPEED = 100
/** b3148 — 각 흔들림 rand(−20, 20) */
const RELAUNCH_TURN_SPREAD = 20

export function rollRelaunchFromFielder(s: DefensePlayState, t: TickFrame): void {
  if (s.trajectory.pointDetailAt === undefined) {
    // 손으로 만든 시험 궤적 — 원본 점 칸이 없어 다시 쏠 수 없다. 공은 그 자리에 둔다
    pushPlayLog(s.log, () => `${t.tick}틱 공 튕김 — 궤적 칸이 없어 다시 쏘지 않는다`)
    return
  }
  const point = s.trajectory.pointDetailAt(t.tick)
  const speed = Math.max(Math.trunc((point.speed * RELAUNCH_SPEED_PERCENT) / 100), RELAUNCH_MINIMUM_SPEED)
  const verticalSpeed = Math.min(Math.trunc((point.verticalSpeed * RELAUNCH_VERTICAL_PERCENT) / 100), RELAUNCH_MAXIMUM_VERTICAL_SPEED)
  const turn = rollRelaunchTurn(s.input.random)
  const holder = s.fielders[s.chaserSlot]
  // b31c8~b31f0 — f = 0xb0c90(+0x130 공 가진 야수) ; +0xb4 ≤ 0 && +0xbc == 0 이면 f.vt10: 동작 0 · 자세 워드 0 (r171).
  // 펌블한 포구 동작의 워드는 여기서 지워진다. 필살타법 타구에 맞은 야수는 같은 틱 b4588 vt74 의 잠금(+0xb4 = 15)이 먼저라 안 지운다
  s.fielders = s.fielders.map((fielder) =>
    fielder.slot === s.play.ballHolderSlot && fielder.actionLockTicks <= 0 ? withPoseCleared(fielder) : fielder,
  )
  const next = launchTrajectory({
    from: holder.position,
    speed,
    verticalSpeed,
    angle: point.angle + turn,
    random: s.input.random,
    body: isBallTrajectory(s.trajectory) ? s.trajectory.flight.body : undefined,
  })
  s.uncatchable = false
  // b323c state[0x1f] = 0 — 다시 쏜 공을 줍는 것은 뜬공 포구가 아니다(타자주자는 결과 코드 다리대로 1루 송구 도착에)
  s.onTheFly = false
  // vt24(1) — 예보는 새 궤적 t = 1 → 끝 · 추적야수(+0x130 = f)는 t ≤ 4 를 건너뛴다. 낙구 구간으로 자르지 않는다.
  // 복제는 진짜 야수를 통째로 베끼므로 필살타법 타구에 맞은 야수의 동작 잠금 +0xb4 = 15(b4594 vt74)도 따라간다 — 그 틱 동안은
  // 판정도 n 도 없다.
  takeLooseBall(s, t, next, { initialChaserSlot: s.chaserSlot })
  // b32b0 vt30 = 0xb1c90 — 새 고르기 뒤 커버 한 번 (r171)
  runCoverOnce(s, t)
  pushPlayLog(
    s.log,
    () =>
      `${t.tick}틱 공 튕김 (0xb3148) — 속도 ${speed} · v0 ${verticalSpeed} · 각 ${point.angle + turn} · ${s.chaserSlot}번 야수가 ${s.catchTick}틱에 줍는다`,
  )
}

/** rand(−20, 20) — 난수가 없으면 굴리지 않고 0 (이 진행기의 규약) */
function rollRelaunchTurn(random: RandomPort | undefined): number {
  if (random === undefined) return 0
  return random.rand(-RELAUNCH_TURN_SPREAD, RELAUNCH_TURN_SPREAD)
}
