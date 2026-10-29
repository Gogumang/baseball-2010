import type { CSSProperties, ReactNode } from 'react'
import type { ClipRect, HudGlyph, HudSprite } from '@/pages/mission-play/lib/missionHudLayout'
import * as styles from '@/pages/mission-play/ui/MissionHud.css'

export function Sprite({ sprite }: { readonly sprite: HudSprite }) {
  return (
    <img
      className={styles.sprite}
      style={{ left: sprite.left, top: sprite.top, ...(sprite.opacity === undefined ? {} : { opacity: sprite.opacity }) }}
      src={sprite.src}
      alt=""
      {...(sprite.testId === undefined ? {} : { 'data-testid': sprite.testId })}
    />
  )
}

export function Glyphs({ glyphs, testId }: { readonly glyphs: readonly HudGlyph[]; readonly testId: string }) {
  return (
    <>
      {glyphs.map((glyph, index) => (
        <img
          key={index}
          className={styles.sprite}
          style={{ left: glyph.left, top: glyph.top }}
          src={glyph.src}
          alt=""
          data-testid={testId}
          data-src={glyph.src}
        />
      ))}
    </>
  )
}

/** 자르기 창 — 안쪽은 다시 240×320 원본 좌표로 되돌려 놓는다 */
export function Clip({ rect, children }: { readonly rect: ClipRect | null; readonly children: ReactNode }) {
  if (rect === null) return <>{children}</>
  const style: CSSProperties = { left: rect.x, top: rect.y, width: rect.width, height: rect.height }
  return (
    <div className={styles.clip} style={style}>
      <div className={styles.unclip} style={{ left: -rect.x, top: -rect.y }}>
        {children}
      </div>
    </div>
  )
}
