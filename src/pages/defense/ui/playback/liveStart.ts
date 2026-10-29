import type { ControlSide } from '@/entities/defense-controls/model/defenseKeys'
import { clearParticles } from '@/entities/particle/model/particleScene'
import { startDefensePlay, type DefensePlayInput } from '@/features/defense-play/model/runDefensePlay'
import { DEFENSE_SCENE_START, defenseEffectsOf } from '@/pages/defense/lib/defenseHomeRunEffects'
import { EMPTY_HOME_RUN_SCORE_BOARD } from '@/pages/defense/lib/runScoreBoard'
import { newSceneKeyQueue } from '@/pages/defense/ui/playback/keyQueue'
import type { LiveContext, LivePlaybackSlots, LiveScreenSetters } from '@/pages/defense/ui/playback/livePlaybackSlots'

/** 타구나 사람이 잡은 쪽이 바뀌었나 — 바뀌면 판을 새로 연다 */
export function isNewLivePlay(slots: LivePlaybackSlots, ctx: LiveContext): boolean {
  return slots.builtFrom !== ctx.input || slots.builtSide !== ctx.side
}

/**
 * 판을 새로 연다 — 진행기 · 키 줄 · 셈 · 연출 칸을 비우고 화면 상태도 처음으로. 앱 전역 파티클 관리자 [0x1400068] 는 0x17 진입 0x46418 이
 * 4673e 에서 비운다(0x6dee4) — 타석 화면(0x11 · 0x13)의 타격 불꽃 · 메뉴에서 남은 이미터는 여기로 안 이어진다
 */
export function startLivePlay(slots: LivePlaybackSlots, ctx: LiveContext, ui: LiveScreenSetters): void {
  const { input, side, update, sceneMemory, particles } = ctx
  slots.builtFrom = input
  slots.builtSide = side
  slots.state = startDefensePlay(withSide(input, side))
  slots.startedAt = update
  slots.keys = newSceneKeyQueue()
  slots.drawnErrors = []
  slots.seenTickCount = 0
  slots.board = EMPTY_HOME_RUN_SCORE_BOARD
  slots.closedCount = 0
  slots.effects = defenseEffectsOf(sceneMemory?.current ?? DEFENSE_SCENE_START)
  clearParticles(particles)
  slots.closedUpdate = null
  slots.closingFrame = null
  slots.cameraOffsetRef.current = null
  slots.lastPicture = null
  ui.setEnded(false)
  ui.setClosed(false)
  ui.setView(null)
  ui.setRunBoard(null)
  ui.setEffectsView({ text: null, distanceBoard: null, version: 0 })
}

/**
 * 사람이 잡은 쪽을 진행기에 알려 준다 — 조작 객체 `[+0xc]`.
 *
 * `keyAt` 은 **부르지 않는다**: 실시간 갈래는 눌린 키를 `stepDefensePlay` 의 인자로 바로 넘긴다.
 * 그래도 `controls` 자체는 있어야 진행기가 "사람이 조작한다" 로 보고 키 갈래를 연다.
 */
function withSide(input: DefensePlayInput, side?: ControlSide): DefensePlayInput {
  if (side === undefined) return input
  return {
    ...input,
    controls: { side, keyAt: () => null },
  }
}
