import type { MenuWheelUnderlay } from '@/pages/main-menu/lib/mainMenuLayout'
import * as styles from '@/pages/main-menu/ui/MainMenuScreen.css'

const MAIN_UI = './sprites/main_ui'

/**
 * 반원 바퀴 칸 밑판 한 장 — main_ui 이미지 0 · 1 · 2 (0x24b1c 24f6c~24f94, `menuWheelSlotDrawOf`).
 * 효과 0x11 · 인자 1 은 제 상자 안에서 상하로 뒤집는다(타석 3루 주자 창 `baseRunners` 의 좌우 뒤집기와 같은 꼴).
 * 메인 메뉴 `wheelLabels` 와 스페셜 바퀴(하위 6)가 같이 쓴다.
 */
export function MenuWheelUnderlayImage({ underlay }: { readonly underlay: MenuWheelUnderlay }) {
  return (
    <img
      className={styles.layer}
      data-wheel-underlay={underlay.image}
      style={{
        left: underlay.x,
        top: underlay.y,
        ...(underlay.flipsVertically ? { transform: 'scaleY(-1)' } : {}),
      }}
      src={`${MAIN_UI}/${String(underlay.image).padStart(3, '0')}.png`}
      alt=""
    />
  )
}
