import type { RecolorRequest } from '@/shared/lib/sprite/paletteSwap'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { batterEquipmentOf, batterLayersOf, layerPaletteIndexOf, layerRecolorRequestsOf } from '@/widgets/batting-stage/lib/batterLayers'
import type { BatterLayer } from '@/widgets/batting-stage/lib/batterLayers'

/** 카드 선수 그림의 겹 — 자세 0 · 그림자 끔(0x1085c `fig+0x48 = 0`) · 장착(또는 입혀 보는) 장비 */
export function basicInfoFigureLayersOf(career: PlayerCareer, figureEquipment?: PlayerCareer['equipmentLevels']): BatterLayer[] {
  return batterLayersOf(0, career.battingTypeIndex, batterEquipmentOf(figureEquipment ?? career.equipmentLevels), false)
}

/**
 * **기본정보 카드 선수 그림 미리 칠하기 요청** — 관리 화면이 서 있는 동안 걸어 두면(`useWarmRecoloredSprites`) '기본정보' 를 연 첫 그림부터
 * 칠한 몸통 · 헬멧 · 장비가 나온다. 원본은 관리 화면 셋업 0x10810 이 그림 객체를 적재(0x78ab0 · 0x78fd8)할 때 팔레트를 갈아 끼운다
 */
export function basicInfoFigureRecolorRequestsOf(career: PlayerCareer): RecolorRequest[] {
  return layerRecolorRequestsOf(basicInfoFigureLayersOf(career), (layer) => layerPaletteIndexOf(layer, career.skinIndex, career.teamId))
}
