import { FrameSprite } from '@/shared/ui'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { SETTLEMENT_INFO_BAR, SETTLEMENT_INFO_POINT } from '@/pages/team-game/lib/settlementBoard'
import * as styles from '@/pages/team-game/ui/SettlementBoard.css'
import { GamePointBadge } from '@/widgets/screen-frame/ui/GamePointBadge'
import { GAME_UI, IMG_TEXT_FRAMES, imageSrc } from './settlementAssets'

/** 4af50 기본 화면 — game_ui 이미지 12 · "0:INFO" · 번 G */
export function BasicView({
  gamePoints,
  textOrigins,
  onOpenPanel,
}: {
  readonly gamePoints: number
  readonly textOrigins: FrameOrigins | null
  readonly onOpenPanel: () => void
}) {
  return (
    <>
      <img
        className={styles.sprite}
        alt=""
        src={imageSrc(GAME_UI, SETTLEMENT_INFO_BAR.image)}
        style={{ left: SETTLEMENT_INFO_BAR.x, top: SETTLEMENT_INFO_BAR.y }}
      />
      <FrameSprite
        folder={IMG_TEXT_FRAMES}
        frame={SETTLEMENT_INFO_BAR.labelFrame}
        origins={textOrigins}
        x={SETTLEMENT_INFO_BAR.labelX}
        y={SETTLEMENT_INFO_BAR.labelY}
      />
      {/* 원본에 없는 웹 단추 — '0' 키와 같다 */}
      <button
        type="button"
        className={styles.hitArea}
        aria-label="0:INFO"
        style={{
          left: SETTLEMENT_INFO_BAR.x,
          top: SETTLEMENT_INFO_BAR.y,
          width: SETTLEMENT_INFO_BAR.imageWidth,
          height: SETTLEMENT_INFO_BAR.imageHeight,
        }}
        onClick={onOpenPanel}
      />
      {gamePoints > 0 && (
        <GamePointBadge
          testId="정산-번-G"
          value={gamePoints}
          x={SETTLEMENT_INFO_POINT.x}
          y={SETTLEMENT_INFO_POINT.y}
          width={SETTLEMENT_INFO_POINT.width}
          align={SETTLEMENT_INFO_POINT.align}
          plus={SETTLEMENT_INFO_POINT.plus}
          plate={SETTLEMENT_INFO_POINT.plate}
        />
      )}
    </>
  )
}
