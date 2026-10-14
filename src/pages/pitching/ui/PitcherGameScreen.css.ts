import { style } from '@vanilla-extract/css'

/**
 * 타석 캔버스(240×320) 자리 — 상태 0xe 의 소개 판(`MatchupCards`, 원본 좌표)을 놓는다.
 * 투구 화면에는 0xd 그리기(타석 장면) 캔버스가 없어 판만 이 자리에 선다 (투수 미션 화면도 같이 쓴다).
 */
export const matchupFrame = style({
  position: 'relative',
  width: 240,
  height: 320,
  margin: '0 auto',
})

/**
 * 정산(0x19) 결과 배경 자리 — 타석 캔버스는 좌우 −10px 를 두므로(`BattingStage.css`) 여백 없는 RawScreen 에서는 10px 밀어
 * 원본 좌표 (0, 0) 에 맞춘다(`GameResultScreen.css` 의 backdrop 과 같다).
 */
export const settlementBackdrop = style({
  position: 'absolute',
  left: 10,
  top: 0,
  width: 240,
  height: 320,
  pointerEvents: 'none',
})

export const frame = style({
  position: 'relative',
})

/**
 * 장면 위 팝업 판 — 경기 중 메뉴(일시정지 창 0x741a0)는 원본도 장면 위에 뜬다. 판(240×320)을 덮고, 메뉴는 원본 좌표대로
 * 스스로 자리를 잡는다(`InGameMenu` — 그리기 0x3cdd0).
 */
export const popupLayer = style({
  position: 'absolute',
  inset: 0,
  zIndex: 5,
})
