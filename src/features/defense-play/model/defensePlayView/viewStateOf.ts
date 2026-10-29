import { laserShiningSlotOf } from '@/features/defense-play/model/defensePlayView/holderMark'
import { recordFielderView } from '@/features/defense-play/model/defensePlayView/fielderView'
import { recordRunnerView } from '@/features/defense-play/model/defensePlayView/runnerView'
import type { DefensePlayView, ViewStateInput } from '@/features/defense-play/model/defensePlayView/viewStateInput'

/**
 * 한 틱치 화면 스냅샷 만들기 — 모양은 `entities/fielding/model/defenseView`, 화면 결선(라우팅)은 여기 몫이 아니다.
 * 동작 기억(`previousActions`)과 거기 붙은 먼지 자국 칸을 **야수 → 주자 차례로 한 걸음씩 고친다**(그 차례가 곧 기억에 적히는 차례다).
 */
export function viewStateOf(input: ViewStateInput): DefensePlayView {
  const fielders = input.fielders.map((fielder) => recordFielderView(fielder, input))
  const runners = input.runners.map((runner) => recordRunnerView(runner, input))
  return {
    tick: input.tick,
    ball: ballViewOf(input),
    fielders,
    runners,
    // 필살 포구 번쩍임(deadly_effect B · C)은 진행기가 연출 단계 기계로 그린 그림에만 싣는다 (`defenseScene`)
    flash: null,
    // 레이저 반짝임은 그릴 칸 하나로 끝이다 — 고르는 조건은 진행기 몫이다(0x43406~0x4342c)
    laserShiningSlot: laserShiningSlotOf(input.laserShiningSlot),
    cameraTarget: null,
    homeRunFlag: input.homeRunFlag === true,
    poleHomeRunFlag: input.poleHomeRunFlag === true,
    cameraFrozen: input.cameraFrozen === true,
    runnerAceSprite: input.runnerAceSprite ?? null,
    laserTrailFrom: input.laserTrailFrom == null ? null : { x: input.laserTrailFrom.x, z: input.laserTrailFrom.z, height: input.laserTrailFrom.y },
    holderMark: input.holderMark ?? null,
    holderPlate: input.holderMark == null ? null : (input.holderPlate ?? null),
    ballParticles: input.ballParticles ?? null,
    ...(input.sceneResultCode === undefined ? {} : { sceneResultCode: input.sceneResultCode }),
  }
}

/** 공 칸 — 안 준 표시는 모두 거짓, 재생 틱은 1(그린다)로 본다 */
function ballViewOf(input: ViewStateInput): DefensePlayView['ball'] {
  return {
    x: input.ball.x,
    z: input.ball.z,
    height: input.ball.y,
    isFlying: input.ballIsFlying,
    isStopped: input.ballStopped === true,
    isHeld: input.ballHeld === true,
    isBeyondFence: input.ballBeyondFence === true,
    isPlaybackStart: (input.ballPlaybackTick ?? 1) <= 0,
  }
}
