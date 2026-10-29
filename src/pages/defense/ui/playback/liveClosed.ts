import { acceptsFastForwardKey, type DefenseKeyPress, type DefensePlayState } from '@/features/defense-play/model/runDefensePlay'
import { stepDefenseEffects, type DefenseEffectsPorts } from '@/pages/defense/lib/defenseHomeRunEffects'
import { closesDefenseScene } from '@/pages/defense/lib/runScoreBoard'
import { ballShotsAt } from '@/pages/defense/ui/playback/ballParticleRun'
import { takeQueuedPress } from '@/pages/defense/ui/playback/keyQueue'
import { drawLiveBoard } from '@/pages/defense/ui/playback/liveBoard'
import type { LiveContext, LivePlaybackSlots, LiveScreenSetters } from '@/pages/defense/ui/playback/livePlaybackSlots'
import { lastViewOf, portsAt, startLiveFastForward, type LiveFrame } from '@/pages/defense/ui/playback/liveTicks'
import { MAX_CLOSED_CATCH_UP } from '@/pages/defense/ui/playback/playbackClock'

/**
 * 닫힌 뒤(+0x1094 를 세는 갱신)에 온 키도 0x519cc 를 지난다 — 받으면 52b26 이 남은 셈을 이 그림 안에서 다 돈다.
 * 이 그림의 장면 틱보다 앞 틱에 받은 키만 이 그림의 키 처리가 읽는다
 */
export function takeClosedFastForwardKeys(slots: LivePlaybackSlots, ctx: LiveContext, frame: LiveFrame, updateStartTickNow: number | null): void {
  const sceneTick = updateStartTickNow === null ? null : updateStartTickNow + ctx.update
  const arrivedPresses: DefenseKeyPress[] = []
  let press = takeQueuedPress(slots.keys, sceneTick)
  while (press !== null) {
    arrivedPresses.push(press)
    press = takeQueuedPress(slots.keys, sceneTick)
  }
  // 같은 키 처리 0x53420 이 0x587(건너뛰기)보다 먼저 사람 수비 송구 0x533c8 → 0x588 → +0x160 을 적는다 — 닫힌 판이라 쓰는 곳이 없고
  // 다음 판 시작 vt1c 0xb0edc 가 지운다
  if (arrivedPresses.length > 0 && acceptsFastForwardKey(frame.running)) {
    startLiveFastForward(slots, ctx)
    frame.skippedNow = true
  }
}

/**
 * 판이 닫힌 뒤 갱신 — 갱신은 529f0(+0x1094 셈, 판 칸 · 글자 없음), 그리기는 비거리 판 · 득점 점수판, 프레임 끝 파티클 틱.
 * 진행기가 닫은 갱신은 앞에서 돌았다. 갱신을 건너뛴 만큼 따라잡는다(진행기 틱과 같은 상한). 0x35108 로 끝나면 참
 */
export function drawClosedUpdates(
  slots: LivePlaybackSlots,
  ctx: LiveContext,
  frame: LiveFrame,
  ports: DefenseEffectsPorts,
  updateStartTickNow: number | null,
  ui: Pick<LiveScreenSetters, 'setView' | 'setClosed'>,
): boolean {
  const closedFrames = Math.min(ctx.update - (slots.closedUpdate ?? ctx.update - 1), MAX_CLOSED_CATCH_UP)
  for (let index = 0; index < closedFrames; index += 1) {
    slots.closedCount += 1
    showClosedPicture(slots, frame.running, ui)
    if (closesDefenseScene(slots.closedCount, ctx.homeRunHit, slots.board)) return true
    // 닫힌 뒤 그림도 공을 그린다 — 마지막 그림의 공 · 조건 그대로(카메라는 서 있다)
    // 이 닫힌 갱신의 장면 틱 — 따라잡는 갱신은 지금 갱신에서 거꾸로 센다
    const closedSceneTick = updateStartTickNow === null ? null : updateStartTickNow + ctx.update - (closedFrames - 1 - index)
    const drawn = stepDefenseEffects(
      slots.effects,
      null,
      portsAt(ports, closedSceneTick),
      ballShotsAt(lastViewOf(frame.running), slots.cameraOffsetRef.current),
    )
    frame.effectsFrame = drawn
    slots.effects = drawn.effects
    frame.board = drawLiveBoard(slots, ctx, frame.running.held.scoreboardRuns)
  }
  return false
}

/**
 * 닫힌 첫 갱신이 G2 만 닫힌 그림이면 그 그림(목록 틱 · 카메라 한 걸음)을 그리고, 그 뒤 갱신부터 카메라가 선다.
 * 닫힌 뒤 그림 — 창 첫 그림이 다시 그리면 공 · 득점 점수판만 다시 돈다(연출 · 실책은 진행기 틱 그림 몫)
 */
function showClosedPicture(slots: LivePlaybackSlots, running: DefensePlayState, ui: Pick<LiveScreenSetters, 'setView' | 'setClosed'>): void {
  const closing = slots.closingFrame
  const isClosingPicture = closing !== null && slots.closedCount === 1
  if (isClosingPicture) ui.setView(closing)
  else ui.setClosed(true)
  const closedView = isClosingPicture ? closing : lastViewOf(running)
  slots.lastPicture = closedView === undefined ? null : { view: closedView, isPlay: false, drawsText: false }
}
