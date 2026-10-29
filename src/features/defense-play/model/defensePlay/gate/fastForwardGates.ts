import type { RunnerState } from '@/entities/fielding/model/fieldingState'
import {
  type PlayGateFrameResult,
  type PlayGateInput,
  liveRunnerCountOf,
  passPlayGate,
  someRunnerStillActive,
} from '@/entities/fielding/model/playGate'
import { HOME_BASE } from '@/features/defense-play/model/defensePlay/constants'
import { listTickHead } from '@/features/defense-play/model/defensePlay/listTick/listTickHead'
import { listTickMove } from '@/features/defense-play/model/defensePlay/listTick/listTickMove'
import { isAtTarget } from '@/features/defense-play/model/defensePlay/runners/mutableRunner'
import { cameraFastForwardRunIn } from '@/features/defense-play/model/defensePlay/step/fastForward'
import type { TickFrame } from '@/features/defense-play/model/defensePlay/step/tickFrame'
import type { DefensePlayState, MutableRunner } from '@/features/defense-play/model/defensePlay/types/defensePlayState'

/**
 * **키 건너뛰기 되풀이의 관문 (52b26~52b40 · 그 뒤 그림, 직접 뜸)** — 건너뛰는 동안 한 그림 안의 차례는
 * ```
 * 52b32  0x3f060: G1(3f0b8) → 열렸으면 목록 틱 → 카메라 3f164 (타자주자 홈이면 +0xfe7 = 0 · 메시지 0x13)
 * 52b36  +0xfe7 이 서 있으면 524f8 → G2(52502) → 슬롯 2 … → 52b26 되풀이
 *        풀렸으면 52b42 → 그리기 0x46c88(G3 0x46e3c) → 0x3f378(G4, 쥐지 않았을 때)
 * 52e16  다음 그림 머리 0x3f060 — G1 → 목록 틱 **한 번 더**(주자 +0x3b 를 머리에서 지운다) → 0x524c0 의 G2 → 슬롯 2
 * ```
 * 그래서 풀린 틱은 G1 · 목록 틱 · 카메라 뒤에 G3 · G4 · G1 · 목록 틱이 더 돌고서야 G2 다. 웹 판 틱은 6 절 이동 하나가 목록 틱 하나라
 * 풀린 그림 다음 그림의 목록 틱을 여기서 한 번 더 돈다(`listTickHead` — 앞 목록 틱의 야수 준비 틱 몫 · `listTickMove`). 같은 목록 틱에
 * 타자주자와 함께 홈에 닿은 앞 주자는 원본에서 그 목록 틱이 +0x3b 를 지워 다음 슬롯 2 의 0xaa0a8 이 세지 않는다(원본 버그) —
 * **사용자 결정 2026-10-26: 원본 버그를 고침** — 웹은 그 앞 주자의 +0x3b 를 남겨 센다.
 */
// 관문 세기(+0x120)는 부르는 차례 그대로다 — `call` 의 가변 칸 `counter` 는 원래 모양을 둔다
export function passFastForwardGates(
  s: DefensePlayState,
  t: TickFrame,
  input: PlayGateInput,
  views: { readonly frame: readonly RunnerState[]; readonly head: readonly RunnerState[] },
  runnerInputOf: (views: readonly RunnerState[]) => Partial<PlayGateInput>,
): PlayGateFrameResult {
  let counter = input.endCounter
  const call = (override: Partial<PlayGateInput>): boolean => {
    const result = passPlayGate({ ...input, ...override, endCounter: counter })
    counter = result.endCounter
    return result.open
  }
  // G1 — 52b32 의 0x3f060 (6 절 이동 앞 주자)
  let listTickOpen = call(runnerInputOf(views.frame))
  if (listTickOpen) cameraFastForwardRunIn(s, t)
  let drawOpen: boolean | null = null
  if (!s.fastForward) {
    // 풀린 그림의 그리기 — 목록 틱 · 카메라(타자주자 득점) 뒤 주자를 본다
    const drawn = runnerInputOf(s.runners.map((runner) => runner.state))
    drawOpen = call(drawn)
    if (!s.play.held) call(drawn)
    // 다음 그림 머리 52e16 의 0x3f060 — G1 이 열렸으면 목록 틱 한 번 더
    listTickOpen = call(drawn)
    if (listTickOpen) listTickAgainKeepingHomeArrivals(s, t)
  }
  const counterBeforeHead = counter
  const headOpen = call(runnerInputOf(s.fastForward ? views.head : s.runners.map((runner) => runner.state)))
  return { open: headOpen, endCounter: counter, drawOpen, counterBeforeHead, listTickOpen }
}

/**
 * 다음 그림 머리 52e16 의 목록 틱 한 번 더.
 * **사용자 결정 2026-10-26: 원본 버그를 고침.** 원본은 이 목록 틱 머리 0xbf094(bf0a2)가 +0x3b 를 지워, 타자주자와 같은
 * 목록 틱에 홈을 밟은 앞 주자를 0xaa0a8 이 못 센다(1점이 빠지고 +0x96 이 안 서 관문이 늘 열려 판이 안 끝난다 — r247).
 * 웹은 그 앞 주자의 +0x3b 를 이 목록 틱 뒤에도 남겨, 다음 판 틱 6f 절의 0xaa0a8 이 (타자주자 다음 차례로) 센다.
 * 카메라가 푸는 것은 홈런(+0x111 · +0x129)뿐이라 이 갈래도 홈런에만 선다
 */
function listTickAgainKeepingHomeArrivals(s: DefensePlayState, t: TickFrame): void {
  const homeArrivals = s.runners.filter(isUncountedHomeArrival)
  listTickHead(s)
  listTickMove(s, t)
  for (const runner of homeArrivals) runner.arrivedThisListTick = true
}

function isUncountedHomeArrival(runner: MutableRunner): boolean {
  if (!runner.arrivedThisListTick || runner.counted || runner.state.isOut || runner.state.scored) return false
  return runner.state.targetBase === HOME_BASE && isAtTarget(runner.state)
}

/** G2(슬롯 2 머리 52502) — 목록 틱(6 절 이동) 뒤 · 득점 0xaa0a8(G2 뒤) 앞 주자로 보는 칸 */
export function runnerGateInputOf(views: readonly RunnerState[]): Partial<PlayGateInput> {
  return {
    someRunnerActive: someRunnerStillActive(views, isAtTarget),
    liveRunnerCount: liveRunnerCountOf(views),
  }
}
