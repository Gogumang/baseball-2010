import type { BatterAbility } from '@/entities/batting/model/batter'
import { FrameSprite, SpriteNumber } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { numberGlyphsOf, glyphsWidthOf } from '@/pages/management/lib/managementLayout'
import {
  ABILITY_TITLE, RADAR_BACKGROUND_IMAGE, RADAR_CENTER, RADAR_COLORS, RADAR_LABEL_BOX_IMAGE, RADAR_LABEL_FRAMES,
  abilityColorOf, radarAxisEndOf, radarLabelBoxOf, radarPointOf,
} from '@/pages/management/lib/basicInfoLayout'
import * as styles from '@/pages/management/ui/ManagementScreen.css'

const KEYS: readonly (keyof BatterAbility)[] = ['hit', 'power', 'defense', 'run']
const IMG_TEXT = './sprites/img_text/frames'
const BACKGROUND_HALF = { width: 31, height: 62 }

/** ABILITY 레이더 (0x5a990) — 999 기준, 축 이름 상자, 숫자 색 비교 */
export function RadarChart({ base, shown }: { readonly base: BatterAbility; readonly shown: BatterAbility }) {
  const origins = useFrameOrigins('./sprites/mode_ui/frames')
  const points = KEYS.map((key, axis) => radarPointOf(axis, shown[key]))
  return (
    <>
      <FrameSprite folder="./sprites/mode_ui/frames" frame={8} origins={origins} x={ABILITY_TITLE.plate.x} y={ABILITY_TITLE.plate.y} />
      <img className={styles.layer} alt="" src={`${IMG_TEXT}/${ABILITY_TITLE.frame}.png`}
        style={{ left: ABILITY_TITLE.centerX - 19, top: ABILITY_TITLE.y }} />
      {/* 배경 원 = slt_frame 그림3(반원)을 좌우로 붙인다 */}
      <img className={styles.layer} alt="" src={RADAR_BACKGROUND_IMAGE}
        style={{ left: RADAR_CENTER.x - BACKGROUND_HALF.width, top: RADAR_CENTER.y - BACKGROUND_HALF.height / 2 }} />
      <img className={styles.layer} alt="" src={RADAR_BACKGROUND_IMAGE}
        style={{ left: RADAR_CENTER.x, top: RADAR_CENTER.y - BACKGROUND_HALF.height / 2, transform: 'scaleX(-1)' }} />
      <svg className={styles.board} viewBox="0 0 240 320">
        {KEYS.map((key, axis) => {
          const end = radarAxisEndOf(axis)
          return <line key={key} x1={end.x} y1={end.y} x2={points[axis].x} y2={points[axis].y} stroke={RADAR_COLORS.axis} />
        })}
        <polygon points={points.map((point) => `${point.x},${point.y}`).join(' ')}
          fill={RADAR_COLORS.fill} fillOpacity={RADAR_COLORS.fillOpacity} stroke={RADAR_COLORS.edge} />
      </svg>
      {KEYS.map((key, axis) => {
        const box = radarLabelBoxOf(axis)
        const glyphs = numberGlyphsOf(shown[key])
        const color = abilityColorOf(base[key], shown[key])
        return (
          <div key={key}>
            <img className={styles.layer} alt="" src={RADAR_LABEL_BOX_IMAGE} style={{ left: box.x, top: box.y }} />
            <img className={styles.layer} alt="" src={`${IMG_TEXT}/${String(RADAR_LABEL_FRAMES[axis]).padStart(3, '0')}.png`}
              style={{ left: box.x + 3, top: box.y + 3 }} />
            {/* 숫자 (상자x+18, 상자y+17) — 가운데 기준은 추정. 색 비교는 CSS 필터로 근사한다 */}
            <div style={color === null ? undefined : { filter: `drop-shadow(0 0 0 ${color})` }}>
              <SpriteNumber glyphs={glyphs} right={box.x + 13 + Math.ceil(glyphsWidthOf(glyphs) / 2)} boxTop={box.y + 17} boxHeight={10} />
            </div>
          </div>
        )
      })}
    </>
  )
}
