import { style } from '@vanilla-extract/css'

/**
 * 타석 화면을 `RawScreen`(원본 240×320 한 장)에 놓는 틀.
 *
 * 타석 캔버스는 예전 `PixelScreen` 본문 여백을 넘으려 좌우 −10px 를 둔다(`BattingStage.css`). 여백 없는 RawScreen 에서는
 * 칸을 10px 밀어 캔버스를 원본 좌표 (0, 0) 에 맞춘다(`GameResultScreen.css` 의 정산 배경과 같다). 겹치는 판들은 이 칸 밖,
 * RawScreen 판 (0, 0) 기준으로 놓는다.
 */
export const canvasSlot = style({
  position: 'absolute',
  left: 10,
  top: 0,
  width: 240,
  height: 320,
})

/**
 * 경기 중 메뉴(일시정지 창 0x741a0 자리) — 판(240×320)을 덮는 층. 메뉴는 원본 좌표대로 스스로 자리를 잡는다
 * (`InGameMenu` — 그리기 0x3cdd0). 어둡게 층(inset 0)이 이 칸을 덮는다.
 */
export const menuLayer = style({
  position: 'absolute',
  inset: 0,
  zIndex: 6,
})
