import { TIMER_ICON, TIMER_STRIP, timerGlyphsOf } from '@/pages/mission-play/lib/missionHudLayout'
import * as styles from '@/pages/mission-play/ui/MissionHud.css'
import { solidColorCss } from '@/shared/lib/pixelEffect/pixelEffect'
import { spriteMaskImage } from '@/shared/lib/sprite/spriteMask'
import { Sprite } from './hudSprites'

/** 시계 0x361e4 — 왼쪽 띠 · 시계 그림 · 꺼진 "88" 위 켜진 분 · 초(단색 찍기) · 쌍점. 띠는 캔버스가 그리면 뺀다 */
export function HudTimer({ seconds, stripsOnStage }: { readonly seconds: number; readonly stripsOnStage: boolean }) {
  const timer = timerGlyphsOf(seconds)
  return (
    <div data-testid="미션-시계">
      {!stripsOnStage && <Sprite sprite={TIMER_STRIP} />}
      <Sprite sprite={TIMER_ICON} />
      {timer.glyphs.map((glyph, index) => {
        const mask = spriteMaskImage(glyph.src)
        return (
          <span
            key={index}
            className={styles.stamp}
            style={{ left: glyph.left, top: glyph.top, background: solidColorCss(glyph.color), maskImage: mask, WebkitMaskImage: mask }}
          />
        )
      })}
      {timer.dots.map((dot, index) => (
        <span key={index} className={styles.dot} style={{ left: dot.left, top: dot.top, width: dot.size, height: dot.size, background: dot.color }} />
      ))}
    </div>
  )
}
