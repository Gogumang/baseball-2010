import type { ReactNode } from 'react'
import * as styles from '@/shared/ui/DialogueBox/DialogueBox.css'

/** 원작 대사창. 줄 수가 들쭉날쭉해도 높이가 흔들리지 않게 최소 높이를 준다. */
export function DialogueBox({ children }: { readonly children: ReactNode }) {
  return <div className={styles.box}>{children}</div>
}
