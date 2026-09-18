import { style } from '@vanilla-extract/css'

/**
 * 훈련 팝업 (binary.mod 0x848d0, 서브 에이전트 B 확인).
 * 화면 좌표 그대로: 창 사각형은 mode_ui 프레임 10 박스0 = (0, 65, 240, 72) 이고
 * 연출은 (120, 137), 연출 잘라내기는 (0, 0, 240, 136), 창 배경은 (1, 66, 240, 70) 로 잘라낸다.
 * 그래서 판 높이를 게이지 바닥(137)까지 140 으로 둔다.
 */
export const SCENE_HEIGHT = 140

export const scene = style({
  position: 'relative',
  flex: 'none',
  width: '240px',
  height: `${SCENE_HEIGHT}px`,
  margin: '0 -10px',
  overflow: 'hidden',
})

/** 0x7b9ac(1, 66, -14): 잘라내기 (1, 66, 폭, 높이−14) 안에 mode_back 을 (1, 52) 에 그린다. */
export const windowClip = style({
  position: 'absolute',
  left: '1px',
  top: '66px',
  width: '239px',
  height: '70px',
  overflow: 'hidden',
})

/** 0xbae25(0, 0, 화면폭, 136): 연출과 캐릭터는 이 안에만 그린다. */
export const animationClip = style({
  position: 'absolute',
  left: 0,
  top: 0,
  width: '240px',
  height: '136px',
  overflow: 'hidden',
})

export const sprite = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

export const caption = style({
  position: 'absolute',
  left: '30px',
  top: '4px',
  padding: '1px 6px',
  borderRadius: '4px',
  background: 'rgba(0, 0, 0, 0.5)',
  color: '#ffd23f',
  fontSize: '11px',
  fontWeight: 700,
})
