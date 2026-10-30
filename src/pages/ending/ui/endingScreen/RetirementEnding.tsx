import { MarkupText } from '@/shared/ui'
import { ORIGINAL_ENDINGS } from '@/shared/config/original/endings'
import {
  ENDING_IMAGE,
  IRIS_COVER,
  RISING_TEXT,
  SCREEN,
  endingImageOffsetOf,
  irisCircleOf,
  irisStartTickOf,
  risingTextTopOf,
} from '@/pages/ending/lib/endingLayout'
import * as styles from '@/pages/ending/ui/EndingScreen.css'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

const ENDING_FRAMES = assetUrl('./sprites/ending/frames')

const imageSrc = (folder: string, id: number) => `${folder}/${String(id).padStart(3, '0')}.png`

/**
 * 은퇴 엔딩 2~9 (0x886ca 갈래) — ending.pzx 그림이 미끄러져 서고, 원형 전환이 e 의 자리로 닫히며,
 * StrENDING[20] 머리말 + 본 엔딩 글이 아래에서 올라온다.
 */
export function RetirementEnding({
  endingIndex,
  playerName,
  tick,
}: {
  readonly endingIndex: number
  readonly playerName: string
  /** 141 에 들어와 돈 틀 수 n */
  readonly tick: number
}) {
  const irisTick = tick - irisStartTickOf(endingIndex)
  const circle = irisTick < 0 ? null : irisCircleOf(irisTick, endingIndex)
  const prologue = ORIGINAL_ENDINGS[RISING_TEXT.prologueIndex] ?? ''
  const story = ORIGINAL_ENDINGS[endingIndex] ?? ''
  const risingText = `!C${prologue}${'!N'.repeat(RISING_TEXT.gapLines)}${story}`

  return (
    <>
      <div className={styles.blackScreen} />
      <img
        className={styles.sprite}
        alt=""
        data-part="ending-image"
        src={imageSrc(ENDING_FRAMES, ENDING_IMAGE.image)}
        style={{ left: ENDING_IMAGE.x + endingImageOffsetOf(tick, endingIndex), top: ENDING_IMAGE.y }}
      />
      {/* 원형 전환 — 검정 판에 원을 뚫어 덮는다. evenodd 라 원 안쪽이 구멍이 된다 */}
      {circle !== null && (
        <svg
          className={styles.overlay}
          aria-label="원형 전환"
          viewBox={`0 0 ${SCREEN.width} ${SCREEN.height}`}
          width={SCREEN.width}
          height={SCREEN.height}
        >
          <path
            fillRule="evenodd"
            fill={IRIS_COVER}
            d={
              `M0,0H${SCREEN.width}V${SCREEN.height}H0Z` +
              `M${circle.x},${circle.y + circle.diameter / 2}` +
              `a${circle.diameter / 2},${circle.diameter / 2} 0 1,0 ${circle.diameter},0` +
              `a${circle.diameter / 2},${circle.diameter / 2} 0 1,0 ${-circle.diameter},0`
            }
          />
        </svg>
      )}
      <div className={styles.endingText} style={{ left: RISING_TEXT.x, top: risingTextTopOf(tick), width: RISING_TEXT.width }}>
        <MarkupText raw={risingText} replacements={[playerName]} />
      </div>
    </>
  )
}
