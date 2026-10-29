import type { ReactNode } from 'react'
import { CommonPanel } from '@/shared/ui'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { PANEL, SCREEN, SETTINGS_FRAME } from '@/pages/settings/lib/settingsLayout'

/**
 * 머리띠 — 들어올 때마다 미끄러져 내려온다: 상태 8 진입 0x259fc(앞 상태가 0x20~0x22 가 아닐 때) ·
 * 0x20 진입 0x2421c · 0x21 진입 0x242a4 가 skin+0x84 = 1 을 세운다. 하위 페이지에서 **돌아온** 첫 화면은
 * 0x259fc 가 커서만 (0, 3/4/5) 로 두고 0x84 를 안 세워(0x25a28~0x25a4e) 다 내려온 그대로다.
 */
export function SettingsFrame({
  mainMenu,
  onBack,
  slides = true,
}: {
  readonly mainMenu: { readonly gamePoint: number } | undefined
  readonly onBack: () => void
  readonly slides?: boolean
}) {
  if (mainMenu === undefined) return null
  return <ScreenFrame title={SETTINGS_FRAME.title} gamePoint={mainMenu.gamePoint} footer={SETTINGS_FRAME.footer} onBack={onBack} slides={slides} />
}

/**
 * 판 (24, H/2 − h/2, 192, h) — 화면 가운데를 기준으로 위아래로 펴진다. 하위 페이지 0x20 · 0x21 용.
 * 공용 페이지 0x593c8 의 공통 앞부분이 모든 종류(8 · 0x20 · 0x21 · 0x22)에 같은 판을 그린다 —
 * `0x55e60(skin, W/2, H/2, 192, h, 0, 정렬 0x22, 0, 0, 제목 탭 1, 0)` (0x594f4~0x59510).
 */
export function UnfoldingPanel({ height }: { readonly height: number }) {
  return <CommonPanel x={PANEL.x} y={SCREEN.height / 2 - Math.trunc(height / 2)} width={PANEL.width} height={height} titleTab />
}

/**
 * 잘라내기 0xbae25 사각형 — 안의 그림은 화면 좌표 그대로 두고 바깥만 가린다.
 */
export function PanelClip({
  x,
  y,
  width,
  height,
  children,
}: {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly children: ReactNode
}) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, width, height: Math.max(0, height), overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: -x, top: -y, width: SCREEN.width, height: SCREEN.height }}>{children}</div>
    </div>
  )
}
