import { placedFrame } from '@/widgets/batting-stage/lib/spriteLoader'
import { STAGE_HEIGHT, STAGE_WIDTH } from '@/widgets/batting-stage/lib/stageLayout'

/**
 * **소프트키 글자 "*MENU" · "#TIME"** — 타석 화면 공용 그리기 `0x4c4bc` 의 0x4c8e0~0x4c9fc (2026-10-08 직접 뜸):
 * ```
 * 4c8e0  상태 [+0x1c] − 0xd > 8 → 건너뜀                         ; 상태 0xd ~ 0x15 에서만
 * 4c8ee  (w, h) = 0xba815(game_ui [+0x1018], 0x5a, 종류 1)        ; 프레임 90 의 상자
 * 4c926  0xba759(game_ui, 0x5a, 종류 1, 0, H − h − 1, …)          ; "*MENU" 를 왼쪽 아래
 * 4c92e  0x38984(장면) 거짓 → 끝 ; 상태 − 0xe > 1 → 끝            ; '#' 교체 가능 · 상태 0xe · 0xf 만
 * 4c940  n = 0
 *        st[0x31 + st[9]](공격 팀 조작) == 0(사람) → n = u8 공격팀[+0x28c]   ; 벤치 타자 수
 *        st[0x31 + st[0xa]](수비 팀 조작) == 0(사람) → n = u8 수비팀[+0x33]  ; 벤치 투수 수 (둘 다 사람이면 이 값)
 * 4c99e  n ≤ 0 → 끝
 * 4c9a2  (w, h) = 0xba815(game_ui, 0x5b, 종류 1)
 * 4c9f8  0xba759(game_ui, 0x5b, 종류 1, W − w − 1, H − h − 1, …)  ; "#TIME" 을 오른쪽 아래
 * ```
 * 팀 칸 뜻은 '#' 키 가지 0x4994a 와 같다(I-controls 4b · R4 1a — 벤치 수가 0 보다 커야 교체 화면 0xb 가 열린다).
 * 곧 "#TIME" 은 **'#' 로 교체(대타 · 투수 교체)를 열 수 있을 때만** 뜨는 글자다. 0x38984 는 모드 4(나리 타자편) · 7(홈런더비)과
 * 모든 미션(5·6)을 막는다(Q2 2e) — 타석 화면을 쓰는 곳 가운데 팀 경기(모드 1·2·8·9)만 "#TIME" 이 선다.
 */

const GAME_UI_FRAMES = './sprites/game_ui/frames'

/** game_ui 프레임 90 "*MENU" · 91 "#TIME" — 둘 다 41 × 12, 원점 (0, 0) (origins.json) */
export const MENU_LABEL_FRAME = 0x5a
export const TIME_LABEL_FRAME = 0x5b
const LABEL_SIZE = { width: 41, height: 12 } as const

/** "*MENU" 왼쪽 위 = (0, H − h − 1) = (0, 307) */
export const MENU_LABEL_POSITION = { x: 0, y: STAGE_HEIGHT - LABEL_SIZE.height - 1 } as const
/** "#TIME" 왼쪽 위 = (W − w − 1, H − h − 1) = (198, 307) */
export const TIME_LABEL_POSITION = {
  x: STAGE_WIDTH - LABEL_SIZE.width - 1,
  y: STAGE_HEIGHT - LABEL_SIZE.height - 1,
} as const

/**
 * 웹 타석 단계 한 장면 — 원본 상태(경기 +0x1c)를 가르는 재료. `tick` 은 그 단계에 든 뒤 흐른 틱,
 * `isPaused` 는 공을 안 던지고 쉬는 중(0xd · 0xe 확인 대기, 경기 중 메뉴 따위)이다.
 */
export interface StagePhaseSnapshot {
  readonly kind: '대기' | '투구중' | '타격' | '결과'
  readonly tick: number
  readonly isPaused: boolean
}

/** 0xf 갱신 0x39c1c 가 틱 > 7 에서 0x10 을 예약한다 — '대기' 의 앞 9 그림이 0xf 다 (`stagePhaseTicks`) */
const STATE_F_TICKS = 9

/**
 * 지금 그림이 원본 상태 0xe · 0xf 인가 — "#TIME" 의 상태 조건.
 * '대기' 에서 쉬는 동안(0xe 확인 대기)과, 쉬지 않을 때 앞 9 그림(0xf)이다.
 * ⚠️ 근사: 웹 '대기' 의 쉬는 동안에는 0xd(두 그림)와 경기 중 메뉴도 섞인다 — 메뉴는 원본도 0xe · 0xf 위에 뜨는 팝업이다.
 */
export function isTimeLabelState(phase: StagePhaseSnapshot): boolean {
  if (phase.kind !== '대기') return false
  return phase.isPaused || phase.tick < STATE_F_TICKS
}

/**
 * "#TIME" 을 그리는가 — 상태 0xe · 0xf 이고 n(벤치 수) > 0.
 * `benchCount` 는 0x38984 가 참인 화면만 넘긴다(null = 0x38984 거짓 — 이 글자를 안 그린다).
 */
export function showsTimeLabel(phase: StagePhaseSnapshot, benchCount: number | null): boolean {
  return benchCount !== null && benchCount > 0 && isTimeLabelState(phase)
}

/**
 * 타석 캔버스 위에 "*MENU" · "#TIME" 을 그린다. 타석 화면이 서 있는 웹 단계(대기 · 투구중 · 타격 · 결과)는 모두
 * 원본 상태 0xd ~ 0x13 안이라 "*MENU" 는 늘 그린다.
 * ⚠️ 근사: 맞은 공 뒤 웹 '결과' 는 원본 인플레이(0x17, 그리기 0x46c88 이 0x4c4bc 를 안 부른다) 자리다 — 웹은 그 둘을 가르는 칸이
 *    없어 거기서도 "*MENU" 가 남는다.
 */
export function drawSoftKeyLabels(
  context: CanvasRenderingContext2D,
  phase: StagePhaseSnapshot,
  benchCount: number | null,
): void {
  drawLabel(context, MENU_LABEL_FRAME, MENU_LABEL_POSITION)
  if (showsTimeLabel(phase, benchCount)) drawLabel(context, TIME_LABEL_FRAME, TIME_LABEL_POSITION)
}

function drawLabel(context: CanvasRenderingContext2D, index: number, at: { readonly x: number; readonly y: number }): void {
  const frame = placedFrame(GAME_UI_FRAMES, index)
  if (frame === null) return
  context.drawImage(frame.image, at.x + frame.offsetX, at.y + frame.offsetY)
}
