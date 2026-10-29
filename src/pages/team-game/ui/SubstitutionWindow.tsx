import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { FrameSprite, useImgTextPalette3 } from '@/shared/ui'
import { useSceneTick } from '@/widgets/game-scene/model/useSceneTick'
import { useMarkSkinNameBars } from '@/shared/lib/skinNameBars/skinNameBars'
import { HEADER_TEXT_FRAMES, SUBSTITUTION_WINDOW, changeFrameAt } from '@/pages/team-game/lib/substitutionWindow'
import type { PlayerDetail, SubstitutionRow } from '@/pages/team-game/lib/substitutionWindow'
import { PlayerDetailWindow, SUBSTITUTION_DETAIL_ORIGIN } from '@/widgets/player-detail-window'
import { CenteredImgText, CursorBox } from './substitutionWindow/cellParts'
import { RowCells } from './substitutionWindow/RowCells'
import { GAME_UI, GAME_UI_FRAMES, IMG_TEXT_FRAMES, pad, pixel } from './substitutionWindow/substitutionAssets'
import { WindowHeader } from './substitutionWindow/WindowHeader'
import { WindowPressAreas } from './substitutionWindow/WindowPressAreas'
import { useSubstitutionList } from './substitutionWindow/useSubstitutionList'

interface SubstitutionWindowProps {
  readonly kind: '투수' | '대타'
  readonly ourTeamId: number
  readonly current: SubstitutionRow
  readonly bench: readonly SubstitutionRow[]
  /** 그 벤치 칸(명단 칸)의 상세 창 값 (`playerDetailOf`) */
  readonly detailOf: (index: number) => PlayerDetail | null
  /** OK — 커서 줄의 명단 칸으로 교체를 확정한다 (0x495fc → 0x49598 · 상태 0x16) */
  readonly onConfirm: (index: number) => void
  /** '#' · CLR — 예약을 지우고 0xe 로 (0x495fc 0x49844) */
  readonly onCancel: () => void
}

const W = SUBSTITUTION_WINDOW

/**
 * **교체 창 0x384b8** — 투수 교체 · 대타 (배치 근거는 `lib/substitutionWindow` 머리말).
 * 키 0x495fc: '2'·↑ / '8'·↓ 목록(세로 감기) · OK·'5' 확정(상세 창이 떠 있으면 닫고 확정) · '0' 상세 창 · '#'·CLR 취소(부르는 쪽).
 * 마우스 길: 벤치 줄 누름 칸(커서 줄이면 OK, 아니면 커서를 옮긴다) · ▲▼ 화살 자리 · "0 INFO" 자리 · ⚠️ 웹 자리: 취소는 오른쪽 소프트키 자리.
 */
export function SubstitutionWindow({ kind, ourTeamId, current, bench, detailOf, onConfirm, onCancel }: SubstitutionWindowProps) {
  const tick = useSceneTick()
  // 0x37904 · 0x37e5c 그리기가 [skin+0x333] = 1 을 적는다(37a4a · 38044) — 앱에 하나인 스킨 칸이라 스페셜 에디트가 이어 본다
  useMarkSkinNameBars()
  const { list, detailOpenedAt, radarRestartAt, move, confirm, toggleDetail } = useSubstitutionList(tick, bench, onConfirm)
  const gameUi = useFrameOrigins(GAME_UI_FRAMES)
  const imgText = useFrameOrigins(IMG_TEXT_FRAMES)
  const palette3 = useImgTextPalette3()
  const isPitcher = kind === '투수'
  const visible = bench.slice(list.top, list.top + W.bench.visibleRows)
  const cursorRow = list.cursor - list.top
  const detailRow = bench[list.cursor]
  const detail = detailOpenedAt === null || detailRow === undefined ? null : detailOf(detailRow.index)

  return (
    <div data-testid={isPitcher ? '투수 교체 창' : '타자 교체 창'}>
      {palette3.definition}
      <WindowHeader isPitcher={isPitcher} ourTeamId={ourTeamId} tick={tick} paletteStyle={palette3.style} />

      {/* 지금 선수 칸 0x37904 — 머리 줄 + 값 줄 */}
      {HEADER_TEXT_FRAMES[isPitcher ? 'pitcher' : 'batter'].map((frame, column) => (
        <CenteredImgText key={column} origins={imgText} frame={frame} x={W.columnX[column]} y={W.current.headerY} width={W.columnWidth[column]} />
      ))}
      <RowCells row={current} y={W.current.cellY} isPitcher={isPitcher} gameUi={gameUi} imgText={imgText} testId="지금 선수" />
      <FrameSprite folder={GAME_UI_FRAMES} frame={changeFrameAt(tick)} origins={gameUi} x={W.change.x} y={W.change.y} />

      {/* 벤치 목록 0x37e5c — 6 줄 · 커서 상자 0x37dd4 */}
      {visible.map((row, offset) => (
        <RowCells
          key={row.index}
          row={row}
          y={W.bench.firstY + offset * W.bench.step}
          isPitcher={isPitcher}
          gameUi={gameUi}
          imgText={imgText}
          testId={`벤치 ${offset}`}
        />
      ))}
      {visible.length > 0 && <CursorBox rowY={W.bench.firstY + cursorRow * W.bench.step} tick={tick} />}
      {detail !== null && detailOpenedAt !== null && (
        <PlayerDetailWindow
          detail={detail}
          origin={SUBSTITUTION_DETAIL_ORIGIN}
          draw={tick - detailOpenedAt}
          radarDraw={tick - radarRestartAt}
          radarKey={radarRestartAt}
        />
      )}

      {/* 바닥 소프트키 자리 — game_ui 이미지 12 · "0 INFO" */}
      <img alt="" src={`${GAME_UI}/${pad(W.info.image)}.png`} style={{ ...pixel, left: W.info.x, top: W.info.y }} />
      <FrameSprite folder={IMG_TEXT_FRAMES} frame={W.info.textFrame} origins={imgText} x={W.info.textX - 1} y={W.info.textY} />

      <WindowPressAreas visible={visible} cursorRow={cursorRow} move={move} confirm={confirm} toggleDetail={toggleDetail} onCancel={onCancel} />
    </div>
  )
}
