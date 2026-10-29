import { redrawDefensePlayScene } from '@/features/defense-play/model/redrawDefensePlay'
import { isDefensePlayFinished, type DefensePlayState } from '@/features/defense-play/model/runDefensePlay'
import { redrawDefenseEffects } from '@/pages/defense/lib/defenseHomeRunEffects'
import { ballShotsAt } from '@/pages/defense/ui/playback/ballParticleRun'
import { drawLiveBoard } from '@/pages/defense/ui/playback/liveBoard'
import { countRedrawnLivePicture } from '@/pages/defense/ui/playback/liveDrawnTicks'
import type { LiveContext, LivePicture, LivePlaybackSlots, LiveScreenSetters } from '@/pages/defense/ui/playback/livePlaybackSlots'
import { lastViewOf } from '@/pages/defense/ui/playback/liveTicks'
import { particleConfigOf } from '@/widgets/particles/lib/particleCatalog'

type RedrawContext = Pick<LiveContext, 'ended' | 'input' | 'runScoreBoard' | 'homeRunHit' | 'particles'> & { readonly redraws: number }
type RedrawSetters = Pick<LiveScreenSetters, 'setView' | 'setEffectsView' | 'setRunBoard'>

/**
 * 창이 선 첫 그림([창+0x250], 52efe) — 갱신 없이 그리기 0x46c88 을 한 번 더 돈다. 앞 그림과 같은 상태를 그리므로 (r183 직접 떴다):
 * ```
 *   0x43278 야수 4381a~43904 — +0xb8 == 6(펌블) · +0xc0 == 4(악송구)를 다시 보고 [+0xec]+0x2e(실책)를 **한 번 더** 올린다 · 함성 29 예약
 *           (+0xb8 · +0xc0 을 줄이는 야수 틱 0xa1284 는 갱신 쪽이라 안 돈다 — 원본 그대로 두 번 센다)
 *           **고침(`bugfixes.json` B-56, 기본 켬)**: 다시 그리기는 실책 · 함성 29 를 안 낸다 — 한 판의 실책은 그린 틱 한 번만 센다.
 *           연출 · 파티클 · 점수판 타이머는 원본대로 한 칸 더(굴림 차례 같음 — 실책 셈 · 함성에는 굴림이 없다)
 *   0x46844 · 0x4403c · 0x441c4 · 0x44398 · 0xbb84c — 연출 한 칸 더 (`redrawDefensePlayScene`)
 *   0x36dfc 공 파티클 다시 쏘기 · 0x40b18 HOMERUN 글자 · 유지면 효과 틱 0x40faa(경기 난수) · 0x41a64 득점 점수판 타이머
 * ```
 * 부착 효과 · 공 가진 야수 고리 애니는 `DefenseScreen` 의 `drawRedraws` 가 센다. 프레임 끝 파티클 틱(53048)은 없다
 */
export function redrawLivePictures(slots: LivePlaybackSlots, ctx: RedrawContext, ui: RedrawSetters): void {
  if (ctx.redraws === slots.redrawn) return
  const pending = ctx.redraws - slots.redrawn
  slots.redrawn = ctx.redraws
  const state = slots.state
  if (ctx.ended || state === null) return
  for (let at = 0; at < pending; at += 1) {
    const picture = slots.lastPicture
    if (picture === null) return
    if (picture.isPlay) redrawPlayPicture(slots, state, picture, ui)
    redrawLiveEffects(slots, ctx, state, picture, ui)
  }
}

/** 판 틱의 그림 — 실책 · 함성(B-56) 다음 연출 한 칸 더 */
function redrawPlayPicture(slots: LivePlaybackSlots, state: DefensePlayState, picture: LivePicture, ui: RedrawSetters): void {
  countRedrawnLivePicture(slots, picture)
  if (isDefensePlayFinished(state)) return
  const redrawn = redrawDefensePlayScene(state)
  if (redrawn === null) return
  slots.lastPicture = { ...picture, view: redrawn }
  ui.setView(redrawn)
}

/** 공 파티클 · HOMERUN 글자 · 효과 틱과 득점 점수판 0x41a64 — 그림마다 타이머를 줄인다 */
function redrawLiveEffects(slots: LivePlaybackSlots, ctx: RedrawContext, state: DefensePlayState, picture: LivePicture, ui: RedrawSetters): void {
  const frame = redrawDefenseEffects(
    slots.effects,
    picture.drawsText,
    { particles: ctx.particles, random: ctx.input.random, configOf: particleConfigOf },
    ballShotsAt(lastViewOf(state), slots.cameraOffsetRef.current),
  )
  slots.effects = frame.effects
  ui.setEffectsView((previous) => ({ text: frame.text, distanceBoard: frame.distanceBoard, version: previous.version + 1 }))
  ui.setRunBoard(drawLiveBoard(slots, ctx, state.held.scoreboardRuns))
}
