import { useState } from 'react'
import type { PlayerDetailSource } from '@/entities/season-mode/model/entryEditor'
import { ENTRY_DETAIL_ORIGIN, PlayerDetailWindow, playerDetailOf } from '@/widgets/player-detail-window'
import type { PlayerDetail } from '@/widgets/player-detail-window'
import { useSceneTick } from '@/widgets/game-scene/model/useSceneTick'

/** 상세 창이 커서 줄에서 읽는 것 (`EntryFace` 의 두 칸) */
export interface EntryDetailRow {
  /** 능력치 네 칸 `0xb6414(rec, k, 1)` — 도형 (없으면 빈 배열) */
  readonly ability: readonly number[]
  /** 0x5b798 이 레코드에서 읽는 칸 — 없으면 값 칸을 비운다 */
  readonly detailSource?: PlayerDetailSource
}

/** 커서 줄의 상세 창 값 — 레코드 칸 재료가 없으면 도형만 (⚠️ 값 칸은 비운다) */
function entryDetailOf(row: EntryDetailRow, isPitcher: boolean): PlayerDetail {
  if (row.detailSource !== undefined) return playerDetailOf(row.detailSource)
  return { kind: isPitcher ? '투수' : '타자', abilities: row.ability, values: [] }
}

/** '0' 상세 창 시계 — 연 그림 · 도형을 다시 만든 그림 (틱) */
interface DetailClock {
  readonly isOpen: boolean
  readonly cursor: number
  readonly openedAt: number
  readonly radarAt: number
}

export interface EntryDetailOverlayProps {
  /** 편집기 [ed+0x424] — '0'(0x55920)이 뒤집고 초기화 0x5561c(556d6)가 닫는다 */
  readonly isOpen: boolean
  readonly cursor: number
  /** 커서 줄 — 없으면 안 그린다 */
  readonly row: EntryDetailRow | undefined
  readonly isPitcherTab: boolean
}

/**
 * 엔트리 목록 창 0x5cfec → 0x5c984 끝(0x5cfc8)의 **'0' 상세 창** — 0x5b798(ed, 투수 탭 ? 3 : 2, 커서 줄 레코드) = `PlayerDetailWindow`.
 * 창 자리는 편집기 '0' 0x55920 이 세운 (W/2 + 0x5c, H/2 − 0x60) = (212, 64). [ed+0x424] 를 켠 그림부터 창이 열리고(0x5c8aa),
 * 키 0x55864 머리(0x5589e~0x558c2)는 창이 떠 있고 목록 객체 [목록+0x25](0x6c030 이 커서가 바뀌면 1)가 서면 도형을 다시 만든다
 * ([[ed+0xd8]+0x1e3] = 0) — 웹은 커서가 바뀐 그림으로 본다. 같은 목록 창을 쓰는 화면(엔트리 편집 · 트레이드 0xe5 · 0xe6)이 같이 쓴다.
 */
export function EntryDetailOverlay({ isOpen, cursor, row, isPitcherTab }: EntryDetailOverlayProps) {
  const tick = useSceneTick(undefined, isOpen)
  const [clock, setClock] = useState<DetailClock>({ isOpen: false, cursor, openedAt: 0, radarAt: 0 })
  if (clock.isOpen !== isOpen) {
    setClock({ isOpen, cursor, openedAt: tick, radarAt: tick })
  } else if (clock.isOpen && clock.cursor !== cursor) {
    setClock({ ...clock, cursor, radarAt: tick })
  }
  if (!isOpen || !clock.isOpen || row === undefined) return null
  return (
    <PlayerDetailWindow
      detail={entryDetailOf(row, isPitcherTab)}
      origin={ENTRY_DETAIL_ORIGIN}
      draw={tick - clock.openedAt}
      radarDraw={tick - clock.radarAt}
      radarKey={clock.radarAt}
    />
  )
}
