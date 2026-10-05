import type { BatterAbility } from '@/entities/batting/model/batter'
import { FrameSprite, SpriteNumber } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { GLYPH_SPACING, numberGlyphsOf, glyphsWidthOf } from '@/pages/management/lib/managementLayout'
import type { Glyph } from '@/shared/lib/pixelNumber/pixelNumber'
import {
  ABILITY_TITLE, RADAR_BACKGROUND_IMAGE, RADAR_CENTER, RADAR_COLORS, RADAR_LABEL_BOX_IMAGE, RADAR_LABEL_FRAMES,
  abilityColorOf, radarAxisEndOf, radarLabelBoxOf, radarPointOf,
} from '@/pages/management/lib/basicInfoLayout'
import * as styles from '@/pages/management/ui/ManagementScreen.css'

const KEYS: readonly (keyof BatterAbility)[] = ['hit', 'power', 'defense', 'run']
const IMG_TEXT = './sprites/img_text/frames'
const BACKGROUND_HALF = { width: 31, height: 62 }
const NUM_FOLDER = './sprites/num'
/** num 20번대 숫자 높이 — 칸 높이와 같아 세로 어긋남이 없다 */
const NUMBER_HEIGHT = 10

/**
 * 색 있는 숫자 — 0x7ba44 가 기본값 0xb6415(기록,k,0) 과 실효값 0xb570c 를 견줘 색을 정하고
 * (실효가 낮으면 (0xff,0,0) · 높으면 (0,0xff,0x40), 같으면 0), 레이더 0x5a990 은 **숫자에만** 그 색을 쓴다:
 * 0x5ad94 `ldr [색표 + k·4]` → 0 이 아니면 0x6aff8 에 [sp+0x18]=1·[sp+0x1c]=색 → 글자를 효과 0xb(단색)로 찍는다
 * (0x6b0fa~0x6b112 `movs r3,#0xb`, [sp]=색). 점·선·축 이름 상자는 색을 받지 않는다.
 */
function TintedNumber({ glyphs, right, top, color }: {
  readonly glyphs: readonly Glyph[]; readonly right: number; readonly top: number; readonly color: string
}) {
  let x = right - glyphsWidthOf(glyphs)
  return (
    <>
      {glyphs.map((glyph, index) => {
        const left = x
        x += glyph.width + (glyph.spacing ?? GLYPH_SPACING)
        const src = `${NUM_FOLDER}/${String(glyph.frame).padStart(3, '0')}.png`
        return (
          <div key={index} className={styles.tintedGlyph}
            style={{ left, top, width: glyph.width, height: NUMBER_HEIGHT, background: color, maskImage: `url(${src})`, WebkitMaskImage: `url(${src})` }} />
        )
      })}
    </>
  )
}

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
        const right = box.x + 13 + Math.ceil(glyphsWidthOf(glyphs) / 2)
        return (
          <div key={key}>
            <img className={styles.layer} alt="" src={RADAR_LABEL_BOX_IMAGE} style={{ left: box.x, top: box.y }} />
            <img className={styles.layer} alt="" src={`${IMG_TEXT}/${String(RADAR_LABEL_FRAMES[axis]).padStart(3, '0')}.png`}
              style={{ left: box.x + 3, top: box.y + 3 }} />
            {/* 숫자 (상자x+18, 상자y+17) — 가운데 기준은 추정 */}
            {color === null
              ? <SpriteNumber glyphs={glyphs} right={right} boxTop={box.y + 17} boxHeight={NUMBER_HEIGHT} />
              : <TintedNumber glyphs={glyphs} right={right} top={box.y + 17} color={color} />}
          </div>
        )
      })}
    </>
  )
}
