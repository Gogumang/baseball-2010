import { useRef } from 'react'
import type { ReactNode } from 'react'
import { FrameSprite, SpriteNumber } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { batterEquipmentOf, batterLayersOf, bodyTypeOf, layerPaletteIndexOf } from '@/widgets/batting-stage/lib/batterLayers'
import { glyphsWidthOf, numberGlyphsOf } from '@/pages/management/lib/managementLayout'
import {
  ABILITY_TITLE, RADAR_BACKGROUND_IMAGE, RADAR_CENTER, RADAR_COLORS, RADAR_LABEL_BOX_IMAGE,
  abilityColorOf, radarAxisEndOf, radarLabelBoxOf, radarPointOf,
} from '@/pages/management/lib/basicInfoLayout'
import { TintedNumber } from '@/pages/management/ui/RadarChart'
import { useRadarGrowth } from '@/shared/lib/radarGrowth/useRadarGrowth'
import { abilityChartFrameOf } from '@/pages/create-player/lib/teamSelectLayout'
import * as managementStyles from '@/pages/management/ui/ManagementScreen.css'
import { HALL_OF_FAME_FIGURE, figureHandOf } from '@/pages/special/lib/hallOfFameFigure'
import type { HallOfFameFigureLook } from '@/pages/special/lib/hallOfFameFigure'
import { FigureLayers, PitcherFigure, figureBatterWarmLayersOf } from '@/pages/special/ui/HallOfFameFigure'
import * as specialStyles from '@/pages/special/ui/SpecialScreen.css'
import {
  SEASON_CARD_BADGE, SEASON_CARD_BOARD, SEASON_CARD_FIGURE, SEASON_CARD_RADAR_LABELS,
  initialSeasonCardFigure, stepSeasonCardFigure, steppedBoardPointsOf,
} from '@/pages/season/lib/seasonPlayerCard'
import { CardPlate } from '@/pages/management/ui/CardPlate'
import type { SeasonCardFigureState } from '@/pages/season/lib/seasonPlayerCard'
import type { SeasonCardAbility } from '@/pages/season/lib/seasonPlayerDetail'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { TEAMS } from '@/shared/config/original/teams'
import { alignedPositionOf } from '@/pages/shop/lib/equipmentWindowLayout'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

const MODE_UI = assetUrl('./sprites/mode_ui/frames')
const IMG_TEXT = assetUrl('./sprites/img_text/frames')
const SLT_FRAME = assetUrl('./sprites/slt_frame')
const BACKGROUND_HALF = { width: 31, height: 62 }
/** num 20번대 숫자 높이 (관리 화면 레이더와 같다) */
const NUMBER_HEIGHT = 10

export interface SeasonPlayerCardProps {
  readonly teamId: number
  readonly isPitcher: boolean
  /** 그림 vt+8 · vt+0x14 에 넘기는 값 — 폼 · 피부 · 팀(내 팀) · 장비 니블 네 칸 */
  readonly look: HallOfFameFigureLook
  /** 레이더 네 칸 — `seasonCardAbilitiesOf` */
  readonly abilities: readonly SeasonCardAbility[]
  /**
   * 그리기 앞 0x45e8 이 도는가 — 0xd9 · 0xdc(종류 3) 에서만 돈다. 0xda(능력치 상세 창)는 0xae98 을 그대로 그리지만
   * 애니는 멈춘다. 다시 돌면 상태 틱이 0 부터라 애니도 새로 만든다(들어옴 0x5404).
   */
  readonly isAnimating: boolean
  /**
   * 딱지 [gfx+0x168] 이 서 있는가 — 이 장면에서 팀 고르기 0xca · 트레이드 0xe4 를 거쳤으면 참(`seasonPlayerCard.ts` 머리말).
   * 장비 창 0xdc 는 서 있어도 그리지 않는다(0x7bbe2 `cmp #0xdc`).
   */
  readonly hasCardBadge?: boolean
  /** 카드와 그림 사이에 그리는 것 — 0xd9 는 정보 칸 0x7c450 (0xae98 이 카드 · 정보 칸 · 그림 차례로 그린다) */
  readonly children?: ReactNode
}

/** 카드 0x7ba44 시즌 · 선수 갈래 + 선수 그림 (`lib/seasonPlayerCard.ts` 머리말) */
export function SeasonPlayerCard({
  teamId, isPitcher, look, abilities, isAnimating, hasCardBadge = false, children,
}: SeasonPlayerCardProps) {
  const pose = useSeasonCardFigurePose(!isPitcher, look.form, isAnimating)
  return (
    <div data-testid="시즌카드" data-pose={pose}>
      <CardPlate teamId={teamId} testIdPrefix="시즌카드" />
      {TEAMS[teamId] !== undefined && hasCardBadge && <SeasonCardBadge teamId={teamId} />}
      <SeasonCardRadar abilities={abilities} labelFrames={SEASON_CARD_RADAR_LABELS[isPitcher ? '투수' : '타자']} />
      {children}
      <SeasonCardFigure isPitcher={isPitcher} look={look} pose={pose} />
    </div>
  )
}

/** 0x45e8 를 갱신마다 한 번 — 상태 틱이 되돌아가면(다시 들어옴) 처음부터 */
function useSeasonCardFigurePose(isBatter: boolean, form: number, isAnimating: boolean): number {
  const tick = useUpdateCounter(isAnimating)
  const memory = useRef<{ tick: number; state: SeasonCardFigureState; key: string } | null>(null)
  const key = `${isBatter}:${form}`
  let current = memory.current
  if (current === null || current.key !== key || tick < current.tick) {
    current = { tick: -1, state: initialSeasonCardFigure(isBatter, form), key }
  }
  if (isAnimating) {
    let { state } = current
    for (let step = current.tick + 1; step <= tick; step += 1) state = stepSeasonCardFigure(state, step, isBatter)
    current = { tick, state, key }
  }
  memory.current = current
  return current.state.pose
}

/**
 * 로고 아래 · 위 딱지 [gfx+0x168] — 0x7bbda~0x7bdca (`SEASON_CARD_BADGE`). 로고가 있을 때만(0x7bbca 가 로고 갈래 안) 부른다.
 * 판 A slt_frame 9 + 팀 이름 img_text 0x41+팀(팔레트 0) · 판 B slt_frame 116 + img_text 157(팔레트 4).
 * img_text 157 "PLAYER" 그림은 이미 팔레트 4 색(#7B797B · #525152)으로 떠 있어 따로 칠하지 않는다.
 */
export function SeasonCardBadge({ teamId }: { readonly teamId: number }) {
  const origins = useFrameOrigins(IMG_TEXT)
  const { name, title, align } = SEASON_CARD_BADGE
  const text = (frame: number, part: typeof name | typeof title, testId: string) => {
    const origin = origins?.[String(frame).padStart(3, '0')]
    if (origin === undefined) return null
    const { x, y } = alignedPositionOf(part.board, origin.width, origin.height, align, part.ox, part.oy)
    return (
      <img className={managementStyles.layer} alt="" data-testid={testId} data-frame={frame} data-palette={part.palette}
        src={`${IMG_TEXT}/${String(frame).padStart(3, '0')}.png`} style={{ left: x + origin.x, top: y + origin.y }} />
    )
  }
  const board = (part: typeof name | typeof title, testId: string) => (
    <img className={managementStyles.layer} alt="" data-testid={testId} data-image={part.board.image}
      src={`${SLT_FRAME}/${String(part.board.image).padStart(3, '0')}.png`}
      style={{ left: part.board.x, top: part.board.y, width: part.board.width, height: part.board.height }} />
  )
  return (
    <div data-testid="시즌카드-딱지">
      {board(name, '시즌카드-딱지-이름판')}
      {text(name.frameBase + teamId, name, '시즌카드-딱지-팀이름')}
      {board(title, '시즌카드-딱지-머리판')}
      {text(title.frame, title, '시즌카드-딱지-머리글')}
    </div>
  )
}

/** 계단형 판 0x76724 — 채움 · 테두리, 위 세 변 y+1 밝은 선 · 아래 세 변 y+1 어두운 선 (관리 화면 판과 같은 그리기) */
export function SteppedBoard() {
  const points = steppedBoardPointsOf(SEASON_CARD_BOARD.top, SEASON_CARD_BOARD.height, SEASON_CARD_BOARD.offset)
  const line = (list: readonly { x: number; y: number }[]) => list.map((point) => `${point.x},${point.y + 1.5}`).join(' ')
  return (
    <svg className={managementStyles.board} viewBox="0 0 240 320" shapeRendering="crispEdges" data-testid="시즌카드-판">
      <polygon points={points.map((point) => `${point.x},${point.y}`).join(' ')} transform="translate(0.5 0.5)"
        fill={ORIGINAL_COLORS.boardFill} stroke={ORIGINAL_COLORS.boardEdge} strokeWidth={1} />
      <polyline points={line(points.slice(0, 4))} transform="translate(0.5 0)" fill="none" stroke={ORIGINAL_COLORS.boardHighlight} />
      <polyline points={line(points.slice(4).reverse())} transform="translate(0.5 0)" fill="none" stroke={ORIGINAL_COLORS.boardEdge} />
    </svg>
  )
}

/**
 * 레이더 0x5a990 — 관리 화면 `RadarChart` 와 같은 그리기에 축 이름 표만 종류(투수 3 · 타자 2)대로 고른다.
 * ABILITY 판(mode_ui 8) · 글(img_text 159) 도 0x7ba44 가 같은 자리에 찍는다.
 */
function SeasonCardRadar({ abilities, labelFrames }: {
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
      <img className={managementStyles.layer} alt="" src={`${IMG_TEXT}/${ABILITY_TITLE.frame}.png`}
        style={{ left: ABILITY_TITLE.centerX - 19, top: ABILITY_TITLE.y }} />
      <img className={managementStyles.layer} alt="" src={RADAR_BACKGROUND_IMAGE}
        style={{ left: RADAR_CENTER.x - BACKGROUND_HALF.width, top: RADAR_CENTER.y - BACKGROUND_HALF.height / 2 }} />
      <img className={managementStyles.layer} alt="" src={RADAR_BACKGROUND_IMAGE}
        style={{ left: RADAR_CENTER.x, top: RADAR_CENTER.y - BACKGROUND_HALF.height / 2, transform: 'scaleX(-1)' }} />
      {/* 0x764c8: 바탕 0x7633c(고정 29 마름모 #6B92F4) → 도형 0x75e30(채움 · 흰 테두리) → 축 이름 줄 0x5abe2~(기준점 → 지금 꼭짓점) */}
      <svg className={managementStyles.board} viewBox="0 0 240 320">
        <polygon points={abilityChartFrameOf(RADAR_CENTER).map((point) => `${point.x},${point.y}`).join(' ')}
          fill="none" stroke={RADAR_COLORS.axis} />
        <polygon points={points.map((point) => `${point.x},${point.y}`).join(' ')}
          fill={RADAR_COLORS.fill} fillOpacity={RADAR_COLORS.fillOpacity} stroke={RADAR_COLORS.edge} />
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
          <div key={axis} data-testid={`시즌카드-능력-${axis}`} data-value={ability.shown} data-color={color ?? ''}
            data-label={labelFrames[axis]}>
            <img className={managementStyles.layer} alt="" src={RADAR_LABEL_BOX_IMAGE} style={{ left: box.x, top: box.y }} />
            <img className={managementStyles.layer} alt="" src={`${IMG_TEXT}/${String(labelFrames[axis]).padStart(3, '0')}.png`}
              style={{ left: box.x + 3, top: box.y + 3 }} />
            {color === null
              ? <SpriteNumber glyphs={glyphs} right={right} boxTop={box.y + 17} boxHeight={NUMBER_HEIGHT} />
              : <TintedNumber glyphs={glyphs} right={right} top={box.y + 17} color={color} />}
          </div>
        )
      })}
    </>
  )
}

/** 0xae98 af28~af56 · 0xb1f8 b31a~b346 — 투수는 54×75 이미지를 두 배로, 타자는 겹침 그림을 박스 가운데 아래에 */
function SeasonCardFigure({ isPitcher, look, pose }: {
  readonly isPitcher: boolean
  readonly look: HallOfFameFigureLook
  readonly pose: number
}) {
  if (isPitcher) {
    const { image } = HALL_OF_FAME_FIGURE
    const { pitcherImage } = SEASON_CARD_FIGURE
    return (
      <div className={specialStyles.hofFigureImage} data-testid="시즌카드-투수그림"
        style={{
          left: pitcherImage.x, top: pitcherImage.y, width: image.width, height: image.height,
          transform: `scale(${pitcherImage.scale})`, transformOrigin: '0 0', imageRendering: 'pixelated',
        }}>
        <PitcherFigure look={look} pose={pose} />
      </div>
    )
  }
  const [hit, power, , run] = look.equipment
  const bodyType = bodyTypeOf(look.form)
  const equipment = batterEquipmentOf({ hit, power, run })
  const layers = batterLayersOf(pose, bodyType, equipment, false)
  return <FigureLayers layers={layers} x={SEASON_CARD_FIGURE.batter.x} y={SEASON_CARD_FIGURE.batter.y}
    isMirrored={figureHandOf(look) === 0} paletteOf={(layer) => layerPaletteIndexOf(layer, look.skin, look.team)}
    testId="시즌카드-타자그림" warmLayers={figureBatterWarmLayersOf(bodyType, equipment)} />
}

