import type { CSSProperties } from 'react'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'
import { animationStepAt } from '@/shared/lib/sprite/animationPlayback'
import { flippedFrameUrlOf, frameCopiesUrl, hasFrameCopies } from '@/shared/lib/sprite/frameCopies'
import { useAnimations, useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useSpriteJson } from '@/shared/lib/sprite/useSpriteJson'
import { burstPortraitOf } from '@/widgets/burst-mission/lib/burstMissionWindowLayout'
import * as styles from '@/widgets/burst-mission/ui/BurstMissionWindow.css'

type PortraitAnchor = { readonly x: number; readonly y: number; readonly isFlipped: boolean }
type PortraitStep = NonNullable<ReturnType<typeof animationStepAt>>
type PortraitOrigin = NonNullable<FrameOrigins[string]>

/** 0x8f29c 초상 — 0x63a04 애니를 그린 뒤 한 칸 나아간다(되풀이) */
export function BurstPortrait({
  speaker,
  expression,
  draws,
  anchor,
}: {
  readonly speaker: number
  readonly expression: number
  readonly draws: number
  readonly anchor: PortraitAnchor
}) {
  const portrait = burstPortraitOf(speaker, expression)
  const folder = assetUrl(`./sprites/${portrait?.file ?? 'event_char_0'}/frames`)
  const origins = useFrameOrigins(folder)
  const animations = useAnimations(folder)
  // 좌타는 깃발 0x11 로 그린다(0x8f310~) — 0xc9f98 ca07c 갈래라 0x66 반투명 파트(볼터치)도 섞지 않고 복사한 판(`frameCopies`)
  const copies = useSpriteJson<unknown>(anchor.isFlipped && hasFrameCopies(folder) ? frameCopiesUrl(folder) : null)
  const placed = portrait === null ? null : placedPortraitOf(animations?.[portrait.animation], draws, origins)
  if (placed === null) return null
  const { step } = placed
  return (
    <img
      className={styles.sprite}
      style={portraitStyleOf(anchor, placed)}
      src={portraitSrcOf(folder, step.frame, anchor.isFlipped, copies)}
      alt=""
      data-frame={step.frame}
    />
  )
}

/** 뒤집어 그리면 복사판 목록(`copy.json`)에 든 프레임은 복사판, 아니면 구운 프레임 */
function portraitSrcOf(folder: string, frame: number, isFlipped: boolean, copies: unknown): string {
  return isFlipped ? flippedFrameUrlOf(folder, frame, copies) : `${folder}/${String(frame).padStart(3, '0')}.png`
}

/** 그린 수 `draws` 의 애니 칸과 그 프레임 원점 — 애니 · 원점이 아직이면 null */
function placedPortraitOf(
  entries: Parameters<typeof animationStepAt>[0] | undefined,
  draws: number,
  origins: FrameOrigins | null,
): { readonly step: PortraitStep; readonly origin: PortraitOrigin } | null {
  const step = entries === undefined ? null : animationStepAt(entries, draws)
  if (step === null) return null
  const origin = origins?.[String(step.frame).padStart(3, '0')]
  if (origin === undefined) return null
  return { step, origin }
}

/** 기준점 + 칸 비킴 — 뒤집으면 원점을 거울로 놓는다 */
function portraitStyleOf(anchor: PortraitAnchor, { step, origin }: { readonly step: PortraitStep; readonly origin: PortraitOrigin }): CSSProperties {
  const x = anchor.x + step.dx
  const y = anchor.y + step.dy
  return anchor.isFlipped
    ? { left: x - origin.x - origin.width, top: y + origin.y, transform: 'scaleX(-1)' }
    : { left: x + origin.x, top: y + origin.y }
}
