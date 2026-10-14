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

export const frame = style({
  position: 'relative',
})

/**
 * 장면 위 팝업 판 — 경기 중 메뉴(0x741a0)는 원본도 장면 위에 뜬다. 판(240×320)을 덮고 메뉴 조각을 세로 가운데에 둔다.
 * ⚠️ 메뉴 모양은 아직 웹 판(`InGameMenu`)이다 — 자리만 장면 위로 옮겼다.
 */
export const popupLayer = style({
  position: 'absolute',
  inset: 0,
  zIndex: 5,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: '10px',
  padding: '0 10px',
  overflowY: 'auto',
})
