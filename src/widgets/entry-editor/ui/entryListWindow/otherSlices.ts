/**
 * 엔트리 목록 창이 쓰는 **다른 조각**의 그림 셈 — 연도 칸 숫자(`pages/nari-record-room`) · 수비/보직 딱지와 둥근 칠(`widgets/matchup-cards`).
 * 조각 · 층 경계를 넘는 import 를 이 파일 한 곳에 모은다(`lint.boundaries-baseline.js` 의 예외는 이 파일 하나)
 */
export { yearCellDrawingOf, yearLabelOffsetOf, yearNumberGlyphsOf } from '@/pages/nari-record-room/lib/nariRecordRoom'
export { batterPositionBadgeOf, pitcherRoleBadgeOf, roundFillRectsOf } from '@/widgets/matchup-cards/lib/matchupCardsLayout'
