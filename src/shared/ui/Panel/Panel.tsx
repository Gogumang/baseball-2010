import type { ReactNode } from 'react'
import * as styles from '@/shared/ui/Panel/Panel.css'

interface PanelProps {
  /** 없으면 제목 줄 자체를 그리지 않는다 — 원작에도 제목 없는 판이 있다. */
  readonly heading?: ReactNode
  /** 원작에는 제목만 띄우는 구역 표시용 판도 있어 내용은 없어도 된다. */
  readonly children?: ReactNode
}

/** 화면 안의 테두리 상자 한 칸. 원작의 패널과 같은 2px 테두리·배경을 쓴다. */
export function Panel({ heading, children }: PanelProps) {
  return (
    <div className={styles.panel}>
      {heading !== undefined && <h2 className={styles.heading}>{heading}</h2>}
      {children}
    </div>
  )
}
