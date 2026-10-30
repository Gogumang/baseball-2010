import { FrameSprite, PressArea } from '@/shared/ui'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { FIRST_BAT_LAYOUT, stadiumArrowsOf, stadiumInfoValuesOf } from '@/pages/general-mode/lib/prepareLayout'
import { STADIUM_COUNT, stadiumCursorAfter, stadiumInfoOf } from '@/pages/general-mode/lib/generalModeSetup'
import * as styles from '@/pages/general-mode/ui/prepareScreen.css'
import { GAME_UI_FRAME, IMG_TEXT_FRAME, SLT_IMAGE, STADIUM_SYMBOL, imageSrc } from './firstBatFigure'

/** 화면 폭의 반 — 가운데 맞춤 글을 (가운데 − 120, 폭 240) 상자에 둔다 */
const SCREEN_HALF_WIDTH = 120

interface StadiumPanelProps {
  readonly stadiumId: number
  readonly isStadiumPhase: boolean
  /** 공용 목록 깜빡 [sp+0xd4] — 구장 막대 칠 · 화살 (0x63b4a) */
  readonly isBob: boolean
  readonly gameUiOrigins: FrameOrigins | null
  readonly imgTextOrigins: FrameOrigins | null
  readonly onMoveStadium: (stadiumId: number) => void
  readonly onChooseStadium: (stadiumId: number) => void
}

/** 그리기 0x640e2 의 아래 판 — 구장 막대 · 이름 · 화살 · 구장 그림 · 연고지 · 좌석, 구장 단계의 누름 칸 */
export function StadiumPanel({ stadiumId, isStadiumPhase, isBob, gameUiOrigins, imgTextOrigins, onMoveStadium, onChooseStadium }: StadiumPanelProps) {
  // 연고지 · 좌석 — 표 0xd1e0c · 0xd1e34 (히든 번호 10~14 는 스택 옆 칸, `stadiumInfoOf`)
  const stadium = stadiumInfoOf(stadiumId)
  const arrows = stadiumArrowsOf(isStadiumPhase, isBob, stadiumId, STADIUM_COUNT)
  const nameWidth = imgTextOrigins?.[String(FIRST_BAT_LAYOUT.stadiumNameFrame + stadiumId).padStart(3, '0')]?.width ?? 0
  return (
    <>
      {/* 아래 판 0x5461d */}
      <span
        className={styles.fillPanel}
        style={{
          left: FIRST_BAT_LAYOUT.panel.x,
          top: FIRST_BAT_LAYOUT.panel.y,
          width: FIRST_BAT_LAYOUT.panel.width,
          height: FIRST_BAT_LAYOUT.panel.height,
          background: 'rgba(29, 68, 168, 0.85)',
        }}
      />

      {/* 단계 1 · 깜빡일 때 구장 막대 자리 반투명 노랑 둥근 칠 0x6b7d5(26, 197, 188, 16, 둥글기 1) (0x6432e) */}
      {isStadiumPhase && isBob && (
        <span
          className={styles.fillPanel}
          data-testid="구장-커서-칠"
          style={{
            left: FIRST_BAT_LAYOUT.stadiumHighlight.x,
            top: FIRST_BAT_LAYOUT.stadiumHighlight.y,
            width: FIRST_BAT_LAYOUT.stadiumHighlight.width + 1,
            height: FIRST_BAT_LAYOUT.stadiumHighlight.height + 1,
            background: FIRST_BAT_LAYOUT.stadiumHighlight.color,
            borderRadius: 1,
          }}
        />
      )}

      {/* 구장 줄 — 막대 + 이름 그림 + 좌우 화살 */}
      <FrameSprite
        folder={GAME_UI_FRAME}
        frame={FIRST_BAT_LAYOUT.stadiumBar.frame}
        origins={gameUiOrigins}
        x={FIRST_BAT_LAYOUT.stadiumBar.x}
        y={FIRST_BAT_LAYOUT.stadiumBar.y}
      />
      <FrameSprite
        folder={IMG_TEXT_FRAME}
        frame={FIRST_BAT_LAYOUT.stadiumNameFrame + stadiumId}
        origins={imgTextOrigins}
        x={FIRST_BAT_LAYOUT.stadiumNameCenterX - (nameWidth >> 1)}
        y={FIRST_BAT_LAYOUT.stadiumNameY}
      />
      {/* 좌우 화살 — 단계와 상관없이 늘 그린다 (0x644ac~0x64576). 누르는 칸은 구장 단계에서만 (웹판) */}
      <img
        className={styles.layer}
        alt=""
        src={imageSrc(SLT_IMAGE, FIRST_BAT_LAYOUT.arrow.image)}
        style={{ left: arrows.leftX, top: FIRST_BAT_LAYOUT.arrow.y }}
      />
      <img
        className={styles.layer}
        alt=""
        src={imageSrc(SLT_IMAGE, FIRST_BAT_LAYOUT.arrow.image)}
        style={{ left: arrows.rightX, top: FIRST_BAT_LAYOUT.arrow.y, transform: 'scaleX(-1)' }}
      />
      {isStadiumPhase && (
        <>
          <PressArea
            label="이전 구장"
            onPress={() => onMoveStadium(stadiumCursorAfter(stadiumId, -1))}
            rect={{ x: FIRST_BAT_LAYOUT.arrow.leftX - 2, y: FIRST_BAT_LAYOUT.arrow.y - 1, width: 9, height: 10 }}
          />
          <PressArea
            label="다음 구장"
            onPress={() => onMoveStadium(stadiumCursorAfter(stadiumId, 1))}
            rect={{ x: FIRST_BAT_LAYOUT.arrow.rightX - 2, y: FIRST_BAT_LAYOUT.arrow.y - 1, width: 9, height: 10 }}
          />
        </>
      )}

      {/* 구장 그림 (stadium_symbol 이미지 = 구장 번호) */}
      <img
        className={styles.layer}
        alt={`구장 ${stadiumId}`}
        src={imageSrc(STADIUM_SYMBOL, stadiumId)}
        style={{ left: FIRST_BAT_LAYOUT.stadiumSymbol.x, top: FIRST_BAT_LAYOUT.stadiumSymbol.y }}
      />

      {/* 오른쪽 정보 두 줄 — 연고지 · 좌석 */}
      {FIRST_BAT_LAYOUT.infoBars.map((bar) => (
        <FrameSprite key={bar.y} folder={GAME_UI_FRAME} frame={bar.frame} origins={gameUiOrigins} x={bar.x} y={bar.y} />
      ))}
      {FIRST_BAT_LAYOUT.infoLabels.map((label) => (
        <FrameSprite key={label.frame} folder={IMG_TEXT_FRAME} frame={label.frame} origins={imgTextOrigins} x={label.x} y={label.y} />
      ))}
      {/* 값 두 줄 — 0xba269 폭 −1: 가운데 = x + (날 글 폭 >> 1) (`FIRST_BAT_LAYOUT.infoValues`, 0x646ca · 0x6472c) */}
      {stadiumInfoValuesOf(stadium).map((value, index) => (
        <span
          key={index}
          className={styles.centeredText}
          data-testid={index === 0 ? '구장-연고지' : '구장-좌석'}
          style={{ left: value.centerX - SCREEN_HALF_WIDTH, top: FIRST_BAT_LAYOUT.infoValues[index].y, width: SCREEN_HALF_WIDTH * 2 }}
        >
          {value.text}
        </span>
      ))}

      {/*
    원본에 없던 웹 [이 구장으로] 단추와 키 안내 글을 걷고 투명 누름 칸으로 — 고른 구장 그림(stadium_symbol 91×40)과
    깜빡이는 구장 막대 칠(26, 197, 188×16) 자리 = OK. 화살 칸과 겹치지 않게 막대는 화살 사이만 잡는다
  */}
      {isStadiumPhase && (
        <>
          <PressArea
            label="구장 그림 — 이 구장으로"
            onPress={() => onChooseStadium(stadiumId)}
            rect={{
              x: FIRST_BAT_LAYOUT.stadiumSymbol.x,
              y: FIRST_BAT_LAYOUT.stadiumSymbol.y,
              width: FIRST_BAT_LAYOUT.stadiumSymbol.width,
              height: FIRST_BAT_LAYOUT.stadiumSymbol.height,
            }}
          />
          <PressArea
            label="이 구장으로"
            onPress={() => onChooseStadium(stadiumId)}
            rect={{
              x: FIRST_BAT_LAYOUT.arrow.leftX + 7,
              y: FIRST_BAT_LAYOUT.stadiumHighlight.y,
              width: FIRST_BAT_LAYOUT.arrow.rightX - FIRST_BAT_LAYOUT.arrow.leftX - 9,
              height: FIRST_BAT_LAYOUT.stadiumHighlight.height,
            }}
          />
        </>
      )}
    </>
  )
}
