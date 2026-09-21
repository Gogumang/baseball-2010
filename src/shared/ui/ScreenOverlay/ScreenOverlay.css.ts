import { style } from '@vanilla-extract/css'
import { theme } from '@/app/styles/theme.css'

/**
 * 화면 위에 얹히는 덮개를 **게임 화면 기둥에 가둔다**.
 *
 * 덮개(이벤트 대사창·돌발미션 창 …)는 화면과 **형제**로 그려지면서 `position: absolute; inset: 0`
 * 을 쓴다. 그런데 `#root` 는 창 전체 폭이라 그대로 두면 덮개가 창 전체로 퍼져 **초상화·대사가
 * 게임 화면 밖 구석에 나온다**. 여기서 240px 기둥으로 좁히고 `inset: 0` 의 기준점을 만들어 준다.
 *
 * 배율은 `PixelScreen` 과 같은 규칙이다 — 안쪽은 원작 좌표(240×320) 그대로 쓰면 된다.
 */
export const layer = style({
  position: 'absolute',
  inset: 0,
  display: 'flex',
  justifyContent: 'center',
  // 덮개가 없는 자리는 뒤 화면이 눌림을 받아야 한다
  pointerEvents: 'none',
})

export const column = style({
  position: 'relative',
  flex: 'none',
  width: theme.size.screenWidth,
  height: 'calc(100dvh / var(--zoom))',
  zoom: 'var(--zoom)',
  pointerEvents: 'auto',
})
