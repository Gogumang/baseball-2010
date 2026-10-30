import { skinBlinkCounterValue } from '@/shared/lib/skinBlink/skinBlink'
import { useSkinStepCounterValue } from '@/shared/lib/skinStepCounter/skinStepCounter'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { CommonPanel, PressArea, useImgTextPalette3 } from '@/shared/ui'
import { tapKey } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import { RANKING_BLINK_AT_REST, RANKING_BOARD, rankingBlinkCountersOf, rankingSideArrowXOf } from '@/pages/nari-record-room/lib/rankingBoard'
import type { SeasonRankingEntry } from '@/entities/season-mode/model/seasonRecordRanking'
import { IMG_TEXT, SLT_FRAME, centeredLabelPlaceOf, imageOf, pixel } from '@/pages/nari-record-room/ui/rankingBoard/rankingBoardParts'
import { RankingRow } from '@/pages/nari-record-room/ui/rankingBoard/RankingRow'

export interface RankingBoardProps {
  /** 쪽의 순위 종류 (`seasonRecordRanking` 종류 번호) */
  readonly kind: number
  /** 쪽의 종류 글 img_text (0x56dd4) */
  readonly kindLabelFrame: number
  readonly entries: readonly SeasonRankingEntry[]
  /** [판+0x448] — 그 팀 줄의 이름 글은 노랑 */
  readonly myTeamId: number
  readonly hasPreviousPage: boolean
  readonly hasNextPage: boolean
  /** 시험용 data-testid 머리 (`기록순위` · `순위기록`) */
  readonly testIdPrefix: string
}

/** **순위 판 0x5796c** — 배치는 `lib/rankingBoard.ts` 머리말(직접 떴다) */
export function RankingBoard({ kind, kindLabelFrame, entries, myTeamId, hasPreviousPage, hasNextPage, testIdPrefix }: RankingBoardProps) {
  const textOrigins = useFrameOrigins(IMG_TEXT)
  const headerFrames = [...RANKING_BOARD.headerTextFrames, kindLabelFrame]
  const headerTop = RANKING_BOARD.headerY + RANKING_BOARD.headerTextDy
  const arrowTop = RANKING_BOARD.headerY + RANKING_BOARD.sideArrowDy
  const palette3 = useImgTextPalette3()
  // [판+0x410] · [판+0x40c] — 둘 다 앱에 하나인 스킨 칸 (0x579ca · 0x57b5c 읽기만)
  const counters = rankingBlinkCountersOf(skinBlinkCounterValue(), useSkinStepCounterValue())

  return (
    <>
      {palette3.definition}
      {/* 57a52 공용 판 0x55e60(편집기, W/2, H/2 + 5, 210, 220, 0, 0x22, 위 띠 0x12, 0, 0, 0) */}
      <CommonPanel
        x={RANKING_BOARD.panel.x}
        y={RANKING_BOARD.panel.y}
        width={RANKING_BOARD.panel.width}
        height={RANKING_BOARD.panel.height}
        topBand={0x12}
        testId={`${testIdPrefix}-판`}
      />
      {/* 머리 글은 img_text 팔레트 3 (57a5c · 57a9c · 57ad6 · 57b9a `0x913e5(img_text, 3)` 뒤 0x5650c) */}
      {headerFrames.map((frame, column) => {
        const place = centeredLabelPlaceOf(textOrigins, frame, column, headerTop)
        return place === null ? null : <img key={column} alt="" src={imageOf(IMG_TEXT, frame)} style={{ ...pixel, ...palette3.style, ...place }} />
      })}
      {hasPreviousPage && (
        <img
          alt="앞 쪽"
          src={imageOf(SLT_FRAME, RANKING_BOARD.sideArrowImage)}
          style={{ ...pixel, left: rankingSideArrowXOf('left', counters), top: arrowTop }}
        />
      )}
      {hasNextPage && (
        <img
          alt="다음 쪽"
          src={imageOf(SLT_FRAME, RANKING_BOARD.sideArrowImage)}
          style={{ ...pixel, left: rankingSideArrowXOf('right', counters), top: arrowTop, transform: 'scaleX(-1)' }}
        />
      )}
      {/* 웹 덧붙임 — 쪽 화살(5×8, 깜박이며 2px 까딱) 위 투명 칸: 원본 ← · → 키 한 번. 같은 키를 상황 버튼으로 또 내지 않는다(필요한 버튼만, 부르는 화면이 키를 받는다) */}
      {hasPreviousPage && (
        <PressArea
          label="앞 쪽"
          onPress={() => tapKey('ArrowLeft')}
          rect={{ x: rankingSideArrowXOf('left', RANKING_BLINK_AT_REST) - 4, y: arrowTop - 3, width: 13, height: 14 }}
        />
      )}
      {hasNextPage && (
        <PressArea
          label="다음 쪽"
          onPress={() => tapKey('ArrowRight')}
          rect={{ x: rankingSideArrowXOf('right', RANKING_BLINK_AT_REST) - 4, y: arrowTop - 3, width: 13, height: 14 }}
        />
      )}
      {Array.from({ length: RANKING_BOARD.rowCount }, (_unused, row) => (
        <RankingRow key={row} row={row} entry={entries[row]} kind={kind} myTeamId={myTeamId} testIdPrefix={testIdPrefix} textOrigins={textOrigins} />
      ))}
    </>
  )
}
