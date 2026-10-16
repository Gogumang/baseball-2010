import { FrameSprite, PressArea, RawScreen, SpriteNumber } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { numberGlyphsOf } from '@/shared/lib/pixelNumber/pixelNumber'
import { TEAMS } from '@/shared/config/original/teams'
import type { SeasonDayBoard } from '@/entities/season-mode/model/seasonRecord'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { useSeasonCursor } from '@/widgets/season/model/useSeasonCursor'
import {
  BOARD_FRAME, BOARD_ROW_STEP, LOGO_INSET, RESULT_IMAGE, boardRowsOf, imageCenterOf, isWinA, isWinB,
  logoPanelRectsOf, rowPanelRectsOf, scoreRightOf, shifted,
} from '@/pages/season/lib/dayResultBoard'
import type { BoardBox, PanelRect } from '@/pages/season/lib/dayResultBoard'
import * as styles from '@/widgets/season/ui/SeasonEndWindow.css'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
import { roundFillPaintsOf } from '@/shared/lib/commonPanel/commonPanel'

export interface DayResultBoardScreenProps {
  /** SR+0x1c0 — 오늘 리그 다섯 경기 점수표 (내 경기 줄은 −1) */
  readonly board: SeasonDayBoard
  /** 확인(−5 · '5') — 키 0x49a4: 포스트시즌이면 0xef, 경기 수 짝수면 0xc9, 홀수면 0xd8 */
  readonly onConfirm: () => void
  /** 머리띠 G포인트 */
  readonly gamePoint: number
}

const paintStyle = (x: number, y: number, width: number, height: number, color: string) => ({
  position: 'absolute' as const,
  left: x,
  top: y,
  width,
  height,
  background: color,
  pointerEvents: 'none' as const,
})

/**
 * 0xb9f75(상자, 색) → 0x6a9f1 네모 칠 w × h · 0xba0bd(상자, 둥글기 1, 색) → 0x6b7d5 둥근 칠 — (w + 1) × (h + 1) 에 네 모서리 점만 빈다
 * (직접 떴다 — 0xb9fb6 · 0xba106, 칠 목록은 공용 `roundFillPaintsOf`)
 */
function PanelLayer({ rect }: { readonly rect: PanelRect }) {
  if (rect.round === 0) return <div style={paintStyle(rect.x, rect.y, rect.width, rect.height, rect.color)} />
  return (
    <>
      {roundFillPaintsOf(rect.width, rect.height, rect.color).map((paint, index) => (
        <div key={index} style={paintStyle(rect.x + paint.x, rect.y + paint.y, paint.width, paint.height, paint.color)} />
      ))}
    </>
  )
}

function ResultMark({ cell, isWin }: { readonly cell: BoardBox; readonly isWin: boolean }) {
  const image = isWin ? RESULT_IMAGE.win : RESULT_IMAGE.lose
  const at = imageCenterOf(cell, image.width, image.height)
  return (
    <img
      className={styles.sprite}
      style={{ left: at.x, top: at.y }}
      src={`${RESULT_IMAGE.folder}/${String(image.image).padStart(3, '0')}.png`}
      alt={isWin ? 'WIN' : 'LOSE'}
    />
  )
}

function TeamLogo({ cell, teamId }: { readonly cell: BoardBox; readonly teamId: number }) {
  const team = TEAMS[teamId]
  if (team === undefined) return null
  return (
    <img
      className={styles.logo}
      src={team.logoUrl}
      alt={team.name}
      style={{
        left: cell.x + LOGO_INSET,
        top: cell.y + LOGO_INSET,
        width: cell.width - LOGO_INSET * 2,
        height: cell.height - LOGO_INSET * 2,
      }}
    />
  )
}

/**
 * 경기 뒤 마무리 (장면 0x105 상태 **0xf1**) — 진입 `0x953c` · 키 `0x49a4` · 그림 `0xb400` (직접 떴다).
 *
 * 같은 날 리그의 다른 네 경기를 한 줄씩 — 두 팀 로고 · WIN/LOSE · 점수. 배치는 `dayResultBoard.ts` 머리 주석.
 * 진입 0x953c 는 CPU 트레이드 요청을 굴리고(`tradeRequest.ts`) 배경음 4 를 트는데, 그것은 세션이 맡는다.
 * 키는 확인(−5 · '5')만 받는다 — 취소는 없다.
 *
 * 로고 0x66431 은 미리 35×34 로 늘려 둔 버퍼를 (칸 + 2) 에 찍는다 — 칸 39×38 의 안쪽과 꼭 같다(`SeasonEndWindow.css` logo 주석).
 * 머리띠는 공통 틀 0xb810 이 0xf1 에 맡긴 (제목 10 시즌모드, 바닥 1) — 0xb880 → 0xb89e~0xb8a6, 되돌아가기 없음.
 *
 * ⚠️ 웹 자리: 확인은 원본 화면에 그림 자리가 없다 — 웹 단추를 걷고 화면 전체 투명 누름 칸으로 받는다.
 */
export function DayResultBoardScreen({ board, onConfirm, gamePoint }: DayResultBoardScreenProps) {
  const origins = useFrameOrigins(BOARD_FRAME.folder)
  useSeasonCursor({ count: 1, onSelect: onConfirm })
  const rows = boardRowsOf(board)

  return (
    <RawScreen>
      {/* 공통 앞그림 0xb810 — 0xf1 는 0xdd · 0xe0 · 0xe1 밖이라 공 무늬 0x5fd61(skin, 0, 0, W, H) 를 먼저 깐다 */}
      <SkinBackdrop kind="공무늬" />
      <div role="group" aria-label="오늘의 경기 결과">
        {rows.map((_row, index) => (
          <div key={`판${index}`}>
            {rowPanelRectsOf(shifted(BOARD_FRAME.row, index)).map((rect, layer) => (
              <PanelLayer key={`줄${layer}`} rect={rect} />
            ))}
            {[BOARD_FRAME.logoA, BOARD_FRAME.logoB].flatMap((cell, side) =>
              logoPanelRectsOf(shifted(cell, index)).map((rect, layer) => (
                <PanelLayer key={`로고칸${side}-${layer}`} rect={rect} />
              )),
            )}
            <FrameSprite folder={BOARD_FRAME.folder} frame={BOARD_FRAME.frame} origins={origins} x={0}
              y={index * BOARD_ROW_STEP} />
          </div>
        ))}

        {rows.map((row, index) => {
          const scoreA = shifted(BOARD_FRAME.scoreA, index)
          const scoreB = shifted(BOARD_FRAME.scoreB, index)
          return (
            <div key={`경기${index}`} role="group"
              aria-label={`${TEAMS[row.teamA]?.name ?? ''} ${row.scoreA} : ${row.scoreB} ${TEAMS[row.teamB]?.name ?? ''}`}>
              <TeamLogo cell={shifted(BOARD_FRAME.logoA, index)} teamId={row.teamA} />
              <TeamLogo cell={shifted(BOARD_FRAME.logoB, index)} teamId={row.teamB} />
              <ResultMark cell={shifted(BOARD_FRAME.resultA, index)} isWin={isWinA(row)} />
              <ResultMark cell={shifted(BOARD_FRAME.resultB, index)} isWin={isWinB(row)} />
              <SpriteNumber glyphs={numberGlyphsOf(row.scoreA)} right={scoreRightOf(scoreA, row.scoreA)}
                boxTop={scoreA.y} boxHeight={scoreA.height} />
              <SpriteNumber glyphs={numberGlyphsOf(row.scoreB)} right={scoreRightOf(scoreB, row.scoreB)}
                boxTop={scoreB.y} boxHeight={scoreB.height} />
            </div>
          )
        })}
      </div>

      {/* ⚠️ 웹 자리: 확인(−5) — 화면 전체 투명 누름 칸 */}
      <PressArea label="확인" onPress={onConfirm} />

      <ScreenFrame title="시즌모드" gamePoint={gamePoint} onBack={null} footer={1} slides={false} />
    </RawScreen>
  )
}
