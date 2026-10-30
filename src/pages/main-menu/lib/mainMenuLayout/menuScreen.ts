/** 화면 크기 · 글자 높이 · 칸 글자 표 — 바퀴 · 릴 · 판이 함께 쓴다 */
export const SCREEN_WIDTH = 240
export const SCREEN_HEIGHT = 320
/** 화면 가운데 */
export const SCREEN_CENTER_X = 120

/** `main_ui/frames` 글자 그림의 공통 높이 (원점표에서 읽었다) — 설명 판 안 큰 글자가 이 크기다 */
export const MENU_LABEL_HEIGHT = 27

/**
 * 칸 글자 표 0xcea6c (u32 6개, `ui/img_text` 프레임 번호) — 확정.
 * 상태 4 진입 0x258fc 가 `memcpy([0x1552d4c], 0xcea6c, 0x18)` 로 복사한다.
 * 0 게임시작 · 1 스페셜 · 2 도움말 · 3 환경설정 · 4 랭킹 · **26 게임문의** (5 는 "선물&추천" 이라 아니다).
 */
export const MENU_WHEEL_ITEM_FRAMES = [0, 1, 2, 3, 4, 26] as const
