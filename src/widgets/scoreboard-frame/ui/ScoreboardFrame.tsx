import { FrameSprite, useImgTextPalettes } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import {
  NAME_PLATE_COLOR, SCOREBOARD_FRAME, effectOpacityOf, namePlateOpacityOf, roundPlateRectsOf, scoreboardPlacementOf,
} from '@/widgets/scoreboard-frame/lib/scoreboardFrameLayout'
import type { ScoreboardSide } from '@/widgets/scoreboard-frame/lib/scoreboardFrameLayout'
import * as styles from '@/widgets/scoreboard-frame/ui/ScoreboardFrame.css'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

const GAME_UI_FRAMES = assetUrl('./sprites/game_ui/frames')
const IMG_TEXT_FRAMES = assetUrl('./sprites/img_text/frames')
const TEAM_LOGO = assetUrl('./sprites/team_logo')

export interface ScoreboardFrameProps {
  /** 0x41440 의 x · y — 틀 프레임 16 의 원점 */
  readonly x: number
  readonly y: number
  /** 측 0 · 측 1 — 팀(0xb6bdd)과 CPU 여부(0xb6c21) */
  readonly side0: ScoreboardSide
  readonly side1: ScoreboardSide
  /** 효과 1 의 인자 L (그림 몫 L/16). 안 주면 효과 0 — 그대로 그린다 */
  readonly effectLevel?: number | null
  /** 장면 상태가 인트로(0xc)일 때만 — 이름 칸 칠의 알파 [+0x17e4] */
  readonly introAlpha?: number | null
}

/**
 * **점수판 틀 0x41440** — 머리말은 `lib/scoreboardFrameLayout`. 부르는 화면은 (x, y) 와 두 측만 넘기면 된다.
 *
 * PLAYER/COM 글자는 img_text 팔레트 4(회색 #7B797B · #525152)로 그린다(0x414ca · 0x4153e `0x913e5(img_text, 4)`).
 * 157 · 158 은 `tools/apply_mpl.py` 가 이미 팔레트 4 로 구워 둔 프레임이라 필터를 또 걸면 안 된다 — 앞서는 흰 글자용 행렬을
 * 한 번 더 걸어 회색(123) 이 0 으로 잘려 **검정** 글자가 됐다. `useImgTextPalettes` 가 구운 팔레트를 보고 고른다.
 */
export function ScoreboardFrame({ x, y, side0, side1, effectLevel = null, introAlpha = null }: ScoreboardFrameProps) {
  const gameUiOrigins = useFrameOrigins(GAME_UI_FRAMES)
  const textOrigins = useFrameOrigins(IMG_TEXT_FRAMES)
  const palettes = useImgTextPalettes()
  const placement = scoreboardPlacementOf(x, y, [side0, side1])
  const imageOpacity = effectOpacityOf(effectLevel)
  const plateOpacity = namePlateOpacityOf(introAlpha)
  const imageStyle = imageOpacity === 1 ? undefined : { opacity: imageOpacity }

  return (
    <div className={styles.group} data-testid="점수판-틀" data-x={x} data-y={y}>
      {palettes.definition}
      {imageOpacity > 0 && (
        <FrameSprite folder={GAME_UI_FRAMES} frame={SCOREBOARD_FRAME} origins={gameUiOrigins}
          x={placement.frame.x} y={placement.frame.y} style={imageStyle} />
      )}
      {imageOpacity > 0 && placement.labels.map((label, index) => (
        <span key={`label-${index}`} data-testid={`점수판-측글자-${index}`} data-frame={label.frame}>
          <FrameSprite folder={IMG_TEXT_FRAMES} frame={label.frame} origins={textOrigins} x={label.x} y={label.y}
            style={{ ...palettes.styleOf(label.frame, 4), ...imageStyle }} />
        </span>
      ))}
      {imageOpacity > 0 && placement.logos.map((logo, index) => (
        <img key={`logo-${index}`} className={styles.sprite} alt="" data-testid={`점수판-로고-${index}`}
          src={`${TEAM_LOGO}/${String(logo.team).padStart(3, '0')}.png`}
          style={{ left: logo.x, top: logo.y, ...imageStyle }} />
      ))}
      {placement.plates.map((plate, index) => (
        // 두 직사각형이 겹치는 자리가 두 번 섞이지 않게 불투명도는 칸 하나에 준다
        <span key={`plate-${index}`} data-testid={`점수판-이름칸-${index}`}
          style={plateOpacity === 1 ? undefined : { opacity: plateOpacity }}>
          {roundPlateRectsOf(plate).map((rect, part) => (
            <span key={part} className={styles.block} style={{
              left: rect.x, top: rect.y, width: rect.width, height: rect.height, background: NAME_PLATE_COLOR,
            }} />
          ))}
        </span>
      ))}
      {imageOpacity > 0 && placement.names.map((name, index) => (
        <span key={`name-${index}`} data-testid={`점수판-팀이름-${index}`} data-frame={name.frame}>
          <FrameSprite folder={IMG_TEXT_FRAMES} frame={name.frame} origins={textOrigins} x={name.x} y={name.y}
            style={imageStyle} />
        </span>
      ))}
    </div>
  )
}
