import { FrameSprite } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { DOT_IMAGE, MAP_ANCHOR, MAP_FRAME, MAP_FRAMES, MAP_OPACITY, type MapRunner, runnerDotsOf } from '@/pages/defense/lib/fieldMap'
import * as styles from '@/pages/defense/ui/DefenseScreen.css'

/**
 * **수비 화면 작은 지도 0x395f4** — 바탕 game_ui 프레임 9 와 주자 점(이미지 21)을 반투명 12/16 으로 (0, 0) 기준 화면 좌표에.
 * 근거·차례는 `lib/fieldMap` 머리말. 테두리 칠은 데드존형 카메라에서만이라 웹(따라가기형)에는 없다.
 */
export function DefenseFieldMap({ runners }: { readonly runners: readonly MapRunner[] }) {
  const origins = useFrameOrigins(MAP_FRAMES)
  return (
    <div className={styles.fieldMap} data-testid="defense-field-map">
      <FrameSprite folder={MAP_FRAMES} frame={MAP_FRAME} origins={origins} x={MAP_ANCHOR.x} y={MAP_ANCHOR.y} style={{ opacity: MAP_OPACITY }} />
      {runnerDotsOf(runners).map((dot, index) => (
        <img
          key={index}
          className={styles.fieldMapDot}
          style={{ left: dot.x, top: dot.y, opacity: MAP_OPACITY }}
          src={DOT_IMAGE}
          alt=""
          data-testid="defense-field-map-dot"
        />
      ))}
    </div>
  )
}
