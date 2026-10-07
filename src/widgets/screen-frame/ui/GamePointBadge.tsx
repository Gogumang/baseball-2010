import {
  GAME_POINT_IMAGE, GAME_POINT_PLATE_COLOR, GAME_POINT_PLATE_EDGE, gamePointBadgeOf,
} from '@/widgets/screen-frame/lib/gamePointBadge'
import type { GamePointBadgeArgs } from '@/widgets/screen-frame/lib/gamePointBadge'
import * as styles from '@/widgets/screen-frame/ui/ScreenFrame.css'

const pointImage = (index: number) => `./sprites/gpoint/${String(index).padStart(3, '0')}.png`

/**
 * **G 숫자 0x54a60** (판 ≠ 0 갈래) — 둥근 판 · G 동전 · "+" · 숫자. 자리 식은 `lib/gamePointBadge` 머리말.
 * 240×320 원본 좌표에 절대 배치하므로 그 좌표계를 쓰는 부모 안에 둔다.
 */
export function GamePointBadge({ testId, ...args }: GamePointBadgeArgs & { readonly testId?: string }) {
  const badge = gamePointBadgeOf(args)
  const rectStyle = (rect: { x: number; y: number; width: number; height: number }, color: string) => ({
    left: rect.x, top: rect.y, width: rect.width, height: rect.height, background: color,
  })
  return (
    <span data-testid={testId} data-value={args.value}>
      {badge.plate !== null && (
        <span data-badge-plate="">
          <span className={styles.layer} style={rectStyle(badge.plate.fill, GAME_POINT_PLATE_COLOR)} />
          {badge.plate.edges.map((edge, index) => (
            <span key={index} className={styles.layer} style={rectStyle(edge, GAME_POINT_PLATE_EDGE)} />
          ))}
        </span>
      )}
      <img className={styles.layer} data-badge-coin="" style={{ left: badge.coin.x, top: badge.coin.y }}
        src={pointImage(GAME_POINT_IMAGE.coin)} alt="" />
      {badge.plus !== null && (
        <img className={styles.layer} data-badge-plus="" style={{ left: badge.plus.x, top: badge.plus.y }}
          src={pointImage(GAME_POINT_IMAGE.plus)} alt="" />
      )}
      {badge.digits.map((digit, index) => (
        <img key={index} className={styles.layer} data-badge-digit={digit.digit} style={{ left: digit.x, top: digit.y }}
          src={pointImage(digit.digit)} alt="" />
      ))}
    </span>
  )
}
