import { MarkupText } from '@/shared/ui'
import { useAnimations, useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { animationStepAt } from '@/shared/lib/sprite/animationPlayback'
import { recolorRequestsOf, useWarmRecoloredSprites } from '@/shared/lib/sprite/paletteSwap'
import { ORIGINAL_ENDINGS } from '@/shared/config/original/endings'
import type { ModeBackSprite } from '@/shared/lib/phoneClock/useModeBackSprite'
import { BAND_WINDOW, CREDITS, SCREEN, creditsTopOf, creditsWalkersOf, endingWalkInPaletteOf } from '@/pages/ending/lib/endingLayout'
import type { CreditsWalker, EndingWalkInLook } from '@/pages/ending/lib/endingLayout'
import * as styles from '@/pages/ending/ui/EndingScreen.css'
import { BandWindow } from '@/pages/ending/ui/endingScreen/BandWindow'
import { FramePiece } from '@/pages/ending/ui/endingScreen/FramePiece'

/** 20틱 구간 — 짝수 구간은 깃발 0x11(뒤집기), 홀수는 0 (0x88dd4~0x88dee) */
const TURN_TICKS = 20

/** 제작진 인물 하나 — 애니를 돌리며 띠 아래(196)에 선다 (0x88d8c~0x88e8a) */
function CreditsWalkerSprite({
  walker,
  tick,
  playerPalette,
}: {
  readonly walker: CreditsWalker
  readonly tick: number
  readonly playerPalette: number
}) {
  const origins = useFrameOrigins(walker.folder)
  const animations = useAnimations(walker.folder)
  const entries = animations?.[walker.animation]
  // 선수 인물만 칠한다 — 그 애니의 칸 전부를 미리 칠해 넘어가는 칸에 구운 벌이 비치지 않게
  useWarmRecoloredSprites(
    recolorRequestsOf(
      walker.folder,
      (entries ?? []).map((entry) => entry.frame),
      walker.isPlayer ? playerPalette : null,
    ),
  )
  const step = entries === undefined ? null : animationStepAt(entries, tick)
  if (step === null) return null
  const isFlipped = walker.turnsEvery20 ? Math.trunc(tick / TURN_TICKS) % 2 === 0 : walker.isFlipped
  return (
    <FramePiece
      folder={walker.folder}
      frame={step.frame}
      origins={origins}
      palette={walker.isPlayer ? playerPalette : null}
      isFlipped={isFlipped}
      x={walker.x + step.dx}
      y={BAND_WINDOW.y + BAND_WINDOW.height + step.dy}
    />
  )
}

/**
 * 제작진 `0x88bb4` (단계 3) — 띠 창 + 선수와 본 연애 상대들 + `"!C" + StrENDING[9 + c] + "!N"×8 + StrENDING[21]` 이
 * `(0, H − n/2, W)` 로 올라온다. 띠 아래 20px 밑으로만 보인다 (0xbaf6d 잘라내기).
 * 인물은 나중 번호부터 그려 선수가 맨 앞이다.
 */
export function EndingCredits({
  romanceEndingIndex,
  romanceEvents,
  look,
  tick,
  band,
}: {
  readonly romanceEndingIndex: number
  readonly romanceEvents: readonly number[]
  readonly look: EndingWalkInLook
  /** 단계 3 에 들어와 돈 틀 수 — 0x1bf9a 가 n 을 0 으로 되돌린다 */
  readonly tick: number
  readonly band: ModeBackSprite
}) {
  const walkers = creditsWalkersOf(look, romanceEvents)
  const credits = `!C${ORIGINAL_ENDINGS[romanceEndingIndex] ?? ''}${'!N'.repeat(CREDITS.gapLines)}${ORIGINAL_ENDINGS[CREDITS.index] ?? ''}`
  const palette = endingWalkInPaletteOf(look)
  return (
    <BandWindow band={band}>
      <div data-part="credits-walkers">
        {[...walkers].reverse().map((walker, index) => (
          <CreditsWalkerSprite key={walkers.length - 1 - index} walker={walker} tick={tick} playerPalette={palette} />
        ))}
      </div>
      <div className={styles.creditsClip} style={{ left: 0, top: CREDITS.clipTop, width: SCREEN.width, height: SCREEN.height - CREDITS.clipTop }}>
        <div className={styles.creditsText} style={{ left: CREDITS.x, top: creditsTopOf(tick) - CREDITS.clipTop, width: CREDITS.width }}>
          <MarkupText raw={credits} />
        </div>
      </div>
    </BandWindow>
  )
}
