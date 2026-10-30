import { MarkupText } from '@/shared/ui'
import { useAnimations, useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { animationStepAt } from '@/shared/lib/sprite/animationPlayback'
import { recolorRequestsOf, useWarmRecoloredSprites } from '@/shared/lib/sprite/paletteSwap'
import { ORIGINAL_ENDINGS } from '@/shared/config/original/endings'
import type { ModeBackSprite } from '@/shared/lib/phoneClock/useModeBackSprite'
import {
  INJURY_ENDING,
  SCREEN,
  SHORT_ENDING_TEXT_TOP,
  WALK_IN,
  endingWalkInAnimationOf,
  endingWalkInPaletteOf,
} from '@/pages/ending/lib/endingLayout'
import type { EndingWalkInLook } from '@/pages/ending/lib/endingLayout'
import * as styles from '@/pages/ending/ui/EndingScreen.css'
import { BandWindow } from '@/pages/ending/ui/endingScreen/BandWindow'
import { FramePiece } from '@/pages/ending/ui/endingScreen/FramePiece'

/** 부상·방출 엔딩 (0x883b6 갈래) — 띠 창 + 걸어 들어오는 선수(+ 부상 아이콘) + StrENDING[e] */
export function ShortEnding({
  endingIndex,
  look,
  tick,
  band,
}: {
  readonly endingIndex: number
  readonly look: EndingWalkInLook
  /** 141 에 들어와 돈 틀 수 n */
  readonly tick: number
  readonly band: ModeBackSprite
}) {
  return (
    <BandWindow band={band}>
      <WalkIn tick={tick} look={look} hasInjuryIcon={endingIndex === INJURY_ENDING} />
      <div className={styles.endingText} style={{ left: 0, top: SHORT_ENDING_TEXT_TOP, width: SCREEN.width }}>
        <MarkupText raw={ORIGINAL_ENDINGS[endingIndex] ?? ''} />
      </div>
    </BandWindow>
  )
}

/**
 * 걸어 들어오는 그림 (S12 7절 · e 0·1) — `event_char_0.pzx` 애니(육성 선수 캐릭터)와 `ui/mode_ui.pzx`
 * 프레임 87(부상 아이콘, 부상 엔딩만)이 오른쪽에서 **3틱에 1px** 씩 온다. `n & 7 == 0` 인 틱만 1px 위로 튄다.
 *
 * 애니 번호는 육성 선수 레코드의 외모 비트가 고른다 — 타자 장타형이면 **8+2**, 그 밖 **0+2** (0x63a5c).
 * 팔레트는 `event_char_0.mpl` 의 `endingWalkInPaletteOf` 벌로 갈아 끼운다 (0x63a92).
 */
function WalkIn({ tick, look, hasInjuryIcon }: { readonly tick: number; readonly look: EndingWalkInLook; readonly hasInjuryIcon: boolean }) {
  const origins = useFrameOrigins(WALK_IN.characterFolder)
  const animations = useAnimations(WALK_IN.characterFolder)
  const iconOrigins = useFrameOrigins(WALK_IN.iconFolder)
  const entries = animations?.[endingWalkInAnimationOf(look)]
  const step = entries === undefined ? null : animationStepAt(entries, tick)
  const palette = endingWalkInPaletteOf(look)
  // 이 애니의 칸 전부를 미리 칠한다 — 넘어가는 칸마다 구운 벌이 한 박자 비치지 않게 (원본은 적재 때 팔레트를 갈아 끼운다)
  useWarmRecoloredSprites(
    recolorRequestsOf(
      WALK_IN.characterFolder,
      (entries ?? []).map((entry) => entry.frame),
      palette,
    ),
  )

  return (
    <div data-palette={palette} data-animation={endingWalkInAnimationOf(look)}>
      {step !== null && (
        <FramePiece
          folder={WALK_IN.characterFolder}
          frame={step.frame}
          origins={origins}
          palette={palette}
          x={WALK_IN.xOf(tick, WALK_IN.characterDx) + step.dx}
          y={WALK_IN.characterYOf(tick) + step.dy}
        />
      )}
      {hasInjuryIcon && (
        <FramePiece
          folder={WALK_IN.iconFolder}
          frame={WALK_IN.iconFrame}
          origins={iconOrigins}
          x={WALK_IN.xOf(tick, WALK_IN.iconDx)}
          y={WALK_IN.iconYOf(tick)}
        />
      )}
    </div>
  )
}
