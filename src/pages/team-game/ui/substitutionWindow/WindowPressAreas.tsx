import { PressArea } from '@/shared/ui'
import { CLEAR_PRESS_RECT } from '@/features/play-game/model/stagePressAreas'
import { CANCEL_KEY_OFFER } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import { SUBSTITUTION_WINDOW } from '@/pages/team-game/lib/substitutionWindow'
import type { SubstitutionRow } from '@/pages/team-game/lib/substitutionWindow'

const W = SUBSTITUTION_WINDOW

/** 마우스 길 — 벤치 줄(커서 줄이면 OK, 아니면 커서를 옮긴다) · ▲▼ 화살 자리 · "0 INFO" 자리 · 취소 */
export function WindowPressAreas({
  visible,
  cursorRow,
  move,
  confirm,
  toggleDetail,
  onCancel,
}: {
  readonly visible: readonly SubstitutionRow[]
  readonly cursorRow: number
  readonly move: (dy: number) => void
  readonly confirm: () => void
  readonly toggleDetail: () => void
  readonly onCancel: () => void
}) {
  return (
    <>
      {visible.map((row, offset) => (
        <PressArea
          key={row.index}
          label={offset === cursorRow ? `${row.name} 교체` : `${row.name} 고르기`}
          rect={{ x: W.cursorBox.x, y: W.bench.firstY + offset * W.bench.step, width: W.cursorBox.width, height: W.cursorBox.height }}
          onPress={() => (offset === cursorRow ? confirm() : move(offset - cursorRow))}
        />
      ))}
      <PressArea label="위" rect={{ x: W.arrows.x, y: W.arrows.upY[0], width: 13, height: 10 }} onPress={() => move(-1)} />
      <PressArea label="아래" rect={{ x: W.arrows.x, y: W.arrows.downY[1], width: 13, height: 10 }} onPress={() => move(1)} />
      <PressArea label="0 INFO" rect={{ x: W.info.x, y: W.info.y, width: W.info.width, height: W.info.height }} onPress={toggleDetail} />
      {/* ⚠️ 웹 자리: '#' · CLR 은 원본 화면에 글자가 없다 — 오른쪽 소프트키 자리를 빌린다. 투명 칸이라 터치 기기에는 '취소' 상황 버튼도
          낸다(r194) — 버튼은 Escape 키 사건이라 경기 화면의 CLR 듣는 곳(0x495fc 의 CLR 가지)과 같은 길이다 */}
      <PressArea label="# 취소" rect={CLEAR_PRESS_RECT} touchKey={CANCEL_KEY_OFFER} onPress={onCancel} />
    </>
  )
}
