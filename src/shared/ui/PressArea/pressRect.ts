/** 240×320 원본 좌표의 누름 칸 (`PressArea` 의 `rect`) */
export interface PressRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/**
 * 바닥띠 **되돌아가기 표시** 자리 — `ScreenFrame` 이 바닥비트 0x4 일 때 game_frame 21(19×13)을 (206, 바닥 − 16 = 304) 에 그린다
 * (0x55226). 그 표시를 그대로 둔 채 위에 창이 뜨는 곳(기록실 · 구질 두 칸 팝업 따위)이 CLR 을 이 자리 누름 칸으로 받는다 (r186 —
 * 늘 있던 뒤로 버튼을 걷었다). 손가락 칸이라 사방 2px 넓힌다
 */
export const FOOTER_BACK_PRESS_RECT: PressRect = { x: 206 - 2, y: 304 - 2, width: 19 + 4, height: 13 + 4 }
