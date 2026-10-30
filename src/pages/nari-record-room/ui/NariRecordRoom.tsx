import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import {
  RECORD_ROOM_PICK,
  batterYearCellNumberOf,
  batterYearCellTextOf,
  batterYearRowsOf,
  pitcherYearCellNumberOf,
  pitcherYearCellTextOf,
  pitcherYearRowsOf,
} from '@/pages/nari-record-room/lib/nariRecordRoom'
import type { RecordRoomPick } from '@/pages/nari-record-room/lib/nariRecordRoom'
import { NariRankingScreen } from '@/pages/nari-record-room/ui/nariRecordRoom/NariRankingScreen'
import { YearRecordScreen } from '@/pages/nari-record-room/ui/nariRecordRoom/YearRecordScreen'

export type NariRecordViewProps = {
  /** [장면+0x164] — 팝업 0x80 에서 고른 칸 */
  readonly pick: RecordRoomPick
  readonly gamePoint: number
  /** 124 취소 → 106 (0x1463c) */
  readonly onBack: () => void
} & ({ readonly edition: '타자'; readonly career: PlayerCareer } | { readonly edition: '투수'; readonly career: PitcherCareer })

/**
 * **상태 124** — 그림 0x16778: +0x164 ≠ 0 이면 0x5796c(순위기록), 아니면 0x5cfec(개인기록) · 머리띠 0x7f4ed.
 * 화면을 덮는다. 키는 잡는 단계에서 다 가져간다(관리 메뉴가 같은 키를 받지 않게).
 * 머리띠 0x7f4ed 의 제목 · 바닥은 124 진입이 아니라 **앞그림 0x16a34 끝의 0x16928** 이 틀마다 세운다 — 124(0x7c)는 0x76 · 0x65 ·
 * 0x6d · 0x80 어느 갈래도 아니라 기본 갈래 0x169ea = 0x7f53c(hdr, [장면+0xcc] == 4 ? 8 : 9, **5**, 0): 편 제목 · 바닥 5(되돌아가기).
 * 앞그림은 장면 틀 0x1cdec 의 0x1d332 가 상태와 상관없이 부르고 그리기표(0xcc884 → 0x16778)보다 앞이라 첫 그림부터 이 값이다.
 */
export function NariRecordView(props: NariRecordViewProps) {
  const title = props.edition === '타자' ? '나만의리그타자편' : '나만의리그투수편'
  if (props.pick === RECORD_ROOM_PICK.순위기록) {
    return <NariRankingScreen edition={props.edition} career={props.career} title={title} gamePoint={props.gamePoint} onBack={props.onBack} />
  }
  return props.edition === '타자' ? (
    <YearRecordScreen
      edition="타자"
      title={title}
      gamePoint={props.gamePoint}
      onBack={props.onBack}
      rows={batterYearRowsOf(props.career).map((stats) => ({
        textOf: (bit: number) => batterYearCellTextOf(stats, bit),
        numberOf: (bit: number) => batterYearCellNumberOf(stats, bit),
      }))}
    />
  ) : (
    <YearRecordScreen
      edition="투수"
      title={title}
      gamePoint={props.gamePoint}
      onBack={props.onBack}
      rows={pitcherYearRowsOf(props.career).map((stats) => ({
        textOf: (bit: number) => pitcherYearCellTextOf(stats, bit),
        numberOf: (bit: number) => pitcherYearCellNumberOf(stats, bit),
      }))}
    />
  )
}
