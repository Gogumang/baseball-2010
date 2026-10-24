import { useLayoutEffect, useRef } from 'react'
import { takeLeftFrames } from '@/shared/lib/leftFrame/leftFrame'
import * as styles from '@/shared/ui/LeftFrame/LeftFrame.css'

interface LeftFrameProps {
  /** 시험 · 그림 갈래 표시 (`data-part`) */
  readonly part?: string
}

/**
 * **화면 버퍼에 남은 앞 화면** — 새 상태가 아무것도 안 그리는 틀(엔딩 141 단계 0 · 새 시즌 0x1b768 뒤 앞 상태가 어두워지는 틀)에
 * 원본 버퍼에 남는 그림. 같은 커밋에 내려간 앞 화면 판(`takeLeftFrames`)을 한 번 복제해 깐다. 앞 화면 판이 없으면(판 없는
 * 화면에서 왔다) 검정이다. ⚠️ 근사: 원본은 앞 상태가 그동안에도 그리기를 돌지만 웹은 마지막 판을 멈춘 채 깐다.
 */
export function LeftFrame({ part }: LeftFrameProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const isTakenRef = useRef(false)
  useLayoutEffect(() => {
    const host = hostRef.current
    // 시험용 엄격 모드의 두 번째 진입은 건너뛴다 — 처음 선 그 커밋에서만 앞 화면을 받는다
    if (host === null || isTakenRef.current) return
    isTakenRef.current = true
    for (const frame of takeLeftFrames()) {
      const copy = frame.cloneNode(true) as HTMLElement
      copy.removeAttribute('data-original-screen')
      Object.assign(copy.style, { position: 'absolute', left: '0', top: '0' })
      host.appendChild(copy)
    }
  }, [])
  return <div ref={hostRef} className={styles.host} {...(part === undefined ? {} : { 'data-part': part })} />
}
