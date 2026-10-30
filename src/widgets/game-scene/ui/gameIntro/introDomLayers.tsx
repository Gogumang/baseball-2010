import type { CSSProperties } from 'react'
import { FrameSprite } from '@/shared/ui'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { introBandAlphaOf, type IntroFade } from '@/widgets/game-scene/lib/introSchedule'
import {
  INTRO_BAND,
  INTRO_BAND_RGB,
  INTRO_BAR_FRAME,
  INTRO_BAR_X,
  INTRO_BAR_Y,
  INTRO_STADIUM_LABEL_FRAME,
  INTRO_STADIUM_LABEL_X,
  INTRO_TEAM_NAME_X,
  INTRO_TEXT_Y,
} from '@/widgets/game-scene/lib/introLayout'
import * as styles from '@/widgets/game-scene/ui/GameScene.css'
import { SCOREBOARD_AT, ScoreboardFrame, effectOpacityOf, type ScoreboardSide } from '@/widgets/game-scene/ui/introCanvas/otherSlices'
import { GAME_UI_FRAMES, IMG_TEXT_FRAMES } from '@/widgets/game-scene/ui/introCanvas/placed'

interface IntroDomLayersInput {
  readonly stadiumNameFrame: number
  readonly scoreboardSides: readonly [ScoreboardSide, ScoreboardSide] | undefined
  readonly fade: IntroFade
  readonly effectLevel: number | null
  readonly gameUiOrigins: FrameOrigins | null
  readonly textOrigins: FrameOrigins | null
}

/** 효과 1 의 그림 몫 — 1 이면 스타일 없음 */
const imageStyleOf = (imageOpacity: number): CSSProperties | undefined => (imageOpacity === 1 ? undefined : { opacity: imageOpacity })

/** DOM 근사 — 캔버스로 못 그릴 때(배경 없음 · 그림 받는 중 · 시험 DOM). 컴포넌트가 아니라 부르는 쪽 트리에 그대로 들어간다 */
export function introDomLayersOf({ stadiumNameFrame, scoreboardSides, fade, effectLevel, gameUiOrigins, textOrigins }: IntroDomLayersInput) {
  const imageOpacity = effectOpacityOf(effectLevel)
  const imageStyle = imageStyleOf(imageOpacity)
  const { r, g, b } = INTRO_BAND_RGB
  return (
    <>
      <div
        className={styles.introBand}
        data-testid="인트로-띠"
        style={{
          left: INTRO_BAND.x,
          top: INTRO_BAND.y,
          width: INTRO_BAND.width,
          height: INTRO_BAND.height,
          background: `rgba(${r}, ${g}, ${b}, ${introBandAlphaOf(fade) / 255})`,
        }}
      />
      {imageOpacity > 0 && (
        <>
          <FrameSprite folder={GAME_UI_FRAMES} frame={INTRO_BAR_FRAME} origins={gameUiOrigins} x={INTRO_BAR_X} y={INTRO_BAR_Y} style={imageStyle} />
          <span data-testid="인트로-팀이름" data-frame={stadiumNameFrame}>
            <FrameSprite
              folder={IMG_TEXT_FRAMES}
              frame={stadiumNameFrame}
              origins={textOrigins}
              x={INTRO_TEAM_NAME_X}
              y={INTRO_TEXT_Y}
              style={imageStyle}
            />
          </span>
          <FrameSprite
            folder={IMG_TEXT_FRAMES}
            frame={INTRO_STADIUM_LABEL_FRAME}
            origins={textOrigins}
            x={INTRO_STADIUM_LABEL_X}
            y={INTRO_TEXT_Y}
            style={imageStyle}
          />
        </>
      )}
      {/* 띠·막대·팀 글씨 뒤에 그린다 (0x419f4) */}
      {scoreboardSides !== undefined && (
        <ScoreboardFrame
          {...SCOREBOARD_AT.intro}
          side0={scoreboardSides[0]}
          side1={scoreboardSides[1]}
          effectLevel={effectLevel}
          introAlpha={fade.alpha}
        />
      )}
    </>
  )
}
