import type { ReactNode } from 'react'
import * as styles from '@/shared/ui/TitleTag/TitleTag.css'

/** 획득한 칭호 하나를 다는 작은 딱지. */
export function TitleTag({ children }: { readonly children: ReactNode }) {
  return <span className={styles.tag}>{children}</span>
}
