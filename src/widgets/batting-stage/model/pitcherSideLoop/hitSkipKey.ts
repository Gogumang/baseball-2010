/**
 * 큰 타구 0x13 건너뛰기 — 0x406e8 40708~40712 이 [장면+0x40](이 틀 키)가 OK(−5) · '5'(0x35) 면 넘긴다. 공격 측을 안 본다.
 * 키는 받은 다음 틀 머리(진입 뒤 · 갱신 앞, 0x498d4)에서 꺼낸다(`sceneKeyLatch`). 터치 기기는 넘길 수 있는 동안만 '넘기기' 상황
 * 버튼을 띄운다(타자편은 캔버스 탭이 OK 지만 투수편 캔버스는 탭을 안 받는다 — r186). 버튼은 Enter 키 사건이라 키보드와 같은 길이다
 */
import { KEY_OK, originalKeyCodeOf } from '@/features/play-pitcher-game/model/pitchAim'
import { runSceneKeys } from '@/shared/lib/sceneKeyLatch/sceneKeyLatch'
import { canSkipHitPause } from '@/widgets/batting-stage/lib/hitPause'
import type { PitcherSideLoop } from '@/widgets/batting-stage/model/pitcherSideLoop/pitcherSideLoop'
import type { PitcherSideStageProps } from '@/widgets/batting-stage/model/pitcherSideLoop/pitcherSideProps'
import type { PitcherSideFrame } from '@/widgets/batting-stage/model/pitcherSideLoop/pitcherSideFrame'

/** 원본 키 코드 '5' */
const KEY_FIVE = 0x35

/** 지금 공의 0x13 을 건너뛸 수 있는 공인가 — 맞은 큰 타구이고 아직 0x17 을 안 알렸다 */
function isHitSkippable(loop: PitcherSideLoop): boolean {
  const hit = loop.marks.hit
  return hit !== null && !loop.marks.endNotified && canSkipHitPause(hit.watchesBigHit)
}

/** 창의 keydown 처리기 — OK · '5' 를 받아 다음 틀 머리의 키 처리에 맡긴다 */
export function createHitSkipKeyHandler(loop: PitcherSideLoop): (event: KeyboardEvent) => void {
  return (event) => {
    if (event.repeat || !isHitSkippable(loop)) return
    const code = originalKeyCodeOf(event.key)
    if (code !== KEY_OK && code !== KEY_FIVE) return
    event.preventDefault()
    loop.hitKeyLatch.push(() => {
      // 키 처리는 진입 뒤 · 갱신 앞 — 이 틀의 0x13 갱신이 읽는다. 0x13 을 예약한 틀(J)에 누른 키도 다음 틀(틱 0)이 읽는다
      if (loop.marks.skipTick === null && loop.keyHitTick !== null) loop.marks.skipTick = loop.keyHitTick
    })
  }
}

/** 52d9e 키 0x498d4 — 받아 둔 키를 꺼낸다. 팝업(0x52cc6)이 선 틀의 키는 버린다 */
export function runHitSkipKeys(loop: PitcherSideLoop, current: PitcherSideStageProps, sceneTick: number): void {
  if (current.isFrozen === true) loop.hitKeyLatch.clear()
  else runSceneKeys(loop.hitKeyLatch, sceneTick)
}

/** '넘기기' 상황 버튼 — 넘길 수 있는 0x13 이고 아직 키를 안 읽었으면 띄운다. 바뀔 때만 알린다 */
export function applyHitSkipOffer(loop: PitcherSideLoop, frame: PitcherSideFrame): void {
  const hitBase = frame.hitBase
  const canSkipNow =
    hitBase !== null && loop.keyHitTick !== null && !loop.marks.endNotified && loop.marks.skipTick === null && canSkipHitPause(hitBase.watchesBigHit)
  if (canSkipNow === loop.hitSkipOffered) return
  loop.hitSkipOffered = canSkipNow
  loop.offerHitSkip(canSkipNow)
}
