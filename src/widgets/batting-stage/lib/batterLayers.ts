/**
 * 타자 그림 (binary.mod 0xb905c 자세 · 0x78cfc 레이어 — 위치 분석 5차, 바이트 확인).
 * 모든 레이어를 같은 앵커에 프레임 원점대로 겹친다. 레이어 폴더 프레임 = 자세 f + 레이어 가산값.
 *   bodyType t = 타자 폼 >> 1 (0 balancer · 1 sluger) — `bodyTypeOf` 참고.
 * 아이템 레이어(머리 +0x1c · 손 +0x14/+0x20/+0x44 · 다리 +0x28)는 장비 등급 순번 n 으로 고른다 —
 * `equipmentGradeOf`·`batterEquipmentOf` 주석 참고 (0x78fd8 적재 · 0x78cfc 겹치기, 디스어셈 확인).
 * 그림자는 `fig+0x48` 이 0 이 아닐 때만 그린다 — 그리기가 슬롯 배열 둘(sp+0x34·sp+0x58, 9칸)을
 * 비운 뒤 `0x78dc6 cmp r3,#0 ; beq` 로 **슬롯 0(그림자)만** 가른다 (다른 슬롯은 +0x3e~+0x44 쪽).
 * `+0x48` 을 쓰는 자리는 여섯뿐이고 다시 1 로 켜는 자리는 없다 (디스어셈 확인):
 *   0x76826 = 1  타자·투수 공용 베이스 생성자 0x767ec (+0x18 batter_shadow · +0x2c batter_ghost)
 *   0x1085c = 0  0x10810 마이리그 관리 공용 (기본정보 카드 · 훈련 팝업 125)
 *   0x5238  = 0  0x5198 시즌 0xde·0xd9
 *   0x55d4  = 0  0x5404 모드 0xdc 상점
 *   0x613a  = 0  0x5f3c 상태 102 등록(선수 생성)
 *   0x652d6 = 0  위젯 0x6517c
 * 그래서 경기 타석·선수영입(0xe1dc)·명예의 전당 계열은 켜진 채다 — `withShadow` 기본값 true.
 *
 * 파일 끝에 **투수 장비 레이어**(0x79790 적재 · 0x79524 겹치기)도 같이 있다 — 같은
 * `BatterLayer`·`layerPaletteIndexOf` 를 쓰기 때문이다. 두 쪽 차이는 `PitcherEquipment` 주석 참고.
 */

export type { BatterLayer } from '@/widgets/batting-stage/lib/batterLayers/batterFolders'
export { equipmentGradeOf, NO_EQUIPMENT, batterEquipmentOf } from '@/widgets/batting-stage/lib/batterLayers/batterEquipment'
export type { BatterEquipment } from '@/widgets/batting-stage/lib/batterLayers/batterEquipment'
export {
  bodyTypeOf,
  batterLayerPaletteIndex,
  layerPaletteIndexOf,
  pitcherLayerPaletteIndexOf,
  layerRecolorRequestsOf,
} from '@/widgets/batting-stage/lib/batterLayers/layerPalette'
export { isAceBatterOrder, batterFrameAt, batterPoseFramesOf, aceBatterPoseFramesOf } from '@/widgets/batting-stage/lib/batterLayers/batterPose'
export { batterLayersOf, aceBatterLayersOf } from '@/widgets/batting-stage/lib/batterLayers/batterLayerOrder'
export {
  NO_PITCHER_EQUIPMENT,
  pitcherEquipmentOf,
  pitcherEquipmentOfNibbles,
  pitcherLayersOf,
} from '@/widgets/batting-stage/lib/batterLayers/pitcherLayers'
export type { PitcherEquipment } from '@/widgets/batting-stage/lib/batterLayers/pitcherLayers'
