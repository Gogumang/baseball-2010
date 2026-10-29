import type { ParticleScene } from '@/entities/particle/model/particleScene'
import type { DrawnFieldingError } from '@/features/defense-play/model/fieldingErrors'
import { defensePlayResultOf, type DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { endDefenseEffects, sceneMemoryOf, type DefenseSceneMemory } from '@/pages/defense/lib/defenseHomeRunEffects'
import type { LivePlaybackSlots } from '@/pages/defense/ui/playback/livePlaybackSlots'

interface FinishContext {
  readonly ended: boolean
  readonly sceneMemory?: { current: DefenseSceneMemory }
  readonly particles: ParticleScene
  readonly onDone: (result?: DefensePlayResult) => void
  readonly onFieldingErrors?: (errors: readonly DrawnFieldingError[]) => void
}

/**
 * 판 끝(0x35108)을 한 번만 알린다 — 판이 끝난 뒤에도 남는 그림(0x1c)이 다시 그려져도 판마다 한 번. 0x17 끝 0x35108 이 글자를 끄고
 * 파티클을 치운다. 장면에 남는 칸(글자 칸 · +0x36)은 부르는 쪽 ref 로 돌려주고, 실책은 `onDone` 바로 앞에 넘긴다
 */
export function finishLivePlay(slots: LivePlaybackSlots, ctx: FinishContext): void {
  if (!ctx.ended || slots.doneFor === slots.state) return
  slots.doneFor = slots.state
  slots.effects = endDefenseEffects(slots.effects, ctx.particles)
  if (ctx.sceneMemory !== undefined) storeDefenseSceneMemory(ctx.sceneMemory, sceneMemoryOf(slots.effects))
  const state = slots.state
  if (slots.drawnErrors.length > 0) ctx.onFieldingErrors?.(slots.drawnErrors)
  if (state === null) {
    ctx.onDone(undefined)
    return
  }
  // 판이 닫힌 뒤에 온 사람 송구 키(+0x160)는 다음 판 시작 vt1c 0xb0edc 가 지워 넘어가지 않는다
  ctx.onDone(defensePlayResultOf(state))
}

/** 장면에 남는 칸(글자 칸 · +0x36)을 부르는 쪽 칸에 돌려준다 — 0x17 끝 0x35108 */
function storeDefenseSceneMemory(sceneMemory: { current: DefenseSceneMemory }, memory: DefenseSceneMemory): void {
  sceneMemory.current = memory
}
