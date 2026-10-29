import { isBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import type { WorldPoint } from '@/entities/fielding/model/fieldGeometry'
import { withThrowMotion } from '@/entities/fielding/model/fielderPose'
import { NONE, fielderAbilityOf } from '@/entities/fielding/model/fieldingState'
import { LASER_THROW_SPEED, thrownWith } from '@/entities/fielding/model/throwPlan'
import { DEFAULT_ABILITY } from '@/features/defense-play/model/defensePlay/constants'
import type { TickFrame } from '@/features/defense-play/model/defensePlay/step/tickFrame'
import type { CpuSpecialThrowChoice } from '@/features/defense-play/model/defensePlay/throw/cpuSpecialThrow'
import type { DefensePlayState } from '@/features/defense-play/model/defensePlay/types/defensePlayState'
import { THROW_ERROR_MARK_TICKS } from '@/features/defense-play/model/playerEffects'
import { type ThrowLaunchInput, type ThrownBall, launchThrow } from '@/features/defense-play/model/throwLaunch'

export interface ThrowLaunchChoice {
  readonly fromSlot: number
  readonly target: WorldPoint
  readonly laser: boolean
  readonly special: CpuSpecialThrowChoice
}

/**
 * **공을 손에서 쏜다** — 레이저면 야수 vtb0 = 0xa222c, 아니면 vtac = 0xa1620 (b2f06, 직접 뜬 것). 던진 공이 악송구 · 원바운드면
 * 그림의 "!" 칸을 세운다(a1908 · a17fc — 던진 야수 +0xc0 = 4, 그림 0x438c4).
 */
export function rollLaunchThrow(s: DefensePlayState, choice: ThrowLaunchChoice): ThrownBall {
  const thrown = choice.laser ? rollLaserLaunch(s, choice) : rollArmLaunch(s, choice)
  if (thrown.errant) s.errantThrow = true
  if (thrown.errant || thrown.bounce) {
    s.throwErrorMarks = s.throwErrorMarks.map((value, slot) => (slot === choice.fromSlot ? THROW_ERROR_MARK_TICKS : value))
  }
  return thrown
}

/**
 * b2f06: 플레이+0x1f4(레이저) 면 0xa1620(vtac) 대신 야수 vtb0 = 0xa222c 로 던진다 (직접 뜬 것):
 *   a229c `+0xdc = 2000` 고정 속도 · 0xa1620 과 같은 h · w · φ 산술(0xa279d 중력 배율 · 0xbfab0 · cos) · **난수 굴림 없음**
 *   (0xbfa54 호출이 없다 — 악송구도 흔들림도 없다) · a23ae 공+0xaac = a23ba 공+0xaad = 0 이라 받는 점을 끼워 넣는다.
 *   특수라 0xb3444 가 중계도 안 끼운다(b3528). 던진 뒤 vt64(0)
 */
function rollLaserLaunch(s: DefensePlayState, choice: ThrowLaunchChoice): ThrownBall {
  s.fielders = s.fielders.map((fielder) => (fielder.slot === choice.fromSlot ? { ...fielder, throwSpeed: LASER_THROW_SPEED } : fielder))
  s.laserArmed = false
  return launchThrow({
    thrower: s.fielders[choice.fromSlot],
    target: choice.target,
    laser: true,
    ability: fielderAbilityOf(s.abilities, choice.fromSlot, DEFAULT_ABILITY),
    random: s.input.random,
    body: ballBodyOf(s),
  })
}

/**
 * a16dc~a16ec: +0xdc = 특수 ? +0xd8 : +0xd4 — 던질 때 덮어쓰고 그 판 동안 남는다(`FielderState.throwSpeed`).
 * 0xa1620 — 원바운드(a17fc: 특수 && 거리 > 20400)면 rand(0, 2) 한 번으로 φ ± 1 · 공+0xaac = 1 (악송구 · 흔들림 굴림 없음),
 * 아니면 악송구 굴림(a1828, CPU 특수 송구는 다섯째 인자 = 계획 [1] 로 기준 +100) · 악송구면 흔들기 굴림 둘 ·
 * 아니면 긴 송구 흔들림 굴림(a198c) — 그리고 세계 0xbfed0 · 받는 점 끼워 넣기(b2f9c)
 */
function rollArmLaunch(s: DefensePlayState, choice: ThrowLaunchChoice): ThrownBall {
  const special = choice.special
  s.fielders = s.fielders.map((fielder) => (fielder.slot === choice.fromSlot ? thrownWith(fielder, special.special) : fielder))
  return launchThrow({
    thrower: s.fielders[choice.fromSlot],
    target: choice.target,
    special: special.special,
    bounce: special.bounce,
    ability: fielderAbilityOf(s.abilities, choice.fromSlot, DEFAULT_ABILITY),
    random: s.input.random,
    body: ballBodyOf(s),
  })
}

function ballBodyOf(s: DefensePlayState): ThrowLaunchInput['body'] {
  return isBallTrajectory(s.trajectory) ? s.trajectory.flight.body : undefined
}

export interface ThrowRelease {
  readonly fromSlot: number
  readonly base: number
  readonly firstReceiver: number
}

/**
 * 손을 떠난다 — 받을 야수 · 받는 틱을 다시 세운다 (b2f80 · b3070 · b307c). 받을 야수는 예보가 고른다(`takeLooseBall`).
 * a1a26~a1a3a(레이저 a240c~a2418) 동작 5 · 야수+0xb1 = 1 — 다음 야수 틱은 vtc8 이 거짓이라 걸음 없이(`canStepNextListTick`)
 * 워드를 지운다(`listTickFielder` — U-78). 그 틱의 예보 복제도 이 칸을 베낀다(`forecastCatch`)
 */
export function releaseThrow(s: DefensePlayState, t: TickFrame, release: ThrowRelease): void {
  s.throwBase = release.base
  s.throwArrivalTick = -1
  s.throwFromSlot = release.fromSlot
  s.throwReleaseTick = t.tick
  s.throwCount += 1
  s.fielders = s.fielders.map((fielder) =>
    fielder.slot === release.fromSlot ? withThrowMotion({ ...fielder, holdingBall: false, actionRemainingTicks: 0 }) : fielder,
  )
  s.play = {
    ...s.play,
    held: false,
    catchFielderSlot: release.firstReceiver === NONE ? s.play.catchFielderSlot : release.firstReceiver,
    catchTick: s.throwArrivalTick,
  }
}
