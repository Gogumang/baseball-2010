/**
 * 구단정보 · 정보 칸이 쓰는 **다른 조각** — 관리 화면 정보 칸 배치 · 판 꾸밈(`pages/management`) · 공 무늬 바탕(`pages/special`).
 * 조각 경계를 넘는 import 를 이 파일 한 곳에 모은다(`lint.boundaries-baseline.js` 의 예외는 이 파일 하나).
 */
export { INFO_BOARD, INFO_ROW_HEIGHT, INFO_ROW_STEP, INFO_TOP } from '@/pages/management/lib/basicInfoLayout'
export * as managementStyles from '@/pages/management/ui/ManagementScreen.css'
export { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
