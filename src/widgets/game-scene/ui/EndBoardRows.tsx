import { SpriteNumber } from '@/shared/ui'
import { glyphsWidthOf, numberGlyphsOf } from '@/shared/lib/pixelNumber/pixelNumber'
import {
  PITCHER_LABELS,
  PITCHER_ROWS,
  PITCHER_ROW_X,
  SCORE_GLYPH_HEIGHT,
  SCORE_SLOTS,
  pitcherLabelPositionOf,
  pitcherNameBoxOf,
  pitcherRowTopOf,
} from '@/widgets/game-scene/lib/endBoardLayout'
import * as styles from '@/widgets/game-scene/ui/GameScene.css'

const GAME_UI_FRAMES = './sprites/game_ui/frames'
const IMG_TEXT_FRAMES = './sprites/img_text/frames'
const frameSrc = (folder: string, frame: number) => `${folder}/${String(frame).padStart(3, '0')}.png`

interface EndBoardRowsProps {
  /** 측 0(초 공격 = 선공) 점수 — 왼쪽 */
  readonly side0Score: number
  /** 측 1(말 공격 = 후공) 점수 — 오른쪽 */
  readonly side1Score: number
  /** 승리투수·패전투수·세이브 이름. null 이면(측 2 = 없음) 그 줄 이름을 비운다 */
  readonly names: readonly (string | null)[]
}

/**
 * 경기 끝 결과 판의 **점수 두 개와 승·패·세 세 줄** (상태 0x18 그리기 0x4fe9c 의 경기 끝 가지, R10 5절).
 * 240×320 원본 좌표에 절대 배치하므로 `RawScreen` 안에 둔다.
 */
export function EndBoardRows({ side0Score, side1Score, names }: EndBoardRowsProps) {
  const leftGlyphs = numberGlyphsOf(side0Score)
  const rightGlyphs = numberGlyphsOf(side1Score)
  return (
    <>
      {/* 점수 — 0x585ac 의 마지막 인자 2 = 가로 가운데 정렬로 본다 */}
      <SpriteNumber
        glyphs={leftGlyphs}
        right={SCORE_SLOTS.away.x + Math.round(glyphsWidthOf(leftGlyphs) / 2)}
        boxTop={SCORE_SLOTS.away.y}
        boxHeight={SCORE_GLYPH_HEIGHT}
      />
      <SpriteNumber
        glyphs={rightGlyphs}
        right={SCORE_SLOTS.home.x + Math.round(glyphsWidthOf(rightGlyphs) / 2)}
        boxTop={SCORE_SLOTS.home.y}
        boxHeight={SCORE_GLYPH_HEIGHT}
      />

      {/* 승리투수·패전투수·세이브 세 줄 (표 0xd0470 = img_text 388·389·329) */}
      {PITCHER_LABELS.map((label, row) => {
        const labelPosition = pitcherLabelPositionOf(row)
        const nameBox = pitcherNameBoxOf(row)
        return (
          <div key={label.frame}>
            <img
              className={styles.sprite}
              style={{ left: PITCHER_ROW_X, top: pitcherRowTopOf(row) }}
              src={frameSrc(GAME_UI_FRAMES, PITCHER_ROWS.labelPlate.frame)}
              alt=""
            />
            <img
              className={styles.sprite}
              style={{ left: nameBox.x, top: nameBox.y }}
              src={frameSrc(GAME_UI_FRAMES, PITCHER_ROWS.namePlate.frame)}
              alt=""
            />
            <img
              className={styles.sprite}
              style={{ left: labelPosition.x, top: labelPosition.y }}
              src={frameSrc(IMG_TEXT_FRAMES, label.frame)}
              alt={label.name}
            />
            <div
              className={styles.pitcherName}
              style={{ left: nameBox.x, top: nameBox.y, width: nameBox.width, height: nameBox.height }}
            >
              {names[row] ?? ''}
            </div>
          </div>
        )
      })}
    </>
  )
}
