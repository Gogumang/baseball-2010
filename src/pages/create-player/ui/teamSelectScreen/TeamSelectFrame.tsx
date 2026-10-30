import type { ReactNode } from 'react'
import type { ScreenFrameTitle } from '@/widgets/screen-frame/lib/screenFrameLayout'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'

/**
 * 머리띠(제목)·바닥띠 — 원본 상태 101 그리기 0x15de4 도 이 둘을 얹는다 (P6 1-1 · R9 206 · F 489) — 와 그 위의 팝업.
 * 바닥띠의 "되돌아가기" 가 원본의 되돌아가기 소프트키다 (P6 1-1) — 따로 둔 버튼은 없앴다:
 * 흐름 배치라 스테이지 왼쪽 위 (0,0) 에 그려져 머리띠 제목을 가리고 있었다
 */
export function TeamSelectFrame({
  title = '팀선택',
  gamePoint = 0,
  slides,
  onBack,
  overlay,
}: {
  readonly title: ScreenFrameTitle | undefined
  readonly gamePoint: number | undefined
  readonly slides: boolean
  readonly onBack: () => void
  readonly overlay: ReactNode
}) {
  return (
    <>
      <ScreenFrame title={title} gamePoint={gamePoint} onBack={onBack} slides={slides} />
      {overlay}
    </>
  )
}
