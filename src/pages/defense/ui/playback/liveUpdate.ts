import type { DefenseViewState } from '@/entities/fielding/model/defenseView/defenseViewState'
import type { InPlayRunnerSituation } from '@/features/defense-play/model/inPlayTouchKeys'
import { offenseOffersFor } from '@/features/defense-play/model/inPlayTouchKeys'
import { isDefensePlayFinished, type DefensePlayState } from '@/features/defense-play/model/runDefensePlay'
import type { DefenseEffectsPorts } from '@/pages/defense/lib/defenseHomeRunEffects'
import { drawClosedUpdates, takeClosedFastForwardKeys } from '@/pages/defense/ui/playback/liveClosed'
import type { LiveContext, LivePlaybackSlots, LiveScreenSetters } from '@/pages/defense/ui/playback/livePlaybackSlots'
import { isNewLivePlay, startLivePlay } from '@/pages/defense/ui/playback/liveStart'
import { stepLiveTicks, type LiveFrame } from '@/pages/defense/ui/playback/liveTicks'
import { UPDATES_PER_TICK } from '@/pages/defense/ui/playback/playbackClock'
import { isCommonWindowShown } from '@/shared/lib/commonWindow/commonWindow'
import { particleConfigOf } from '@/widgets/particles/lib/particleCatalog'

/**
 * **실시간 타구 판 한 갱신** (갱신 계수가 오른 그림의 effect) — 판이 바뀌었으면 새로 열고, 이 갱신까지 진행기를 돌리고(`stepLiveTicks`),
 * 판이 닫혔으면 닫힌 갱신(+0x1094 셈 — `drawClosedUpdates`)을 지나, 화면 상태를 옛 차례대로 고친다
 */
export function runLiveUpdate(slots: LivePlaybackSlots, ctx: LiveContext, ui: LiveScreenSetters): void {
  const state = openedLiveState(slots, ctx, ui)
  if (state === null) return
  // 한 갱신 = 한 틱. 프레임을 건너뛴 만큼은 따라잡는다
  const wanted = Math.floor((ctx.update - slots.startedAt) / UPDATES_PER_TICK) + 1
  const frame: LiveFrame = { running: state, moved: false, board: undefined, effectsFrame: null, skippedNow: false, lastDrawsText: false }
  const ports = livePortsOf(ctx)
  stepLiveTicks(slots, ctx, frame, wanted, ports)
  const running = frame.running
  slots.state = running
  if (ctx.side === '공격') offerRunnerSituation(slots, running, ui)
  // 건너뛰기가 이 그림 안에서 여러 틱을 돌고 판 끝 전에 풀리면(카메라 3f17e) 다음 그림부터는 다시 한 그림에 한 틱이다 — 앞서 돈 틱만큼
  // 시작 갱신을 당겨 갱신 계수가 진행기 틱을 따라잡을 때까지 멈춰 있지 않게 한다
  if (running.tick > wanted) slots.startedAt -= running.tick - wanted
  const endsNow = passClosedUpdates(slots, ctx, frame, ports, ui)
  slots.closedUpdate = ctx.update
  if (frame.moved) showMovedPicture(slots, ctx, frame, ui)
  if (endsNow) {
    endLivePlay(slots, ui)
    return
  }
  showLiveFrame(frame, ui)
}

/** 판이 바뀌었으면 새로 열고 그 진행기를, 이미 끝난 판(0x35108 뒤)이면 null */
function openedLiveState(slots: LivePlaybackSlots, ctx: LiveContext, ui: LiveScreenSetters): DefensePlayState | null {
  if (isNewLivePlay(slots, ctx)) startLivePlay(slots, ctx, ui)
  else if (ctx.ended) return null
  return slots.state
}

/** 이 갱신의 득점 점수판 · 연출 그림을 화면에 */
function showLiveFrame(frame: LiveFrame, ui: LiveScreenSetters): void {
  if (frame.board !== undefined) ui.setRunBoard(frame.board)
  const drawn = frame.effectsFrame
  if (drawn !== null) ui.setEffectsView((previous) => ({ text: drawn.text, distanceBoard: drawn.distanceBoard, version: previous.version + 1 }))
}

/**
 * 53048 — 공용 창 [0x140005c]+9 가 서 있으면 경기 장면 프레임이 관리자 틱 0x6de85 를 건너뛴다(그리기 쪽 0x40faa 효과 틱도 상태 그리기와
 * 함께 건너뛴다 — 52f24). 난수를 안 넘기면 `stepDefenseEffects` 가 두 틱을 안 돈다.
 * 갱신(52cc6)도 멈춘다 — 갱신 계수가 경기 장면 시계로 서므로(`useGameSceneUpdateCounter`) 창이 떠 있는 동안 진행기 틱이 안 돌고,
 * 창이 닫히면 건너뛴 틱을 따라잡지 않고 그 자리에서 이어 돈다
 */
function livePortsOf(ctx: LiveContext): DefenseEffectsPorts {
  return { particles: ctx.particles, random: isCommonWindowShown() ? undefined : ctx.input.random, configOf: particleConfigOf }
}

/**
 * 터치 기기 — 공격 쪽은 진행기의 지금 주자 형편(주자 +0x8c · 플레이 +0x111)으로 그 순간 먹는 키만(`offenseOffersFor`).
 * 남는 키 묶음이 바뀔 때만 다시 그린다
 */
function offerRunnerSituation(slots: LivePlaybackSlots, running: DefensePlayState, ui: Pick<LiveScreenSetters, 'setRunnerSituation'>): void {
  const situation: InPlayRunnerSituation = {
    runners: running.runners.map((runner) => runner.state),
    homeRunFlag: running.homeRunFlag,
  }
  const situationKey = offenseOffersFor(situation)
    .map((offer) => offer.key)
    .join(',')
  if (situationKey === slots.runnerSituationKey) return
  slots.runnerSituationKey = situationKey
  ui.setRunnerSituation(situation)
}

/**
 * 판이 끝났으면 — 닫힌 뒤 온 키(`takeClosedFastForwardKeys`), 그리고 판 끝 → +0x1094 11 번(+0x1100 은 0x519cc 가 내렸다) → 0x35108 이
 * 이 그림 안에서 끝났는지, 아니면 닫힌 갱신을 지난다. 0x35108 로 끝나면 참
 */
function passClosedUpdates(slots: LivePlaybackSlots, ctx: LiveContext, frame: LiveFrame, ports: DefenseEffectsPorts, ui: LiveScreenSetters): boolean {
  const finished = isDefensePlayFinished(frame.running)
  const updateStartTickNow = slots.updateStartTickRef.current
  if (!frame.moved && finished) takeClosedFastForwardKeys(slots, ctx, frame, updateStartTickNow)
  if (frame.skippedNow && finished) return true
  if (frame.moved || !finished) return false
  return drawClosedUpdates(slots, ctx, frame, ports, updateStartTickNow, ui)
}

/** 판 끝 틱이 "G2 만 닫힌 그림" 을 함께 찍었으면 그 그림은 다음(닫힌 첫) 갱신 몫이다. 건너뛰는 동안(+0xfe7)은 그림이 없다 */
function showMovedPicture(slots: LivePlaybackSlots, ctx: LiveContext, frame: LiveFrame, ui: LiveScreenSetters): void {
  const { running } = frame
  const { shown, closing } = movedPicturesOf(running)
  if (closing !== null) slots.closingFrame = closing
  const updateStartTickNow = slots.updateStartTickRef.current
  ui.setViewTick(updateStartTickNow === null ? null : updateStartTickNow + ctx.update)
  ui.setView(shown)
  // 창 첫 그림도 다시 그릴 판 그림이 없다
  slots.lastPicture = shown === null || running.fastForward ? null : { view: shown, isPlay: true, drawsText: frame.lastDrawsText }
}

/** 이 갱신에 보일 판 그림과, 닫힌 첫 갱신 몫으로 미룰 "G2 만 닫힌 그림" */
function movedPicturesOf(running: DefensePlayState): { readonly shown: DefenseViewState | null; readonly closing: DefenseViewState | null } {
  const last = running.ticks[running.ticks.length - 1] ?? null
  if (last?.closingListFrame !== true) return { shown: last, closing: null }
  return { shown: running.ticks[running.ticks.length - 2] ?? null, closing: last }
}

/** 0x35108 — 타이머 [+0x10f8] = 0 · +0x1100 = 0 · 글자 끄기 · 파티클 치우기 (끝 효과는 `liveFinish`) */
function endLivePlay(slots: LivePlaybackSlots, ui: LiveScreenSetters): void {
  slots.lastPicture = null
  slots.board = { ...slots.board, timer: 0, active: false }
  ui.setRunBoard(null)
  ui.setEffectsView((previous) => ({ text: null, distanceBoard: null, version: previous.version + 1 }))
  ui.setEnded(true)
}
