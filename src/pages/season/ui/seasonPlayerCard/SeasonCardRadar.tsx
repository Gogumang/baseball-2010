import { FrameSprite, SpriteNumber } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useRadarGrowth } from '@/shared/lib/radarGrowth/useRadarGrowth'
import type { SeasonCardAbility } from '@/pages/season/lib/seasonPlayerDetail'
import {
  ABILITY_TITLE,
  RADAR_BACKGROUND_IMAGE,
  RADAR_CENTER,
  RADAR_COLORS,
  RADAR_LABEL_BOX_IMAGE,
  TintedNumber,
  abilityChartFrameOf,
  abilityColorOf,
  glyphsWidthOf,
  managementStyles,
  numberGlyphsOf,
  radarAxisEndOf,
  radarLabelBoxOf,
  radarPointOf,
} from './otherSlices'
import { IMG_TEXT, MODE_UI } from './cardAssets'

const BACKGROUND_HALF = { width: 31, height: 62 }
/** num 20번대 숫자 높이 (관리 화면 레이더와 같다) */
const NUMBER_HEIGHT = 10

/**
 * 레이더 0x5a990 — 관리 화면 `RadarChart` 와 같은 그리기에 축 이름 표만 종류(투수 3 · 타자 2)대로 고른다.
 * ABILITY 판(mode_ui 8) · 글(img_text 159) 도 0x7ba44 가 같은 자리에 찍는다.
 */
export function SeasonCardRadar({
  abilities,
  labelFrames,
}: {
  readonly abilities: readonly SeasonCardAbility[]
  readonly labelFrames: readonly number[]
}) {
  const origins = useFrameOrigins(MODE_UI)
  // 자라는 애니 — 꼭짓점 · 숫자는 지금값(E+8), 숫자 색은 카드가 견준 최종값 그대로(0x5ad94)
  const current = useRadarGrowth(abilities.map((ability) => ability.shown))
  const points = current.map((value, axis) => radarPointOf(axis, value))
  return (
    <>
      <FrameSprite folder={MODE_UI} frame={8} origins={origins} x={ABILITY_TITLE.plate.x} y={ABILITY_TITLE.plate.y} />
      <img
        className={managementStyles.layer}
        alt=""
        src={`${IMG_TEXT}/${ABILITY_TITLE.frame}.png`}
        style={{ left: ABILITY_TITLE.centerX - 19, top: ABILITY_TITLE.y }}
      />
      <img
        className={managementStyles.layer}
        alt=""
        src={RADAR_BACKGROUND_IMAGE}
        style={{ left: RADAR_CENTER.x - BACKGROUND_HALF.width, top: RADAR_CENTER.y - BACKGROUND_HALF.height / 2 }}
      />
      <img
        className={managementStyles.layer}
        alt=""
        src={RADAR_BACKGROUND_IMAGE}
        style={{ left: RADAR_CENTER.x, top: RADAR_CENTER.y - BACKGROUND_HALF.height / 2, transform: 'scaleX(-1)' }}
      />
      {/* 0x764c8: 바탕 0x7633c(고정 29 마름모 #6B92F4) → 도형 0x75e30(채움 · 흰 테두리) → 축 이름 줄 0x5abe2~(기준점 → 지금 꼭짓점) */}
      <svg className={managementStyles.board} viewBox="0 0 240 320">
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
      {abilities.map((ability, axis) => {
        const box = radarLabelBoxOf(axis)
        const glyphs = numberGlyphsOf(current[axis] ?? ability.shown)
        const color = abilityColorOf(ability.base, ability.shown)
        const right = box.x + 13 + Math.ceil(glyphsWidthOf(glyphs) / 2)
        return (
          <div key={axis} data-testid={`시즌카드-능력-${axis}`} data-value={ability.shown} data-color={color ?? ''} data-label={labelFrames[axis]}>
            <img className={managementStyles.layer} alt="" src={RADAR_LABEL_BOX_IMAGE} style={{ left: box.x, top: box.y }} />
            <img
              className={managementStyles.layer}
              alt=""
              src={`${IMG_TEXT}/${String(labelFrames[axis]).padStart(3, '0')}.png`}
              style={{ left: box.x + 3, top: box.y + 3 }}
            />
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
