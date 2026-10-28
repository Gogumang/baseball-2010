import {
  PITCHER_LABELS,
  PITCHER_NAME_PLATE_X,
  PITCHER_ROWS,
  PITCHER_ROW_X,
  SCORE_SLOTS,
  endScoreGlyphsOf,
  pitcherLabelPositionOf,
  pitcherNameBoxOf,
  pitcherRowTopOf,
} from '@/widgets/game-scene/lib/endBoardLayout'
import * as styles from '@/widgets/game-scene/ui/GameScene.css'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

const GAME_UI_FRAMES = assetUrl('./sprites/game_ui/frames')
const IMG_TEXT_FRAMES = assetUrl('./sprites/img_text/frames')
const NUM_IMAGES = assetUrl('./sprites/num')
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
  const scores = [
    { slot: SCORE_SLOTS.away, value: side0Score },
    { slot: SCORE_SLOTS.home, value: side1Score },
  ] as const
  return (
    <>
      {/* 점수 — 0x585ad(…, num 이미지 0x46, 값, x, y, 간격 6, 자리 0, 정렬 2) */}
      {scores.map(({ slot, value }, side) => (
        <span key={side} data-testid={`경기끝-점수-${side}`} data-value={value}>
          {endScoreGlyphsOf(value, slot).map((glyph, index) => (
            <img key={index} className={styles.sprite} alt="" src={frameSrc(NUM_IMAGES, glyph.image)} style={{ left: glyph.x, top: glyph.y }} />
          ))}
        </span>
      ))}

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
              style={{ left: PITCHER_NAME_PLATE_X, top: pitcherRowTopOf(row) }}
              src={frameSrc(GAME_UI_FRAMES, PITCHER_ROWS.namePlate.frame)}
              alt=""
            />
            <img
              className={styles.sprite}
              style={{ left: labelPosition.x, top: labelPosition.y }}
              src={frameSrc(IMG_TEXT_FRAMES, label.frame)}
              alt={label.name}
            />
            <div className={styles.pitcherName} style={{ left: nameBox.x, top: nameBox.y, width: nameBox.width }}>
              {names[row] ?? ''}
            </div>
          </div>
        )
      })}
    </>
  )
}
