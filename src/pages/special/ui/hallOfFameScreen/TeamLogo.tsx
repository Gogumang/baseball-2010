import { useState } from 'react'
import * as styles from '@/pages/special/ui/SpecialScreen.css'
import { TEAM_LOGO, imageSrc } from '@/pages/special/ui/specialScreen/specialAssets'

/** team_logo 프레임 `팀` 을 (x, y) 가운데에 — 0xba815 로 크기를 얻어 (x − (w >> 1), y − (h >> 1)) */
export function TeamLogo({ team, x, y }: { readonly team: number; readonly x: number; readonly y: number }) {
  const [size, setSize] = useState<{ readonly width: number; readonly height: number } | null>(null)
  return (
    <img
      className={styles.sprite}
      alt=""
      data-testid="명전-팀로고"
      src={imageSrc(TEAM_LOGO, team)}
      onLoad={(event) => setSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
      style={{
        left: x - ((size?.width ?? 0) >> 1),
        top: y - ((size?.height ?? 0) >> 1),
        visibility: size === null ? 'hidden' : undefined,
      }}
    />
  )
}
