/**
 * 선수 등록 화면이 쓰는 **다른 조각** — 원본은 등록 화면을 관리 화면 기본정보 카드(0x15e20)로 그린다(카드 좌표 · 레이더 · 카드 판,
 * `pages/management`). 공 무늬 바탕(`pages/special`) · 정보 칸 판(`pages/shop`)도 같다. 조각 경계를 넘는 import 를 이 파일 한 곳에 모은다.
 */
export { FIGURE_FOOT, INFO_BOARD } from '@/pages/management/lib/basicInfoLayout'
export { RadarChart } from '@/pages/management/ui/RadarChart'
export { CardPlate } from '@/pages/management/ui/CardPlate'
export { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
export { boardRectsOf } from '@/pages/shop/lib/equipmentWindowLayout'
