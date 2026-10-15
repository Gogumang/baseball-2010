import { style } from '@vanilla-extract/css'
import { theme } from '@/app/styles/theme.css'

/**
 * `ScreenOverlay` 와 같은 240×320 기둥 — 다만 눌림은 통째로 뒤 화면에 넘긴다.
 * 0x103 은 상태 그리기 · 공용 창 다음에 파티클을 그리므로 화면 안의 겹(z 1~50 — 타이틀 판 · 이벤트 창 따위)보다 위에 둔다.
 */
export const layer = style({
  position: 'absolute',
  inset: 0,
  zIndex: 60,
  // 섞기는 이 겹에 건다 — z 를 준 겹은 제 쌓임 맥락이라 안쪽 캔버스에 걸면 투명한 겹 바닥과만 섞인다
  mixBlendMode: 'plus-lighter',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  pointerEvents: 'none',
})

/**
 * 파티클 캔버스 — 검게 칠한 판에 효과 2(더하기)로 그린 칸을 뒤 화면에 **더한다**(`plus-lighter`: 화면 + 칸, 채널 끝에서 자름).
 * 원본 0x973c5 의 `화면 + (그림·b) >> 8` 을 화면이 DOM 인 자리에서 그대로 내는 길이다(검은 칸은 0 을 더한다).
 */
export const canvas = style({
  flex: 'none',
  width: theme.size.screenWidth,
  height: theme.size.screenHeight,
  zoom: 'var(--zoom)',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})
