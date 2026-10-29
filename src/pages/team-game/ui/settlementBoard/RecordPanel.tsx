import { CommonPanel, FrameSprite, InsetBox } from '@/shared/ui'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { versusRewardTextOf } from '@/pages/team-game/lib/settlementBoard'
import type { settlementPanelLayoutOf, settlementRecordRowsOf, startSettlementScroll } from '@/pages/team-game/lib/settlementBoard'
import * as styles from '@/pages/team-game/ui/SettlementBoard.css'
import { GamePointBadge } from '@/widgets/screen-frame/ui/GamePointBadge'
import { RecordList } from './RecordList'
import { RewardTicker } from './RewardTicker'
import { GAME_UI, GP_LABEL_FRAME, IMG_TEXT_FRAMES, POPUP_FRAMES, imageSrc } from './settlementAssets'

type PanelLayout = ReturnType<typeof settlementPanelLayoutOf>

/** 4ad34 G 칸 — 번 G · 보유 G 두 줄 (보유 G 를 안 주면 그 줄 숫자를 비운다) */
function PointRows({
  panel,
  gamePoints,
  heldGamePoints,
  textOrigins,
}: {
  readonly panel: PanelLayout
  readonly gamePoints: number
  readonly heldGamePoints: number | undefined
  readonly textOrigins: FrameOrigins | null
}) {
  return (
    <>
      {/* 4ad34 칸 0xbb28d(…, 정렬 2) */}
      <InsetBox x={panel.pointBox.x} y={panel.pointBox.y} width={panel.pointBox.width} height={panel.pointBox.height} />
      {panel.pointRows.map((row, index) => {
        const value = index === 0 ? gamePoints : heldGamePoints
        return (
          <div key={row.name}>
            <FrameSprite folder={IMG_TEXT_FRAMES} frame={row.label} origins={textOrigins} x={panel.pointLabelX} y={row.labelY} />
            <FrameSprite folder={IMG_TEXT_FRAMES} frame={GP_LABEL_FRAME} origins={textOrigins} x={panel.pointGpX} y={row.labelY} />
            {value !== undefined && (
              <GamePointBadge
                testId={`정산-${row.name}-G`}
                value={value}
                x={panel.pointValue.x}
                y={row.valueY}
                width={panel.pointValue.width}
                align={panel.pointValue.align}
                plus={row.plus}
                plate={panel.pointValue.plate}
              />
            )}
          </div>
        )
      })}
    </>
  )
}

/** 4aeb4 대전모드 승리 보상 칸 — 흐르는 글(서버 값이 없으면 칸만) */
function RewardBox({ panel, versusWinBonus }: { readonly panel: PanelLayout; readonly versusWinBonus: number | undefined }) {
  if (panel.rewardBox === null || panel.ticker === null) return null
  return (
    <>
      {/* 4aeb4 칸 0xbb28d(…, 정렬 2) */}
      <InsetBox x={panel.rewardBox.x} y={panel.rewardBox.y} width={panel.rewardBox.width} height={panel.rewardBox.height} />
      {versusWinBonus !== undefined && <RewardTicker text={versusRewardTextOf(versusWinBonus)} box={panel.ticker} />}
    </>
  )
}

/** 기록 판 (+0x17e8 ≠ 0) — 공용 판 · "RESULT" · 기록 칸 · G 칸 · 보상 칸 · OK */
export function RecordPanel({
  panel,
  visibleRows,
  scroll,
  gamePoints,
  heldGamePoints,
  versusWinBonus,
  textOrigins,
  popupOrigins,
}: {
  readonly panel: PanelLayout
  readonly visibleRows: ReturnType<typeof settlementRecordRowsOf>
  readonly scroll: ReturnType<typeof startSettlementScroll>
  readonly gamePoints: number
  readonly heldGamePoints: number | undefined
  readonly versusWinBonus: number | undefined
  readonly textOrigins: FrameOrigins | null
  readonly popupOrigins: FrameOrigins | null
}) {
  return (
    <>
      {/* 4aafe 공용 판 0x55e61(skin, W/2, H/2, 176, h, 0, 0x22, 위 띠 0x10, 0, 0, 0) */}
      <CommonPanel x={panel.window.x} y={panel.window.y} width={panel.window.width} height={panel.window.height} topBand={0x10} testId="정산-판-창" />
      <img className={styles.sprite} alt="RESULT" src={imageSrc(GAME_UI, panel.title.image)} style={{ left: panel.title.x, top: panel.title.y }} />
      {/* 4ab6e 칸 0xbb28d(…, 정렬 2) */}
      <InsetBox x={panel.recordBox.x} y={panel.recordBox.y} width={panel.recordBox.width} height={panel.recordBox.height} />
      <RecordList panel={panel} visibleRows={visibleRows} scroll={scroll} />
      <PointRows panel={panel} gamePoints={gamePoints} heldGamePoints={heldGamePoints} textOrigins={textOrigins} />
      <RewardBox panel={panel} versusWinBonus={versusWinBonus} />
      <FrameSprite folder={POPUP_FRAMES} frame={panel.okButton.frame} origins={popupOrigins} x={panel.okButton.x} y={panel.okButton.y} />
    </>
  )
}
