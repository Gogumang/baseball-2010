import type { ReactNode } from 'react'
import { parseGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'

interface DescriptionPanelProps {
  /** StrMAINMENU 원문 (!N 줄바꿈 포함) */
  readonly raw: string
  readonly children?: ReactNode
}

/**
 * 원본 흰 설명 판(main_ui/003) 위에 얹는 StrMAINMENU 문구.
 * 판 그림과 칸 위치는 부르는 쪽(`MainMenuScreen`)이 원본 좌표로 그린다 — 여기는 글만 줄로 나눈다.
 */
export function DescriptionPanel({ raw, children }: DescriptionPanelProps) {
  const lines = parseGameMarkup(raw, [])

  return (
    <>
      {lines.map((line, index) => (
        <p key={index}>{line.segments.map((segment) => segment.text).join('')}</p>
      ))}
      {children}
    </>
  )
}
