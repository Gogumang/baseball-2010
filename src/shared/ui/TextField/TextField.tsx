import type { InputHTMLAttributes } from 'react'
import * as styles from '@/shared/ui/TextField/TextField.css'

type TextFieldProps = InputHTMLAttributes<HTMLInputElement>

/** 한 줄 텍스트 입력 프리미티브. */
export function TextField({ className, type = 'text', ...props }: TextFieldProps) {
  const classes = [styles.field, className].filter(Boolean).join(' ')
  return <input type={type} className={classes} {...props} />
}
