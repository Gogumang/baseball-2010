import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useSpriteJson } from '@/shared/lib/sprite/useSpriteJson'
import { DRAW_EFFECT } from '@/shared/lib/pixelEffect/pixelEffect'
import { frameLayersUrl, frameLayerUrl, hasFrameLayers, type FrameLayerListing } from '@/shared/lib/sprite/frameLayers'
import { EffectImage } from '@/shared/ui/EffectImage/EffectImage'
import { FrameSprite } from '@/shared/ui/FrameSprite/FrameSprite'
import * as styles from '@/shared/ui/FrameSprite/FrameSprite.css'

interface LayeredFrameSpriteProps {
  readonly folder: string
  readonly frame: number
  readonly origins: FrameOrigins | null
  /** 프레임 원점이 놓일 화면 좌표 */
  readonly x: number
  readonly y: number
}

/** 검정 바탕 위 효과 2 = (그림 · b) >> 8 — 그 칸을 `plus-lighter` 로 뒤 화면에 더하면 원본 식 `화면 + (그림 · b) >> 8` 이다 */
const ADDITIVE_BACKDROP = '#000000'

/**
 * **DOM 위의 PZX 합성 프레임 — 부른 쪽 효과 0** (0xc9f98 ca198): 0x67 파트가 든 프레임이면 겹 목록(`frames/layers.json`)대로
 * 보통 겹은 그대로, 0x67 겹은 화면에 **더한다**(픽셀 효과 2 = 0x9a2f1 · 팔레트판 0x973c5). 그 밖의 프레임 · 목록이 아직이면 구운 프레임.
 *
 * 더하기는 아래 DOM 을 읽어야 하므로 `EffectImage`(효과 2 · 검정 바탕 = 그림 · b >> 8, 565 내림까지)를
 * `mix-blend-mode: plus-lighter`(채널마다 화면 + 칸, 끝에서 자름)로 얹는다 — `SceneParticleLayer` 와 같은 길.
 * ⚠️ 근사: 원본은 565 칸끼리 더하고 웹은 8비트로 펼친 값끼리 더해 채널마다 1 안팎 다를 수 있다.
 * 섞기는 가장 가까운 쌓임 맥락 안에서만 일어난다 — 부르는 쪽은 이 그림과 아래 화면 사이에 z-index · opacity 겹을 두지 말아야 한다.
 */
export function LayeredFrameSprite({ folder, frame, origins, x, y }: LayeredFrameSpriteProps) {
  const listing = useSpriteJson<FrameLayerListing>(hasFrameLayers(folder) ? frameLayersUrl(folder) : null)
  const entries = listing?.[String(frame).padStart(3, '0')]
  if (entries === undefined) return <FrameSprite folder={folder} frame={frame} origins={origins} x={x} y={y} />
  return (
    <>
      {entries.map((entry, order) =>
        entry.effect === DRAW_EFFECT.ADDITIVE ? (
          <EffectImage key={order} className={styles.sprite} src={frameLayerUrl(folder, entry)} effect={DRAW_EFFECT.ADDITIVE}
            argument={entry.argument ?? 0} backdrop={ADDITIVE_BACKDROP}
            style={{ left: x + entry.x, top: y + entry.y, mixBlendMode: 'plus-lighter' }} />
        ) : (
          <img key={order} className={styles.sprite} src={frameLayerUrl(folder, entry)} alt=""
            style={{ left: x + entry.x, top: y + entry.y }} />
        ),
      )}
    </>
  )
}
