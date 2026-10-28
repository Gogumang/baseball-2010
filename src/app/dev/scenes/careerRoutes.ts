// 나리 타자편 · 투수편 커리어 끝자락(포스트시즌 · 국가대항전 · 엔딩)으로 가는 공통 걸음.
import type { SceneHandles } from '@/app/dev/sceneShortcut'
import type { SceneStep } from '@/app/dev/scenes/steps'
import { wait, keyUntil, messageBoxHas } from '@/app/dev/scenes/steps'

/**
 * 134 진입 팝업(히든 팀 열림 · 칭호 8)을 OK 로 닫는다 — 대진판의 확인 칸(`NationalCupBracket` — 팝업이 다 닫혀야 선다)이 서면 멈춘다.
 * 대진판 확인 자체는 누르지 않는다
 */
export const CLOSE_CUP_ENTRY_POPUPS = keyUntil(
  'Enter',
  '134 진입 팝업 닫힘',
  () => document.querySelector('[role="group"][aria-label="국가대항전 대진"] button[aria-label="확인"]') !== null,
  700,
  10000,
)

/** 대진 128 위에 뜬 팝업 (타자편 화면 · 투수편 세션) — 없으면 null */
export const postseasonPopupOf = (h: SceneHandles): string | null => {
  if (h.screen.kind === '포스트시즌') return h.screen.popup?.kind ?? null
  if (h.screen.kind === '투수편' && h.pitcher.scene === '포스트시즌') return h.pitcher.postseasonPopup?.kind ?? null
  return null
}

/**
 * 내 시리즈 차례인 대진 128 에서 [다음](키 0x13da0 — 내 차례면 142) → 142 경기 준비 [확인] → 144 → 경기 장면 인트로를 OK 로 넘긴다.
 * `isStarted`(타자편 첫 내 타석 · 투수편 첫 구질 고르기 0xf)가 서면 더 누르지 않는다(타석 · 구질 고르기의 OK 를 먹지 않게)
 */
export const POSTSEASON_GAME_START = (isPrepare: (h: SceneHandles) => boolean, isStarted: (h: SceneHandles) => boolean): readonly SceneStep[] => [
  wait(600),
  keyUntil('Enter', '142 경기 준비', isPrepare, 700, 10000),
  wait(900),
  keyUntil('Enter', '포스트시즌 경기 시작', isStarted, 400, 90000),
  wait(300),
]

/** 끝난 대진(내 팀 우승)에서 [다음] → StrMODE[137] 우승 팀 발표(팝업 7) — `korean` 이면 OK 로 닫아 StrMODE[190] 내 팀 우승(팝업 8)까지 */
export const POSTSEASON_CHAMPION = (korean: boolean): readonly SceneStep[] => [
  wait(600),
  keyUntil('Enter', '우승 팀 발표 팝업 7 (StrMODE[137])', (h) => postseasonPopupOf(h) === '우승발표', 700, 10000),
  ...(korean
    ? [wait(700), keyUntil('Enter', '한국시리즈 우승 팝업 8 (StrMODE[190])', (h) => postseasonPopupOf(h) === '한국시리즈우승', 700, 10000)]
    : []),
  wait(900),
]

/** 대회가 끝난 대진판(진입 팝업 닫음)에서 확인(0x19fdc) → 결과 팝업 0x25 */
export const CUP_RESULT_POPUP: readonly SceneStep[] = [
  wait(600),
  CLOSE_CUP_ENTRY_POPUPS,
  wait(600),
  keyUntil('Enter', '국가대항전 결과 팝업 0x25', messageBoxHas('확인'), 700, 10000),
  wait(900),
]

/** 엔딩 141 이 선 뒤 — 연말 · 은퇴 이벤트(114)를 OK 로 넘긴다(선택지는 처음 커서). 엔딩 화면이 서면 멈춘다 */
export const EVENT_TO_ENDING = (isEnding: (h: SceneHandles) => boolean): readonly SceneStep[] => [
  keyUntil('Enter', '엔딩 141', isEnding, 300, 90000),
  wait(1500),
]
