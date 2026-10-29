/**
 * **16비트(RGB565) 화면 연산** — 스킨 바탕 0x581dc · 0x58371 이 화면을 떠 두기 전에 하는 흐리기 · 3줄 선 · 흰 단계 3 덮기
 * (근거는 `pages/special/lib/skinBackdrops.ts` 머리 1-1 ~ 1-3). 메뉴 바탕과 경기정보 구장 미리보기(0x5fd04 → 0x581dc)가 같이 쓴다.
 *
 * 쪼갠 파일: `color565`(565 ↔ RGB · 흰 단계 3) · `blur565`(0xbdc2c · 0xc3468) · `backdrop565`(다시 짓기 꼬리) · `zoom565`(0xbb43c) · `canvas565`(캔버스 왕복)
 */
export { rgbOf565, rgbTo565, whitenStep3Of565 } from '@/shared/lib/screen565/color565'
export { blurRightDown565, blurScreen565 } from '@/shared/lib/screen565/blur565'
export { finishSkinBackdrop565 } from '@/shared/lib/screen565/backdrop565'
export { applyZoom565, zoomSourceIndexes } from '@/shared/lib/screen565/zoom565'
export { editScreen565OnCanvas, finishSkinBackdropOnCanvas } from '@/shared/lib/screen565/canvas565'
