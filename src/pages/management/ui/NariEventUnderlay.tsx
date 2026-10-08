import type { ReactNode } from 'react'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { currentTitleOf } from '@/entities/career/model/titles'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
import { ManagementBoard } from '@/pages/management/ui/ManagementBoard'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'

export interface NariEventUnderlayProps {
  readonly career: PlayerCareer
  /** [이벤트+0xb] — 경기 뒤 평가 내장 이벤트(0x8a6fc)일 때만 참 (`StatusValues`) */
  readonly isPreviousGame?: boolean
  /**
   * 상태판과 머리띠 사이 — 이벤트 끝 틀(0x19da4)의 커맨드 줄 0x7e418(`NariMainCommandBar`). 재생 중(0x8b5ac)에는 없다
   */
  readonly children?: ReactNode
}

/**
 * 나리 이벤트 재생 114 의 밑그림 — 그리기 0x19e64 → 대화창 **0x8b5ac** (직접 떴다):
 * ```
 * 앞그림 0x16a34 → 0x16928   공 무늬 0x5fd61 · 판에 머리띠 (제목 8 나만의리그타자편, 바닥 5)
 * 0x8b5ac  [gfx+0x174] ∈ {0x70, 0x71}  → 외출 지도 0x7ea64
 *          그 밖                        → 공 무늬 · 상태판 0x7d34c(gfx, [이벤트+0xb]) · 머리띠
 * ```
 * [gfx+0x174] 는 0x7e84c 가 마지막으로 받은 상태다 — 0x1cdec 가 114 밖 상태가 바뀔 때마다 그 상태로 부르고, 140 진입
 * 0x10df8 은 0x70 으로 부른다. 그래서 112(외출 지도)·113(장소)·140(마선수 대결 결과) 뒤 이벤트는 지도 위,
 * 105 · 115 · 116 · 117 · 130~138 뒤 이벤트는 이 밑그림 위에 뜬다.
 * 115 · 116 · 117 · 132 · 136 · 138 · 140 의 걸침 그림(0x11de4 · 0x11e0c · 0x11e34 · 0x11e5c · 0x11dbc)도 상태판 + 머리띠다.
 * 재생이 끝난 틀(0x8b5ac 가 0)은 0x19e64 가 0x19da4(커맨드 줄 · 상태판(0) · 머리띠)를 그린다 — `useEventEndFrame` · `children`.
 */
export function NariEventUnderlay({ career, isPreviousGame = false, children }: NariEventUnderlayProps) {
  return (
    <>
      <SkinBackdrop kind="공무늬" />
      <ManagementBoard career={career} titleName={currentTitleOf(career)} hour={new Date().getHours()} isPreviousGame={isPreviousGame} />
      {children}
      <ScreenFrame title="나만의리그타자편" gamePoint={career.gamePoint} onBack={null} footer={5} />
    </>
  )
}
