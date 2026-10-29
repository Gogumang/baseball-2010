/** 사람 투구 UI 그리기 공용 — 프레임 상자 표 · 효과 0 프레임 · 반복 없는 애니 */
import { noteAssetLoaded } from '@/shared/lib/sprite/assetLoadVersion'
import { fetchSpriteJson } from '@/shared/lib/sprite/spriteJsonBundle'
import { drawFrameAt } from '@/widgets/batting-stage/lib/spriteLoader'
import type { StageAnimationEntry } from '@/widgets/batting-stage/lib/spriteLoader'

const boxesCache = new Map<string, Readonly<Record<string, readonly (readonly number[])[]>> | null>()
export function frameBoxes(folder: string): Readonly<Record<string, readonly (readonly number[])[]>> | null {
  const cached = boxesCache.get(folder)
  if (cached !== undefined) return cached
  boxesCache.set(folder, null)
  // 스프라이트 JSON 묶음에서 꺼낸다(없으면 낱개 파일) — 못 받으면 예전처럼 null (r311 A5)
  void (fetchSpriteJson(`${folder}/boxes.json`) as Promise<Readonly<Record<string, readonly (readonly number[])[]>>>)
    .catch(() => null)
    .then((data) => {
      boxesCache.set(folder, data)
      noteAssetLoaded()
    })
    .catch(() => boxesCache.set(folder, null))
  return null
}

/**
 * 효과 0 으로 그리는 칸 — 고리(slt_pitch 애니 1 · 4d602 0xbe8a5 효과 r5 = 0)와 퍼펙트(game_effect 애니 0 · 4d624 효과 0)의
 * 0x67 파트는 화면에 더한다(0xc9f98 ca198 · `drawFrameAt`)
 */
export function drawFrame(context: CanvasRenderingContext2D, folder: string, index: number, x: number, y: number): void {
  drawFrameAt(context, folder, index, Math.round(x), Math.round(y))
}

/** 반복 없는 애니의 칸 — 끝 칸에 멈춘다 */
export function onceStepAt(entries: readonly StageAnimationEntry[], update: number): StageAnimationEntry | null {
  let remaining = Math.max(0, update)
  for (const entry of entries) {
    const length = Math.max(1, entry.delay)
    if (remaining < length) return entry
    remaining -= length
  }
  return entries[entries.length - 1] ?? null
}

export function onceLength(entries: readonly StageAnimationEntry[]): number {
  return entries.reduce((sum, entry) => sum + Math.max(1, entry.delay), 0)
}
