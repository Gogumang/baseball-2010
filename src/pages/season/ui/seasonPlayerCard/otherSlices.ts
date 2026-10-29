/**
 * 시즌 카드가 쓰는 **다른 조각** — 관리 화면 카드 판 · 레이더 배치 · 숫자(`pages/management`), 능력치 판(`pages/create-player`),
 * 명전 선수 그림(`pages/special`), 정렬 0x24(`pages/shop`). 조각 경계를 넘는 import 를 이 파일 한 곳에 모은다.
 */
export { glyphsWidthOf, numberGlyphsOf } from '@/pages/management/lib/managementLayout'
export {
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
export { TintedNumber } from '@/pages/management/ui/RadarChart'
export { CardPlate } from '@/pages/management/ui/CardPlate'
export * as managementStyles from '@/pages/management/ui/ManagementScreen.css'
export { abilityChartFrameOf } from '@/pages/create-player/lib/teamSelectLayout'
export { HALL_OF_FAME_FIGURE, figureHandOf, type HallOfFameFigureLook } from '@/pages/special/lib/hallOfFameFigure'
export { FigureLayers, PitcherFigure } from '@/pages/special/ui/HallOfFameFigure'
export { figureBatterWarmLayersOf } from '@/pages/special/lib/figureWarmLayers'
export * as specialStyles from '@/pages/special/ui/SpecialScreen.css'
export { alignedPositionOf } from '@/pages/shop/lib/equipmentWindowLayout'
