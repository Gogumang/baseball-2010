import { LeftFrame } from '@/shared/ui/LeftFrame/LeftFrame'
import { resumeLeftFrameCoverOpacityAt } from '@/pages/management/lib/nariYearCover'

/**
 * 이어하기 길의 앞 화면 틀 0~3 — 그리기가 없는 100 · 1 이라 버퍼에 남은 앞 장면 판(`LeftFrame`) 위에 쌓인 덮개
 * (`resumeCoverUnderlayAt` 의 '앞판' · `resumeLeftFrameCoverOpacityAt`). 네 틀 내내 같은 자리 같은 꼴이라 판은 처음 틀에 한 번 받는다
 */
export function YearCoverResumeLeftFrame({ frame }: { readonly frame: number }) {
  const opacity = resumeLeftFrameCoverOpacityAt(frame)
  return (
    <>
      <LeftFrame part="year-cover-resume-left" />
      {opacity > 0 && (
        <div data-part="year-cover-resume-cover" style={{ position: 'absolute', inset: 0, background: '#000000', opacity, pointerEvents: 'none' }} />
      )}
    </>
  )
}
