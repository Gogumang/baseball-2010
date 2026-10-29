/**
 * **일반모드 준비 화면 배치 — 공통 자리** — 공용 목록 페이지 `0x63b15(skin, 목록, k, …)` 의 k = 2·3·4
 * (P6 2a-1 · 2a-4 · 2a-5 · 2a-6. 좌표는 확정, 스프라이트 이름 일부는 유력).
 *
 * 원본은 준비·스페셜 화면 열두 가지를 한 함수로 그린다. 어느 k 든 기준점 두 개로 잡힌다:
 * ```
 * 기본 A = (W/2 − 60, H/2 − 50) = (60, 110)   ·  B = (W/2 + 60, H/2 − 68) = (180, 92)
 * k 별 보정 (표 0xd1eac):  k 2 → A (58,107) B (178,96)  ·  k 3·4·5 → A (52,110) B (188,92)
 * ```
 * A 는 왼쪽(유저) 자리, B 는 오른쪽(CPU 또는 능력치) 자리다.
 *
 * 그림 폴더 규칙 (웹판 스프라이트): **이미지**는 `sprites/<이름>/NNN.png`,
 * **프레임**은 `sprites/<이름>/frames/NNN.png` 다. 노트가 "이미지 9" 라 하면 앞쪽,
 * "프레임 0" 이라 하면 뒤쪽이다.
 */
export const SCREEN = { width: 240, height: 320 } as const

/**
 * 팀 엠블럼 `0x5a7b9(skin, 팀, 기준점)` 은 기준점 가운데에 놓인다.
 * 웹판 `ui/team_logo` 는 77×76 이라 반쪽을 빼서 맞춘다 (팀 고르기 화면과 같은 값).
 */
export const TEAM_LOGO_HALF = { width: 38, height: 38 } as const

/** 잠긴 칸(히든 팀·잠긴 마선수) 자리에 그리는 원 두 개 (0x63ec4~0x63f10) */
export const LOCKED_CIRCLES = [
  { diameter: 77, color: '#5A86BD' },
  { diameter: 63, color: '#29348C' },
] as const

/** 이름 막대 — slt_frame **이미지 9** (82×15) 을 (A.x − 41, A.y + 40), 글은 그 +2 */
export const NAME_BAR = { image: 9, width: 82, height: 15, dx: -41, dy: 40, textDy: 42 } as const

/**
 * A·B 딱지 (0x65744, 모든 k 공통).
 *   A = slt_frame 이미지 116(57×15 흰 막대)을 (A.x − 28, A.y − 53), img_text 프레임을 그 +5
 *   B = slt_frame 이미지 `[sp+0xbc]` 를 (B.x − 28, B.y − `[sp+0xb8]`), 글은 그 +5
 *       기본은 117(파란 막대)·43 이고, **k 3~5 는 116·53** 이다
 */
export const TAG = {
  width: 57,
  height: 15,
  dx: -28,
  textDdy: 5,
  whiteBar: 116,
  blueBar: 117,
  aDy: -53,
  bDyDefault: -43,
  bDyMatchScreens: -53,
} as const

/**
 * 공용 목록 깜빡 [sp+0xd4] — 다섯째 인자(메인 메뉴 [메뉴+0x2c], 상태에 들어온 뒤 센 틱)가 `% 6 ≤ 3` 이면 1 (0x63b4a~0x63b5c).
 * [메뉴+0x2c] 는 메뉴 상태 객체(+0x18)의 틱 +0x14 다 — 0x32fa0 이 32fb8 에서 틀마다 0xbc9c9 로 +1 하고 상태가 바뀐 틀에 0 으로
 * 지운다(bc9ec, 2026-10-24 직접 떴다 — 시즌 0xe9ac · 나리 0x1cdec 도 같은 함수를 장면+0x18 로 부른다). 그리기는 같은 틀 뒤쪽이라
 * 진입 틀의 그림이 0 이다 — 웹은 화면을 띄운 앱 틱을 0 으로 센다(`useUpdateCounter`).
 */
export const isPrepareBobOn = (tick: number): boolean => ((tick % 6) + 6) % 6 <= 3
