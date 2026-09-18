import type { ReactNode } from 'react'
import { parseGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'
import * as styles from '@/pages/main-menu/ui/MainMenuScreen.css'

interface DescriptionPanelProps {
  /** StrMAINMENU 원문 (!N 줄바꿈 포함) */
  readonly raw: string
  readonly children?: ReactNode
}

/** 원본 흰 설명 패널(main_ui/003) 위에 StrMAINMENU 문구를 얹는다. */
export function DescriptionPanel({ raw, children }: DescriptionPanelProps) {
  const lines = parseGameMarkup(raw, [])

  return (
    <>
      <img className={styles.panel} src="/sprites/main_ui/003.png" alt="" />
      <div className={styles.panelText}>
        {lines.map((line, index) => (
          <p key={index}>{line.segments.map((segment) => segment.text).join('')}</p>
        ))}
        {children}
      </div>
    </>
  )
}
