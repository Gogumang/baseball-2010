import { carryDistanceOf, holdTrajectoryAt } from '@/entities/batting/model/battedBallFlight'
import { listTickFielder } from '@/entities/fielding/model/fielderPose'
import type { RunnerState } from '@/entities/fielding/model/fieldingState'
import { type PlayGateFrameResult, gateRunnerViewsOf, passPlayGateBetweenTicks } from '@/entities/fielding/model/playGate'
import { DEEP_LANDING_DISTANCE } from '@/features/defense-play/model/defensePlay/constants'
import { passFastForwardGates, runnerGateInputOf } from '@/features/defense-play/model/defensePlay/gate/fastForwardGates'
import { gateInputOf } from '@/features/defense-play/model/defensePlay/gate/gateInput'
import type { TickFrame } from '@/features/defense-play/model/defensePlay/step/tickFrame'
import type { DefensePlayState } from '@/features/defense-play/model/defensePlay/types/defensePlayState'
import { drawSceneEffects } from '@/features/defense-play/model/defensePlay/view/sceneEffects'
import { snapshotAt } from '@/features/defense-play/model/defensePlay/view/snapshot'

/**
 * **8. 판 진행 관문 0xb0d28** — 이 틱 그리기 0x46e3c(G3) · 0x3f378(G4, 안 쥐었을 때) · 다음 틱 0x3f060(G1) · 슬롯 2 머리 52502(G2)
 * (전문은 `entities/fielding/model/playGate.ts` — `passPlayGateBetweenTicks`). 부를 때마다 +0x120 이 오르므로 주자가 다 서고
 * (+0x94 까지) 누가 공을 쥔 채 관문을 51 번 지나면(그림마다 3 번 — 17 틱) 닫힌다. 그동안에도 자동 진루 · CPU 송구가 돈다.
 * 3아웃(b0dbe) · 사건 코드 11(b0db4)이면 곧바로 닫힌다. 악송구는 예보 vt24(0)가 고른 야수가 포구 틱 갈래로 주워 쥔다(`takeLooseBall`).
 * 그 뒤 9 · 9b · 10 절(건너뛰기 공 붙잡기 · 깊은 낙구 함성 · G2 만 닫힌 그림)이 잇는다.
 */
export function runPlayGatePhase(s: DefensePlayState, t: TickFrame, runnersBeforeListTick: readonly RunnerState[]): void {
  const gateRunners = gateRunnerViewsOf(
    runnersBeforeListTick,
    s.runners.map((runner) => runner.state),
  )
  const gateInput = gateInputOf(s, t, gateRunners.frame)
  const gate =
    s.fastForward && !s.gamePaused
      ? passFastForwardGates(s, t, gateInput, gateRunners, runnerGateInputOf)
      : passPlayGateBetweenTicks(gateInput, s.fastForward, s.gamePaused, runnerGateInputOf(gateRunners.head))
  applyGateResult(s, gate)
  if (s.fastForward && !s.gamePaused) holdBallWhileFastForward(s, t)
  if (isDeepLandingCheer(s, t)) t.tickSounds.push({ kind: 'deepLanding' })
  if (isClosedOnlyAtG2(s, gate)) drawClosingListFrame(s, t)
}

function applyGateResult(s: DefensePlayState, gate: PlayGateFrameResult): void {
  s.endCounter = gate.endCounter
  s.counterBeforeHead = gate.counterBeforeHead
  s.drawGateOpen = gate.drawOpen
  if (gate.open) return
  s.play = { ...s.play, finished: true }
  // 닫힌 그림 다음의 G1 — 열렸으면 목록 틱 a1330 이 +0xcc 를 하나 더 줄인다(`fielderSlackAtPlayEnd`, r196)
  s.closingListTickOpen = gate.listTickOpen === true
}

/**
 * 키 건너뛰기 되풀이 52b26~52b40 동안은 그리기 · 0x3f378 이 없어 공+0x68 이 안 오른다(0xa2594 를 부르는 곳은 0x3f378 3f3c6 하나) —
 * 다음 판 틱도 이 틱의 공 점을 본다. 풀린 그림은 그리고 0x3f378(G4)을 지나 다음 판 틱은 한 칸 나아간 점이다(쥐었으면 3f3aa 가 안 올린다 —
 * 쥔 공은 진행기가 야수 손에 둔다)
 */
function holdBallWhileFastForward(s: DefensePlayState, t: TickFrame): void {
  s.trajectory = holdTrajectoryAt(s.trajectory, t.tick + 1)
  if (s.ballLandingTick > t.tick) s.ballLandingTick += 1
  if (s.catchTick > t.tick) s.catchTick += 1
}

/**
 * **9b. 슬롯 2 꼬리 52b62~52bb2 — 깊은 낙구 함성 60** (직접 뜸).
 * 52b26 건너뛰기 되풀이가 끝난 뒤(+0xfe7 == 0) 한 번: 공+0xaa0(낙구 틱) ≠ −1 && == 공+0x68 && 공+0xac4(깊은 페어 낙구) &&
 * ¬0x357e0(결과 코드 24~26) && 플레이+0x113(b4492 — 낙구 틱에 아무도 안 쥐었다) → 즉시 60. 결과 코드(0x357e0)는 화면이 본다.
 * 공+0xac4 = 낙구점이 홈에서 10274 넘게 · 각이 페어(P2 2절) — 웹은 이 궤적의 낙구 거리와 쏜 공의 파울 각(state[0x1c])으로 본다
 * (예전 판 끝 `atBatSounds.deepHitCheerSoundIdOf` 와 같은 근사). 건너뛰는 채로 끝난 틱은 52b40 이 524f8 로 돌아가 이 꼬리가 없다
 */
function isDeepLandingCheer(s: DefensePlayState, t: TickFrame): boolean {
  return t.landedUncaughtThisTick && !s.fastForward && !s.foulAngle && carryDistanceOf(s.trajectory) > DEEP_LANDING_DISTANCE
}

function isClosedOnlyAtG2(s: DefensePlayState, gate: PlayGateFrameResult): boolean {
  return !gate.open && gate.listTickOpen === true && !s.fastForward
}

/**
 * **10. G2 만 닫힌 그림** — 원본은 그 그림도 그린다 (`DefenseViewState.closingListFrame`).
 * G3 · G4 · G1 이 열리고 G2(52502)에서 닫히면(쥔 채 다 선 판의 +0x120 세기는 목록 틱 뒤 주자부터 세어 G2 에서 51 이 되기 쉽다)
 * 다음 그림은 0x3f060 의 목록 틱(6 절 이동 + 야수 준비 틱 줄이기 a1312) · 카메라를 돌고 슬롯 2 는 529f0 으로 빠진 채 그려진다.
 * 공+0x68 은 그 앞 0x3f378(G4)이 이미 올렸으므로 다음 틱 점이다. 건너뛰는 동안(+0xfe7)은 그리지 않는다.
 * 그 그림의 연출(결과 판 0x46844 · 레이저 0x4403c · 필살 포구 B · C · 줌 펀치 0xbb84c)도 그리기 0x46c88(46de4~46e24)가 관문을 안 보고
 * 한 번 더 돌린다(직접 뜸) — 결과 판 타이머가 한 칸 더 줄고 줌 · 큰 OUT 이 한 걸음 나아간다. 예전 웹은 앞 그림 칸을 그대로 베꼈다.
 * ⚠️ 그 뒤 닫힌 갱신(529f0, +0x1094 셈)의 그리기 연출은 이 진행기 밖이다 — 재생기(`DefensePlayback`)가 마지막 그림을 그대로 둔다
 */
function drawClosingListFrame(s: DefensePlayState, t: TickFrame): void {
  const listTickFielders = s.fielders.map(listTickFielder)
  s.ticks.push({ ...snapshotAt(s, t, t.tick + 1, listTickFielders, false), closingListFrame: true })
  drawSceneEffects(s)
}
