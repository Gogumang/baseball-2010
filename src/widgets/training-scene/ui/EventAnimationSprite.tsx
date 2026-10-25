import { animationStepAt } from '@/widgets/training-scene/lib/animationPlayback'
import type { AnimationEntry, FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { recolorRequestsOf, useRecoloredSprite, useWarmRecoloredSprites } from '@/shared/lib/sprite/paletteSwap'
import * as styles from '@/widgets/training-scene/ui/TrainingScene.css'

/**
 * 훈련 팝업 0x848d0 이 연출 애니 [+0x1c8] · [+0x1c0] · [+0x1c4] 를 한 기준점에 그리는 한 겹 (`0xba169(애니, x, y, 0, 0, 0)`).
 * 시즌 · 나리 외출 연출(0x85074)과 나리 휴식 연출(0x85230)이 같이 쓴다. palette 가 있으면 그 벌로 칠한다(event_char_0.mpl).
 */
export function EventAnimationSprite({ folder, origins, entries, update, anchor, palette = null }: {
  readonly folder: string
  readonly origins: FrameOrigins | null
  readonly entries: readonly AnimationEntry[] | undefined
  readonly update: number
  /** 기준점 ((R.x + R.w)/2, R.y + R.h + d) */
  readonly anchor: { readonly x: number; readonly y: number }
  readonly palette?: number | null
}) {
  // 이 애니의 칸 전부를 미리 칠한다 — 넘어가는 칸마다 구운 벌이 한 박자 비치지 않게 (원본은 적재 때 팔레트를 갈아 끼운다)
  useWarmRecoloredSprites(recolorRequestsOf(folder, (entries ?? []).map((entry) => entry.frame), palette))
  const step = entries === undefined ? null : animationStepAt(entries, update)
  if (step === null) return null
  const key = String(step.frame).padStart(3, '0')
  const origin = origins?.[key]
  if (origin === undefined) return null
  const left = anchor.x + origin.x + step.dx
  const top = anchor.y + origin.y + step.dy
  if (palette !== null) {
    // 프레임마다 따로 마운트한다 — `useRecoloredSprite` 가 앞 프레임 주소를 한 번 내보내지 않게 (CenterStage 와 같다)
    return <RecoloredFrame key={key} url={`${folder}/${key}.png`} palette={palette} left={left} top={top} />
  }
  return <img className={styles.sprite} style={{ left, top }} src={`${folder}/${key}.png`} alt="" />
}

function RecoloredFrame({ url, palette, left, top }: {
  readonly url: string
  readonly palette: number
  readonly left: number
  readonly top: number
}) {
  return <img className={styles.sprite} style={{ left, top }} src={useRecoloredSprite(url, palette)} alt="" />
}
