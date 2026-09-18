import type { ButtonHTMLAttributes } from 'react'
import * as styles from '@/shared/ui/Button/Button.css'

export type ButtonVariant = keyof typeof styles.variant

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant
}

/** 앱 전역 버튼 프리미티브. 화면 컴포넌트는 배치만 맡고 색·상태 표현은 여기서 관리한다. */
export function Button({ variant = 'primary', className, type = 'button', ...props }: ButtonProps) {
  const classes = [styles.base, styles.variant[variant], className].filter(Boolean).join(' ')
  return <button type={type} className={classes} {...props} />
}
