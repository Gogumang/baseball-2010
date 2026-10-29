import { SETTLEMENT_SCORE } from '@/pages/team-game/lib/settlementBoard'
import * as styles from '@/pages/team-game/ui/SettlementBoard.css'
import { NUM, imageSrc } from './settlementAssets'

/** num 70 + 자리 숫자 — 그림 폭(70~79) */
const SCORE_DIGIT_WIDTHS = [32, 22, 29, 29, 32, 30, 30, 31, 30, 30] as const
const SCORE_DIGIT_HEIGHTS = [36, 35, 35, 36, 36, 36, 36, 34, 36, 36] as const

/** 0xba689(x, y, 0, 값, 0x46, num, 정렬 0x12) — 자간 0, x 가 가운데, 가장 큰 글자에 아래를 맞춘다(0xba628) */
export function ScoreNumber({
  value,
  centerX,
  y,
  testId,
}: {
  readonly value: number
  readonly centerX: number
  readonly y: number
  readonly testId: string
}) {
  const digits = [...String(Math.max(0, Math.trunc(value)))].map(Number)
  const totalWidth = digits.reduce((sum, digit) => sum + SCORE_DIGIT_WIDTHS[digit], 0)
  const maxHeight = Math.max(...digits.map((digit) => SCORE_DIGIT_HEIGHTS[digit]))
  let x = centerX + Math.floor(-totalWidth / 2)
  return (
    <div data-testid={testId} data-value={value}>
      {digits.map((digit, index) => {
        const left = x
        x += SCORE_DIGIT_WIDTHS[digit]
        return (
          <img
            key={index}
            className={styles.sprite}
            alt=""
            src={imageSrc(NUM, SETTLEMENT_SCORE.digitBaseFrame + digit)}
            style={{ left, top: y + maxHeight - SCORE_DIGIT_HEIGHTS[digit] }}
          />
        )
      })}
    </div>
  )
}
