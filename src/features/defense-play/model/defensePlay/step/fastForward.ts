import { isBallStoppedAt } from '@/features/defense-play/model/defensePlay/ball/ballPoint'
import { HOME_BASE } from '@/features/defense-play/model/defensePlay/constants'
import { acceptsFastForwardKey } from '@/features/defense-play/model/defensePlay/step/playFinished'
import type { TickFrame } from '@/features/defense-play/model/defensePlay/step/tickFrame'
import type { DefensePlayState, MutableRunner } from '@/features/defense-play/model/defensePlay/types/defensePlayState'
import { pushPlayLog } from '@/features/defense-play/model/playLog'

/**
 * **0x17 키 건너뛰기** — 키 처리 0x53420 이 키마다 끝에 메시지 0x587 → 0x509a0(0x50afe) → 0x519cc (갱신 0x524c0 보다 먼저).
 * state[0x1d](홈런) || +0x129(폴 홈런) || state[0xb] ∈ {3, 4} 일 때만 +0xfe7 = 1 — 이 틱부터 한 그림 안에서 판을 끝까지 돈다.
 * 이 그림에 막 누른 건너뛰기 — 그림 머리 52e16 의 0x3f060(목록 틱은 앞 판 틱의 6 절 이동)이 키 처리 뒤라 그 카메라가 벌써 본다.
 * 이 틱이 돈다는 것은 앞 틱 끝 G2 가 열렸다는 것이고 G1 은 G2 보다 먼저 닫히므로 G1 도 열려 있었다. 멈춘 그림은 0x3f060 이 3f0a4 에서 돈다
 */
export function pressFastForwardKey(s: DefensePlayState, t: TickFrame): void {
  if (t.key !== null && !s.fastForward && acceptsFastForwardKey(s)) {
    s.fastForward = true
    pushPlayLog(s.log, () => `${t.tick}틱 키 건너뛰기 (0x519cc +0xfe7)`)
  }
  if (s.fastForward && !t.fastForwardAtHead && !t.pausedAtHead) cameraFastForwardRunIn(s, t)
}

/**
 * **카메라 0x3f060 의 키 건너뛰기 부수효과 (3f0f0~3f192, 직접 뜸)** — 목록 틱(3f0da) 바로 뒤 카메라에서:
 * ```
 * 3f0b8  G1 이 열렸고(r6 = 1) 0x33c98(0x17) 이면 목록 틱 뒤 카메라:
 * 3f0f0  플레이 +0x111(홈런) || +0x129(폴 홈런) 이고 공.vt18(멈춤)이면 대상 = 주자 0(0xa9565(주자관리, 0)) —
 * 3f164  +0xfe7(건너뛰기) ≠ 0 && 주자 0 +0x7c(목표 루) == 4 && +0x8c(닿은 루) == 4 →
 * 3f17e    +0xfe7 = 0 · 메시지 0x13(인자 0) 곧바로(0xbfbad) → 0x51fb8: 점수 +1(0xb6a9c) · 주자 0 +0x95 = +0x96 = 1 ·
 *          0x357e0 && +0xfe7 == 0 이면 홈런 점수판 갈래(52030)
 * 52b36  +0xfe7 이 내려갔으면 52b26 되풀이를 멈추고 그 그림을 그대로 그린다(52b42 → 그리기)
 * ```
 * 이 카메라는 0x3f060 을 부르는 두 자리에서 돈다 — 그림 머리 52e16(키 처리 0x498d4 52d9e 뒤라 이 그림에 막 누른 건너뛰기도 본다)과
 * 건너뛰는 동안의 52b26(슬롯 2 뒤). **득점 차례(확정)**: 메시지 0x13(타자주자)은 목록 틱 카메라에서 곧바로 가고, 같은 목록 틱에 홈에
 * 닿은 앞 주자의 0x13 은 그 뒤 슬롯 2 의 0xaa0a8(6f 절)이 보낸다 — 타자주자가 먼저다. 0xaa0a8 은 +0x96 이 선 타자주자를 건너뛴다(aa0e6).
 * 이미 0xaa0a8 이 센 타자주자여도 원본은 1점을 또 올린다(0xb6a9c — 원본 그대로, 다만 그때는 보통 0xa990c == 0 이라 G1 이 닫혀 있다).
 * 52b26 에서 풀린 그림은 52b36 → 52b42 로 되풀이를 멈추고 그린 뒤(G3 · G4), 다음 그림 52c50 이 키 0x498d4(52d9e) 다음 **52e16 의
 * 0x3f060 을 갈래 없이** 부르고서야 0x524c0(52e94)의 G2 · 슬롯 2 로 간다(직접 뜸). 곧 목록 틱이 한 번 더 돌아 앞 주자의 +0x3b 를
 * 지우므로 같은 목록 틱에 닿은 앞 주자는 0xaa0a8 이 세지 않는다(원본 버그) — 웹은 9 절 `passFastForwardGates` 가 그 목록 틱을 돌되,
 * **사용자 결정 2026-10-26: 원본 버그를 고침** — 홈에 닿은 앞 주자의 +0x3b 를 남겨 다음 판 틱 0xaa0a8 이 센다.
 */
export function cameraFastForwardRunIn(s: DefensePlayState, t: TickFrame): void {
  const firstRunner = s.runners[0]
  if (!isCameraOnStoppedHomeRun(s, t) || firstRunner === undefined || !isHomeSettled(firstRunner)) return
  s.fastForward = false
  firstRunner.counted = true
  firstRunner.state = { ...firstRunner.state, scored: true }
  s.held = { ...s.held, scoreboardRuns: s.held.scoreboardRuns + 1 }
  t.runInsThisTick.push(firstRunner.state.index)
  t.tickSounds.push({ kind: 'runIn', slot: firstRunner.state.index })
  pushPlayLog(s.log, () => `${t.tick}틱 카메라 0x3f060 — 타자주자 홈, 건너뛰기 풀림 (+0xfe7 = 0 · 메시지 0x13)`)
}

/** 3f0f0 — 건너뛰는 중(+0xfe7)이고 홈런(+0x111) · 폴 홈런(+0x129) 판에서 공.vt18(멈춤 — 쥔 공도 멈춘 것으로 본다) */
function isCameraOnStoppedHomeRun(s: DefensePlayState, t: TickFrame): boolean {
  const ballStopped = s.play.held || isBallStoppedAt(s.trajectory, t.tick)
  return s.fastForward && (s.homeRunFlag || s.play.suppressed) && ballStopped
}

/** 3f164 — 주자 0 의 +0x7c(목표 루) == 4 && +0x8c(닿은 루) == 4 */
function isHomeSettled(runner: MutableRunner): boolean {
  return runner.state.targetBase === HOME_BASE && runner.state.startBase === HOME_BASE
}
