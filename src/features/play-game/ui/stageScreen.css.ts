import { style } from '@vanilla-extract/css'
import { SCREEN_LAYERS } from '@/shared/config/screenLayers'

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
  selectors: {
    /**
     * 메뉴가 띄운 질문 · 알림 상자 0x74ef5(`MessageBox`)가 서 있는 동안은 층째 상자 겹(`POPUP_WINDOW`)으로 — 층(6)이 겹 묶음을
     * 만들어 상자(10)가 그 안에 갇히면 화면의 '*' 누름 칸(7)이 상자 위로 새어 누름을 먹는다. 떠 있으면 키는 상자 것이다(0x754f9 —
     * 장면 키 0x498d4 의 '*' 가지까지 가지 않는다). 일시정지 판만 있을 때는 6 그대로라 '*' 가 판을 닫는다(0x3c1a8) (r212, r207 과 같은 일)
     */
    '&:has(> [role="dialog"])': { zIndex: SCREEN_LAYERS.POPUP_WINDOW },
  },
})
