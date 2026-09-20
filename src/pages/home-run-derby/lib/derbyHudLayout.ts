/**
 * 홈런더비 HUD 배치 — 원본 `0x45a54`.
 *
 * 타석 화면 그리기 `0x4c4bc` 가 모드 7 이면 일반 점수판(`0x373d0`) 대신 이 함수를 부른다.
 * **확정된 것은 규칙뿐이다**:
 *   - 공 아이콘 **10칸** (그리기 0x3608c)
 *   - 공 번호 = `(보너스 중 ? 최대 콤보 : 10) − 남은 기회 + 1`
 *   - 최고 기록(저장 +0x5c, u16)과 지금 누적 비거리를 비교해 **넘으면 강조**
 *   - 스프라이트 `ui/combo.pzx` · `ui/result.pzx` · `ui/trainning.pzx`
 *
 * ⚠️ **좌표는 원본에서 못 읽었다 — 아래 값은 전부 내가 정한 배치다.** 고른 기준은
 * "일반 점수판이 있던 자리(6,6 에서 82×50)를 그대로 쓴다" 이다(renderHud 머리말).
 * 0x45a54 를 디스어셈으로 풀면 이 파일만 갈아 끼우면 된다.
 */

/** 일반 점수판과 같은 왼쪽 위 여백 (0x373d0 의 (6,6)) */
export const HUD_ORIGIN = { x: 6, y: 6 } as const

/**
 * 공 아이콘 — `ball.pzx` 의 9×9 짜리 그림을 쓴다.
 * (0x3608c 가 어느 스프라이트의 몇 번인지는 미확인이라 경기 공 그림으로 대신한다.)
 */
export const BALL_ICON = { url: './sprites/ball/007.png', size: 9, step: 10 } as const

/** 아이콘 줄의 왼쪽 위 */
export const BALL_ROW = { x: HUD_ORIGIN.x, y: HUD_ORIGIN.y } as const

export const ballIconLeftOf = (index: number) => BALL_ROW.x + BALL_ICON.step * index

/** 비거리 두 줄 — 지금 누적 / 최고 기록 */
export const DISTANCE_ROWS = {
  x: HUD_ORIGIN.x,
  firstY: BALL_ROW.y + BALL_ICON.size + 4,
  step: 12,
  /** num.pzx 숫자 한 줄 높이 */
  glyphHeight: 10,
  /** 숫자 오른쪽 끝 */
  right: HUD_ORIGIN.x + 74,
} as const

export const distanceRowTopOf = (row: number) => DISTANCE_ROWS.firstY + DISTANCE_ROWS.step * row

/** 콤보 그림 — `ui/combo.pzx` 합성 프레임 1 = "Combo" 글자 (46×11) */
export const COMBO_LABEL = { folder: './sprites/combo/frames', frame: 1, width: 46, height: 11 } as const

/** 콤보 줄은 화면 오른쪽 위에 둔다 (원본 좌표 미확인) */
export const COMBO_ROW = { x: 240 - 6 - COMBO_LABEL.width - 20, y: HUD_ORIGIN.y } as const

/** 마투수 이름 줄 — 단계 ≥ 1 일 때만 */
export const ACE_NAME_ROW = { x: HUD_ORIGIN.x, y: distanceRowTopOf(2) + 2, width: 120 } as const

/**
 * 이벤트 존 그림 자리 — 원본은 **공이 있던 자리**에 놓는데(0x36dfc) 이식판 타석 화면은
 * 타구를 그리지 않아 공 자리가 없다. 화면 위쪽 1/3 안(= 원본 조건 "화면 y < 높이/3")
 * 한가운데에 띄운다. **내가 정한 자리다.**
 */
export const EVENT_ZONE_SPOT = { x: 120 - 35, y: Math.trunc(320 / 3) - 66, parts: ['./sprites/event_zone/000.png', './sprites/event_zone/001.png'] } as const
