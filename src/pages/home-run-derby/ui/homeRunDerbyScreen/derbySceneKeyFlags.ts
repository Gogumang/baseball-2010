import type { HomeRunDerbySession } from '@/pages/home-run-derby/model/useHomeRunDerby'
import type { MenuOverlay } from './derbyScreenProps'

/** 경기 중 메뉴 · 조작방법 · 설정이 떠 있으면 경기 키가 안 간다(일시정지 팝업 0x754f9) */
function isSceneKeyBlocked(isMenuOpen: boolean, overlay: MenuOverlay | null) {
  return isMenuOpen || overlay !== null
}

/** 상태 0xe — 사람 OK 를 기다린다 (0x532b0) */
export function acceptsDerbyConfirm(session: HomeRunDerbySession, isMenuOpen: boolean, overlay: MenuOverlay | null) {
  return session.isAwaitingConfirm && session.result === null && !isSceneKeyBlocked(isMenuOpen, overlay)
}

/**
 * 판(0x17)이 도는 동안의 키 — 0x53420 이 키마다 0x587 을 보내 홈런 뒤면 건너뛴다(0x519cc).
 * 판이 끝나 히든 39 창 뒤에 필드 화면만 남긴 동안(`isPlayHeld`)은 판이 아니다
 */
export function isDerbyPlayRunning(session: HomeRunDerbySession, isMenuOpen: boolean, overlay: MenuOverlay | null) {
  return session.distanceBoard !== null && !session.isPlayHeld && session.result === null && !isSceneKeyBlocked(isMenuOpen, overlay)
}

/**
 * 원본 공용 키 처리 `0x498d4` 의 '\*'(소프트키1 −6 도 '\*', 498e8) — 경기 상태 0xd~0x15 면 경기 중 메뉴 0x3c02c 를 연다
 * (4991c~49922 — 모드를 안 본다). 더비(모드 7)도 경기 장면 0x104 라 그대로다. 로딩 판(7 · 9 · 8) · 판(0x17) · 결과 창(0x1a) ·
 * 벤치 클리어링(0x1e)은 범위 밖이고, 조작방법 뷰어의 키는 뷰어 0x637d0 만 받는다(0x3ca36).
 */
export function acceptsDerbyMenuKey(session: HomeRunDerbySession, isMenuOpen: boolean, overlay: MenuOverlay | null) {
  if (session.result !== null || session.loadingTip !== null || session.isBenchClearing) return false
  return (isMenuOpen || session.distanceBoard === null) && overlay !== '조작방법'
}
