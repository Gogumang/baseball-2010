import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
import { SeasonStatusPanel } from '@/pages/season/ui/SeasonStatusPanel'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'

export interface SeasonEventUnderlayProps {
  readonly record: SeasonRecord
  readonly teamMorale: number
  readonly gamePoint: number
  /**
   * [이벤트+0xb] — 경기 뒤 평가 내장 이벤트(0x8a6fc, 0x8a71e 가 1)일 때만 참. 이벤트 끝 0x8a380 이 0 으로 지운다.
   * 시즌 웹은 파일 이벤트(s_event)와 연초 목표(0x8a680 — 0 그대로)만 틀어 늘 거짓이다.
   */
  readonly isPreviousGame?: boolean
}

/**
 * 이벤트 재생 0xd3 의 밑그림 — 그리기 0xa09c → 대화창 **0x8b5ac** (직접 떴다, 0x8b5ac~0x8b62e):
 * ```
 * [gfx+0x174] ∈ {0x70, 0x71}     → 외출 지도 0x7ea64(gfx, −1, 0)      ; 시즌 상태(0xc8~)로는 서지 않는다
 * 그 밖                           → 공 무늬 0x5fd61(skin, 0, 0, W, H) · 상태판 0x7d34c(gfx, [이벤트+0xb]) · 머리띠 0x7f4ec
 * ```
 * 그 위에 대화창(초상화 · 글)이 얹힌다. 0x8b5ac 가 거짓(줄이 다 끝남)이면 0xa09c 가 이전 상태 0xd1·0xd2 → 외출 지도,
 * 아니면 공통 틀 0x9f60 — 마지막 한 틀이라 웹은 따지지 않는다. 머리띠는 0xb810 의 "그 밖" 갈래(제목 10 · 바닥 5).
 */
export function SeasonEventUnderlay({ record, teamMorale, gamePoint, isPreviousGame = false }: SeasonEventUnderlayProps) {
  return (
    <>
      <SkinBackdrop kind="공무늬" />
      <SeasonStatusPanel record={record} teamMorale={teamMorale} isPreviousGame={isPreviousGame} />
      <ScreenFrame title="시즌모드" gamePoint={gamePoint} onBack={null} footer={5} />
    </>
  )
}
