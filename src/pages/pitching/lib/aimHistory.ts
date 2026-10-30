import type { WorldPoint } from '@/entities/pitching/model/pitchCurve'

/**
 * 조준(0x10) 갱신이 흘린 조준점 기록 — 키는 받은 틱(그때 화면에 있던 그림)에 처리해야 하는데 꺼낸 때가 늦으면 갱신이
 * 더 흘렀다(`AimCursor`). 그 그림의 조준점을 찾는다.
 */
type AimHistory = readonly { readonly tick: number; readonly aim: WorldPoint }[]

/** 본 그림(`seenTick`) 뒤에 갱신이 더 흘렀으면 그 그림의 조준점(앞 기록이 없으면 처음 자리) — 아니면 null */
export function seenAimOf(history: AimHistory, seenTick: number, startAim: WorldPoint): WorldPoint | null {
  if (history.length === 0 || !((history.at(-1)?.tick ?? seenTick) > seenTick)) return null
  let seenAim = startAim
  for (const entry of history) if (entry.tick <= seenTick) seenAim = entry.aim
  return seenAim
}
