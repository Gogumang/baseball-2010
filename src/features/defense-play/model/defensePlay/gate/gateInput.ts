import type { RunnerState } from '@/entities/fielding/model/fieldingState'
import { type PlayGateInput, liveRunnerCountOf, someRunnerStillActive } from '@/entities/fielding/model/playGate'
import { isBallStoppedAt } from '@/features/defense-play/model/defensePlay/ball/ballPoint'
import { isAtTarget } from '@/features/defense-play/model/defensePlay/runners/mutableRunner'
import type { TickFrame } from '@/features/defense-play/model/defensePlay/step/tickFrame'
import type { DefensePlayState } from '@/features/defense-play/model/defensePlay/types/defensePlayState'

/** 관문 G3 · G4 · G1 의 입력 — 6 절 이동 · 득점 앞 주자(`frameRunners`)를 본다(G2 는 `runnerGateInputOf(head)`) */
export function gateInputOf(s: DefensePlayState, t: TickFrame, frameRunners: readonly RunnerState[]): PlayGateInput {
  return {
    foulFlag: s.foulFlag,
    foulBall: s.foulFlag ? foulBallOf(s, t) : undefined,
    lastEventCode: s.lastEventCode,
    outs: s.outs,
    // 0xaa05c · 0xa990c
    someRunnerActive: someRunnerStillActive(frameRunners, isAtTarget),
    homeRunDerby: false,
    homeRunFlag: s.homeRunFlag,
    poleHomeRunFlag: s.play.suppressed,
    liveRunnerCount: liveRunnerCountOf(frameRunners),
    ballHeld: s.play.held,
    groundRuleFlag: s.groundRuleFlag,
    endCounter: s.endCounter,
  }
}

/**
 * 파울 갈래(b0d2c)만 본다 — 멈춤 · 담장선 넘은 뒤 떨어지는 틱 · 홈 뒤(z > 32599, −315 < 각 < −225).
 * 공.vt18 = 0xa27f0 = 지금 점(공+0x68)의 속도 · 수직 속도 워드 == 0 && (공+0x24(높이) == 0 || 공+0x20 == 공+0x2c).
 * 공+0x20 · +0x2c 는 세계 0xbfed0 이 멈출 때(vt18 참)까지 돌린 마지막 물리 상태이고 재생 중엔 아무도 안 고친다
 * (공은 장면 +0x1e4 목록에 없다 — 3e5e0 new(0xac8) 뒤 0xc0104 를 안 부름) → 뒷 조건은 늘 참, 멈춤 = 지금 점의 속도 0.
 * 쥔 공은 0x3f378 3f3aa 가 +0x12c 이면 +0x68 을 안 올려 쥔 틱의 점에 머문다 — 쥐었다고 멈춘 공이 아니다.
 * 이 갈래(+0x110)에는 쥔 공이 오지 않는다: 쥐기 0xb2710 b2760 이 +0x112 = 1 을 세워 0x9d5bc(코드 7)가 안 돌고(b444e),
 * +0x110 이 서면 포구 관문 b2af6 이 쥐기를 막는다 (U-115)
 */
function foulBallOf(s: DefensePlayState, t: TickFrame): PlayGateInput['foulBall'] {
  return {
    stopped: isBallStoppedAt(s.trajectory, t.tick),
    currentTick: t.tick,
    landingTick: s.trajectory.landingTick,
    fenceTick: s.trajectory.fenceTick,
    z: s.trajectory.pointAt(t.tick).z,
    angle: s.trajectory.pointDetailAt?.(t.tick).angle ?? 0,
  }
}
