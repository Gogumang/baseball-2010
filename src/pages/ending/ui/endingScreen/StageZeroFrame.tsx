import { LeftFrame } from '@/shared/ui/LeftFrame/LeftFrame'

/**
 * **단계 0 의 화면 버퍼** — 그리기 0x882c4 가 단계 0 이면 곧장 돌아가(882c8) 버퍼에는 141 에 들어오기 전 화면의 마지막 틀이 남고
 * 효과기가 쌓인다(`shared/ui/LeftFrame`). 이어하기로 들어온 141(메인 메뉴 → 장면 0x106 → 상태 100 → 1 → 141)은 100 · 1 이 다시
 * 그리지 않아 장면 바꾸기 직전 판에 상태 1 의 단계 4 검정 덮기(13f88)가 한 번 얹힌다(r165 확정 — `endingStageZeroCoverOpacityAt`).
 */
export function StageZeroFrame({ cover }: { readonly cover: number }) {
  return (
    <>
      <LeftFrame part="stage-0" />
      {cover > 0 && (
        <div data-part="stage-0-cover" style={{ position: 'absolute', inset: 0, background: '#000000', opacity: cover, pointerEvents: 'none' }} />
      )}
    </>
  )
}
