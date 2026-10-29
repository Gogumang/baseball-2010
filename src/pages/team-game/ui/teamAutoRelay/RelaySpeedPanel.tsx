import { ComposedOverlay, FrameSprite } from '@/shared/ui'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { effectOpacityOf } from '@/widgets/scoreboard-frame/lib/scoreboardFrameLayout'
import {
  ARROW_IMAGE,
  ARROW_SIZE,
  ARROW_Y,
  GAME_UI_FRAMES,
  GUIDE_FRAME,
  IMG_TEXT_FRAMES,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  SPEED_LABEL_FRAME,
  SPEED_LABEL_Y,
  SPEED_MARK_DIM_EFFECT_LEVEL,
  SPEED_MARK_INDEXES,
  SPEED_MARKS_Y,
  SPEED_PLATE_EFFECT_LEVEL,
  SPEED_PLATE_FRAME,
  SPEED_PLATE_Y,
  gameUiImageSrc,
  imageStyle,
} from './relayLayout'
import { SpeedPressAreas } from './SpeedPressAreas'
import { SPEED_MARKS_X, dimSpeedMarkOpsOf, fieldUnderOpsOf, speedMarkXOf, speedPlateOpsOf } from './relaySpeedOps'

const originOf = (origins: FrameOrigins | null, frame: number) => origins?.[String(frame).padStart(3, '0')]

/** 장면틱 % 8 ≤ 4 — 좌우 화살표가 보이는 그림 */
const isArrowShownAt = (sceneTick: number) => sceneTick % 8 <= 4

/** 안내 띠 game_ui 92 (W/2 − w/2, H − h − 1) · 속도 칸 바탕 프레임 33 (효과 1, 0xc — 운동장 위에 원본 식으로 섞는다) */
function SpeedPlate({ gameUiOrigins, fieldUrl }: { readonly gameUiOrigins: FrameOrigins | null; readonly fieldUrl: string }) {
  const guide = originOf(gameUiOrigins, GUIDE_FRAME)
  const plate = originOf(gameUiOrigins, SPEED_PLATE_FRAME)
  const plateX = SCREEN_WIDTH / 2 - Math.trunc((plate?.width ?? 0) / 2)
  const plateOps = speedPlateOpsOf(gameUiOrigins, plateX)
  return (
    <>
      {guide !== undefined && (
        <FrameSprite
          folder={GAME_UI_FRAMES}
          frame={GUIDE_FRAME}
          origins={gameUiOrigins}
          x={SCREEN_WIDTH / 2 - Math.trunc(guide.width / 2)}
          y={SCREEN_HEIGHT - guide.height - 1}
        />
      )}
      {plate !== undefined && plateOps[0] !== undefined && (
        <ComposedOverlay
          testId="중계-속도칸"
          rect={{ x: plateOps[0].x, y: plateOps[0].y, width: plate.width, height: plate.height }}
          underOps={fieldUnderOpsOf(fieldUrl)}
          ops={plateOps}
          fallback={
            <FrameSprite
              folder={GAME_UI_FRAMES}
              frame={SPEED_PLATE_FRAME}
              origins={gameUiOrigins}
              x={plateX}
              y={SPEED_PLATE_Y}
              style={{ opacity: effectOpacityOf(SPEED_PLATE_EFFECT_LEVEL) }}
            />
          }
        />
      )}
    </>
  )
}

/** 42e7c~42efa — 세모 세 개를 효과 (1, 6) 으로 깐 뒤 i ≤ v 만 효과 0 으로 한 번 더 */
function SpeedMarks({ speed, fieldUrl }: { readonly speed: number; readonly fieldUrl: string }) {
  const markSrc = gameUiImageSrc(ARROW_IMAGE)
  return (
    <>
      <ComposedOverlay
        testId="중계-속도세모"
        rect={{ x: SPEED_MARKS_X, y: SPEED_MARKS_Y, width: 3 * ARROW_SIZE.width + 2, height: ARROW_SIZE.height }}
        underOps={fieldUnderOpsOf(fieldUrl)}
        ops={dimSpeedMarkOpsOf()}
        fallback={SPEED_MARK_INDEXES.filter((index) => index > speed).map((index) => (
          <img
            key={index}
            alt=""
            src={markSrc}
            style={imageStyle(speedMarkXOf(index), SPEED_MARKS_Y, { opacity: effectOpacityOf(SPEED_MARK_DIM_EFFECT_LEVEL) })}
          />
        ))}
      />
      {SPEED_MARK_INDEXES.filter((index) => index <= speed).map((index) => (
        <img key={index} alt="" data-lit src={markSrc} style={imageStyle(speedMarkXOf(index), SPEED_MARKS_Y)} />
      ))}
    </>
  )
}

/**
 * 속도 칸 — 모드 ∈ {1,2,8,9} 면 속도와 상관없이 (42ab2 · 42bbe): 안내 띠 · 속도 칸 바탕 · 속도 글 · 깜빡이는 좌우 화살표 · 세모 세 개.
 * 누름 칸은 질문 창이 떠 있으면 없다
 */
export function RelaySpeedPanel({
  speed,
  sceneTick,
  isAsking,
  gameUiOrigins,
  textOrigins,
  fieldUrl,
}: {
  readonly speed: number
  readonly sceneTick: number
  readonly isAsking: boolean
  readonly gameUiOrigins: FrameOrigins | null
  readonly textOrigins: FrameOrigins | null
  readonly fieldUrl: string
}) {
  const label = originOf(textOrigins, SPEED_LABEL_FRAME)
  const labelWidth = label?.width ?? 0
  const markSrc = gameUiImageSrc(ARROW_IMAGE)
  return (
    <div data-testid="중계-속도" data-speed={speed}>
      <SpeedPlate gameUiOrigins={gameUiOrigins} fieldUrl={fieldUrl} />
      {label !== undefined && (
        <FrameSprite
          folder={IMG_TEXT_FRAMES}
          frame={SPEED_LABEL_FRAME}
          origins={textOrigins}
          x={SCREEN_WIDTH / 2 - Math.trunc(labelWidth / 2)}
          y={SPEED_LABEL_Y}
        />
      )}
      {isArrowShownAt(sceneTick) && (
        <>
          <img alt="" src={markSrc} style={imageStyle(SCREEN_WIDTH / 2 - Math.trunc(labelWidth / 2) - 8, ARROW_Y, { transform: 'scaleX(-1)' })} />
          <img alt="" src={markSrc} style={imageStyle(SCREEN_WIDTH / 2 + Math.trunc(labelWidth / 2) + 3, ARROW_Y)} />
        </>
      )}
      {!isAsking && <SpeedPressAreas labelWidth={labelWidth} gameUiOrigins={gameUiOrigins} />}
      <SpeedMarks speed={speed} fieldUrl={fieldUrl} />
    </div>
  )
}
