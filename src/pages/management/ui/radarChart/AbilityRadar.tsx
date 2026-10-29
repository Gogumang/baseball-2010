import { FrameSprite, SpriteNumber } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { numberGlyphsOf, glyphsWidthOf } from '@/pages/management/lib/managementLayout'
import {
  ABILITY_TITLE,
  RADAR_BACKGROUND_IMAGE,
  RADAR_CENTER,
  RADAR_COLORS,
  RADAR_LABEL_BOX_IMAGE,
  abilityColorOf,
  radarAxisEndOf,
  radarLabelBoxOf,
  radarPointOf,
} from '@/pages/management/lib/basicInfoLayout'
import * as styles from '@/pages/management/ui/ManagementScreen.css'
import { useRadarGrowth } from '@/shared/lib/radarGrowth/useRadarGrowth'
import type { RadarGrowthOptions } from '@/shared/lib/radarGrowth/useRadarGrowth'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'
import { abilityChartFrameOf } from './otherSlices'
import { NUMBER_HEIGHT, TintedNumber } from './TintedNumber'

const IMG_TEXT = assetUrl('./sprites/img_text/frames')
const BACKGROUND_HALF = { width: 31, height: 62 }

/**
 * 레이더 0x5a990 — 999 기준, 축 이름 상자, 숫자 색 비교. 축 이름은 첫 스택 인자(모드)가 고른다(0x5aa40~0x5aafc):
 * 2(타자) → 이름 번호 4~7 · 3(투수) → 0~3, img_text 프레임 = 37 + 번호(37 제구 · 38 구속 · 39 변화 · 40 체력 · 41 히트 …).
 * 나리 카드 0x7ba44 는 0x7b970(타자편)이면 2, 아니면 3 을 넘긴다(0x7c098~0x7c0aa).
 */
export function AbilityRadar({
  base,
  shown,
  labelFrames,
  growth,
}: {
  readonly base: readonly number[]
  readonly shown: readonly number[]
  readonly labelFrames: readonly number[]
  readonly growth?: RadarGrowthOptions
}) {
  const origins = useFrameOrigins(assetUrl('./sprites/mode_ui/frames'))
  // 자라는 애니 — 꼭짓점 · 숫자는 지금값(E+8), 숫자 색은 카드가 견준 최종값 그대로(0x5ad94)
  const current = useRadarGrowth(shown, growth)
  const points = current.map((value, axis) => radarPointOf(axis, value))
  return (
    <>
      <FrameSprite folder={assetUrl('./sprites/mode_ui/frames')} frame={8} origins={origins} x={ABILITY_TITLE.plate.x} y={ABILITY_TITLE.plate.y} />
      <img
        className={styles.layer}
        alt=""
        src={`${IMG_TEXT}/${ABILITY_TITLE.frame}.png`}
        style={{ left: ABILITY_TITLE.centerX - 19, top: ABILITY_TITLE.y }}
      />
      {/* 배경 원 = slt_frame 그림3(반원)을 좌우로 붙인다 */}
      <img
        className={styles.layer}
        alt=""
        src={RADAR_BACKGROUND_IMAGE}
        style={{ left: RADAR_CENTER.x - BACKGROUND_HALF.width, top: RADAR_CENTER.y - BACKGROUND_HALF.height / 2 }}
      />
      <img
        className={styles.layer}
        alt=""
        src={RADAR_BACKGROUND_IMAGE}
        style={{ left: RADAR_CENTER.x, top: RADAR_CENTER.y - BACKGROUND_HALF.height / 2, transform: 'scaleX(-1)' }}
      />
      {/* 0x764c8: 바탕 0x7633c(고정 29 마름모 #6B92F4) → 도형 0x75e30(채움 · 흰 테두리) → 축 이름 줄 0x5abe2~(기준점 → 지금 꼭짓점) */}
      <svg className={styles.board} viewBox="0 0 240 320">
        <polygon
          points={abilityChartFrameOf(RADAR_CENTER)
            .map((point) => `${point.x},${point.y}`)
            .join(' ')}
          fill="none"
          stroke={RADAR_COLORS.axis}
        />
        <polygon
          points={points.map((point) => `${point.x},${point.y}`).join(' ')}
          fill={RADAR_COLORS.fill}
          fillOpacity={RADAR_COLORS.fillOpacity}
          stroke={RADAR_COLORS.edge}
        />
        {points.map((point, axis) => {
          const end = radarAxisEndOf(axis)
          return <line key={axis} x1={end.x} y1={end.y} x2={point.x} y2={point.y} stroke={RADAR_COLORS.axis} />
        })}
      </svg>
      {shown.map((value, axis) => {
        const box = radarLabelBoxOf(axis)
        const glyphs = numberGlyphsOf(current[axis] ?? value)
        const color = abilityColorOf(base[axis] ?? value, value)
        const right = box.x + 13 + Math.ceil(glyphsWidthOf(glyphs) / 2)
        return (
          <div key={axis}>
            <img className={styles.layer} alt="" src={RADAR_LABEL_BOX_IMAGE} style={{ left: box.x, top: box.y }} />
            <img
              className={styles.layer}
              alt=""
              src={`${IMG_TEXT}/${String(labelFrames[axis]).padStart(3, '0')}.png`}
              style={{ left: box.x + 3, top: box.y + 3 }}
            />
            {/* 숫자 (상자x+18, 상자y+17) — 가운데 기준은 추정 */}
            {color === null ? (
              <SpriteNumber glyphs={glyphs} right={right} boxTop={box.y + 17} boxHeight={NUMBER_HEIGHT} />
            ) : (
              <TintedNumber glyphs={glyphs} right={right} top={box.y + 17} color={color} />
            )}
          </div>
        )
      })}
    </>
  )
}
