/**
 * 자동진행 중계 화면이 쓰는 **다른 조각** — 중계 화면 틀(`pages/auto-play-relay` — 0x41230 배경 · 중계 칸)과 그 배경인 수비 운동장 그림
 * (`pages/defense`). 조각 경계를 넘는 import 를 이 파일 한 곳에 모은다(`lint.boundaries-baseline.js` 의 예외는 이 파일 하나).
 */
export { DEFENSE_BACKGROUND_URL } from '@/pages/defense/lib/defenseView'
export { relayFieldBackgroundAt } from '@/pages/auto-play-relay/lib/relayFieldBackground'
export { AutoPlayRelayScreen } from '@/pages/auto-play-relay'
