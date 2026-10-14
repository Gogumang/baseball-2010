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
import { useRadarGrowth } from '@/shared/lib/radarGrowth/useRadarGrowth'
import { abilityChartFrameOf } from '@/pages/create-player/lib/teamSelectLayout'

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
export function TintedNumber({ glyphs, right, top, color }: {
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

/** ABILITY 레이더 (0x5a990) — 타자 능력치 네 칸 (축 이름 41~44 히트 · 파워 · 수비 · 주루) */
export function RadarChart({ base, shown }: { readonly base: BatterAbility; readonly shown: BatterAbility }) {
  return <AbilityRadar base={KEYS.map((key) => base[key])} shown={KEYS.map((key) => shown[key])} labelFrames={RADAR_LABEL_FRAMES} />
}

/**
 * 레이더 0x5a990 — 999 기준, 축 이름 상자, 숫자 색 비교. 축 이름은 첫 스택 인자(모드)가 고른다(0x5aa40~0x5aafc):
 * 2(타자) → 이름 번호 4~7 · 3(투수) → 0~3, img_text 프레임 = 37 + 번호(37 제구 · 38 구속 · 39 변화 · 40 체력 · 41 히트 …).
 * 나리 카드 0x7ba44 는 0x7b970(타자편)이면 2, 아니면 3 을 넘긴다(0x7c098~0x7c0aa).
 */
export function AbilityRadar({ base, shown, labelFrames }: {
  readonly base: readonly number[]
  readonly shown: readonly number[]
  readonly labelFrames: readonly number[]
}) {
  const origins = useFrameOrigins('./sprites/mode_ui/frames')
  // 자라는 애니 — 꼭짓점 · 숫자는 지금값(E+8), 숫자 색은 카드가 견준 최종값 그대로(0x5ad94)
  const current = useRadarGrowth(shown)
  const points = current.map((value, axis) => radarPointOf(axis, value))
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
      {/* 0x764c8: 바탕 0x7633c(고정 29 마름모 #6B92F4) → 도형 0x75e30(채움 · 흰 테두리) → 축 이름 줄 0x5abe2~(기준점 → 지금 꼭짓점) */}
      <svg className={styles.board} viewBox="0 0 240 320">
        <polygon points={abilityChartFrameOf(RADAR_CENTER).map((point) => `${point.x},${point.y}`).join(' ')}
          fill="none" stroke={RADAR_COLORS.axis} />
        <polygon points={points.map((point) => `${point.x},${point.y}`).join(' ')}
          fill={RADAR_COLORS.fill} fillOpacity={RADAR_COLORS.fillOpacity} stroke={RADAR_COLORS.edge} />
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
            <img className={styles.layer} alt="" src={`${IMG_TEXT}/${String(labelFrames[axis]).padStart(3, '0')}.png`}
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
