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
 * 화면에서 왔다) 검정이다. ⚠️ 근사(남김 — 웹 구조): 원본은 앞 상태가 그동안에도 그리기를 돌지만 웹은 마지막 판을 멈춘 채 깐다 — 137 표지는
 * 114 끝 · 이어하기 길의 105 뒤에서 앞 상태 그림을 매 틀 다시 그리고(`NariYearCoverScreen` 의 `previousScreenAt`) 134 · 141 과
 * 이어하기 길의 100 · 1 틀(그리기가 없다 — `YearCoverResumeLeftFrame`)에서 이 판을 쓴다.
 */
/**
 * `cloneNode` 는 캔버스 그림을 안 옮긴다(빈 캔버스가 된다) — 원본 판의 캔버스를 같은 차례로 짝지어 그림을 베낀다.
 * 내려간 판의 캔버스도 떼어 낸 뒤 그림을 그대로 들고 있다. 2D 로 못 여는 캔버스(WebGL 따위)는 건너뛴다.
 */
function copyCanvasPixels(from: HTMLElement, to: HTMLElement): void {
  const sources = from.querySelectorAll('canvas')
  const targets = to.querySelectorAll('canvas')
  sources.forEach((source, index) => {
    const target = targets[index]
    if (target === undefined || source.width === 0 || source.height === 0) return
    try {
      target.getContext('2d')?.drawImage(source, 0, 0)
    } catch {
      // 그림을 못 읽는 캔버스 — 빈 채로 둔다
    }
  })
}

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
      copyCanvasPixels(frame, copy)
      copy.removeAttribute('data-original-screen')
      Object.assign(copy.style, { position: 'absolute', left: '0', top: '0' })
      host.appendChild(copy)
    }
  }, [])
  return <div ref={hostRef} className={styles.host} {...(part === undefined ? {} : { 'data-part': part })} />
}
