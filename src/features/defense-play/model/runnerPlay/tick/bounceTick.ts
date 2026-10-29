import { withPoseCleared } from '@/entities/fielding/model/fielderPose'
import { NONE } from '@/entities/fielding/model/fieldingState'
import { bounceOffFielder, chaseLooseBall } from '@/features/defense-play/model/looseBallChase'
import { takeLooseBall } from '@/features/defense-play/model/runnerPlay/ball/takeLooseBall'
import type { RunnerPlayFrame } from '@/features/defense-play/model/runnerPlay/frame/runnerPlayFrame'
import { pushPlayLog } from '@/features/defense-play/model/playLog'

/**
 * **2d. 플레이 틱 꼬리 b45a0** — 사건(펌블)이 있었으면 플레이.vt70 = 0xb3148: 공을 그 야수에게서 튕겨 다시 쏘고 vt24(1) · vt34.
 * 이 그림 그리기(5 절)보다 먼저라 깐 그림은 공+0x68 = 0 으로 공을 안 그린다(36e24)
 */
export function rollBounceFromFumble(g: RunnerPlayFrame, tick: number): void {
  const fumbledBall = g.chase
  if (!g.ballEventThisTick || fumbledBall === null || g.play.finished) return
  const holder = g.fielders[fumbledBall.slot]
  // b31c8~b31f0 — 공 가진 야수(+0x130)가 +0xb4 ≤ 0 이면 vt10(동작 · 자세 워드 0 · 목표 = 위치, r176)
  g.fielders = g.fielders.map((fielder) =>
    fielder.slot === g.play.ballHolderSlot && fielder.actionLockTicks <= 0 ? withPoseCleared(fielder) : fielder,
  )
  const bounced = bounceOffFielder(fumbledBall, tick, holder.position, g.input.random)
  if (bounced === null) return
  takeLooseBall(g, chaseLooseBall(bounced.ball, tick, g.fielders, { initialChaserSlot: fumbledBall.slot }, g.maximumTicks))
  g.flight = null
  const picker = g.chase === null ? `${NONE}번 야수가 ${tick}틱에` : `${g.chase.slot}번 야수가 ${g.chase.catchTick}틱에`
  pushPlayLog(
    g.log,
    () => `${tick}틱 공 튕김 (0xb3148) — 속도 ${bounced.speed} · v0 ${bounced.verticalSpeed} · 각 ${bounced.angle} · ${picker} 줍는다`,
  )
}
