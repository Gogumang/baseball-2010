import type { ReactNode } from 'react'
import * as styles from '@/shared/ui/Text/Text.css'

interface TextProps {
  readonly children: ReactNode
}

/** 화면 아래쪽 조작 안내. 가장 흐린 색이라 본문을 가리지 않는다. */
export function Hint({ children }: TextProps) {
  return <p className={styles.hint}>{children}</p>
}

/** 판 안의 설명 한 줄. */
export function Notice({ children }: TextProps) {
  return <p className={styles.notice}>{children}</p>
}

/** 안타·삼진처럼 한 판의 결과를 크게 알리는 글자. */
export function BigResult({ children }: TextProps) {
  return <div className={styles.bigResult}>{children}</div>
}
