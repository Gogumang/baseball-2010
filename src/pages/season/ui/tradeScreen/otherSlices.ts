/**
 * 트레이드 화면이 쓰는 **다른 조각** — 팀 고르기(`pages/create-player` 의 `TeamSelectScreen` 을 빌려 쓴다) · 공 무늬 바탕(`pages/special`).
 * 조각 경계를 넘는 import 를 이 파일 한 곳에 모은다(`lint.boundaries-baseline.js` 의 예외는 이 파일 하나).
 */
export { TeamSelectScreen } from '@/pages/create-player/ui/TeamSelectScreen'
export { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
