/**
 * **선수 정보 창 0x5b798(skin, 종류, rec)** — '0' INFO. 창 자리 · 열리기(`detailWindowFrame` 머리말) · 줄 · 도형 칸(`detailRows`) ·
 * 값 글(`detailTexts`) · 투수 갈래(`pitcherDetail`) · 타자 갈래(`batterDetail`).
 *
 * 다른 조각을 읽는 두 가지 — 능력치 도형 축(`pages/create-player` 의 `abilityRadarAxesOf`) · 타자 손(`widgets/matchup-cards` 의
 * `batterHandOf`) — 는 이 파일에서만 읽는다(경계 예외가 이 파일 하나).
 */
import { abilityRadarAxesOf } from '@/pages/create-player/lib/abilityRadarPanel'
import type { AbilityRadarAxis } from '@/pages/create-player/lib/abilityRadarPanel'
import type { PlayerDetailSource } from '@/entities/season-mode/model/entryEditor'
import { batterHandOf } from '@/widgets/matchup-cards/lib/matchupRecord'
import { batterDetailOf } from '@/widgets/player-detail-window/lib/playerDetailWindow/batterDetail'
import { DETAIL_RADAR } from '@/widgets/player-detail-window/lib/playerDetailWindow/detailRows'
import { detailSalaryOf } from '@/widgets/player-detail-window/lib/playerDetailWindow/detailTexts'
import type { PlayerDetail } from '@/widgets/player-detail-window/lib/playerDetailWindow/detailTexts'
import { pitcherDetailOf } from '@/widgets/player-detail-window/lib/playerDetailWindow/pitcherDetail'

export {
  SUBSTITUTION_DETAIL_ORIGIN,
  ENTRY_DETAIL_ORIGIN,
  DETAIL_WINDOW,
  detailWindowFrameAt,
  DETAIL_COLORS,
  roundEdgeRectsOf,
} from '@/widgets/player-detail-window/lib/playerDetailWindow/detailWindowFrame'
export type { DetailWindowOrigin } from '@/widgets/player-detail-window/lib/playerDetailWindow/detailWindowFrame'
export {
  DETAIL_LABEL_DX,
  DETAIL_VALUE_DX,
  DETAIL_LABEL_CELL,
  DETAIL_VALUE_CELL,
  DETAIL_LABEL_DY,
  PITCHER_DETAIL_ROWS,
  BATTER_DETAIL_ROWS,
  DETAIL_RADAR,
  detailRadarCenterOf,
  DETAIL_RADAR_LABELS,
} from '@/widgets/player-detail-window/lib/playerDetailWindow/detailRows'
export { salaryTextOf, specialSwingTextOf } from '@/widgets/player-detail-window/lib/playerDetailWindow/detailTexts'
export type { PlayerDetail } from '@/widgets/player-detail-window/lib/playerDetailWindow/detailTexts'

/**
 * 도형 축 칸 (0x5aefc 0x5b412 루프, 반지름 22) — 축 끝(선 0x6a905 #6B92F4 → 지금 꼭짓점) · 이름 상자 slt_frame 17(26×29) ·
 * 이름 img_text 상자 + 3 · 숫자 0x6aff8(상자 x + 0x12, 상자 y + 0x11, 앵커 4). 가운데 기준 상대값.
 * 상자 자리는 ABILITY 판과 같은 식 `abilityRadarAxesOf`(0x5b48c~0x5b532)로 돌린다 — 반지름 22 라 d = |30 − 22| = 8 을
 * x 는 안쪽으로(왼쪽 축 +8 · 오른쪽 축 −8), y 는 각도 ≤ 180(아래 축) 이면 +8 · 그 밖(위 축) −8 옮긴다:
 * 상자 = (−45, −38) · (19, −38) · (19, 9) · (−45, 9).
 */
export const DETAIL_RADAR_AXES: readonly AbilityRadarAxis[] = abilityRadarAxesOf({ x: 0, y: 0 }, DETAIL_RADAR.radius)

/**
 * 레코드 한 장의 상세 창 값 (0x5b798 의 투수 갈래 0x5bf64~ · 타자 갈래 0x5b81e~).
 * 연봉 = 레코드 +0x1b × 10 × 100 (5c848~5c886: 모드 [0x1552d10] 3 · 4 이고 육성 0xb6389 면 저장 0x1f8d5(모드)+0x1c8 u16, 아니면 +0x1b).
 * 마선수는 육성이 아니라 +0x1b — 행 값(`ACE_*_GRADES`)이다.
 * 원본 레코드엔 +0x1b 가 늘 있다 — 웹 옛 저장의 빈 칸은 불러올 때 0 으로 이사하므로(r278 `migrateHallOfFamer` · `withRecordSalaryGrades`)
 * `grade` null 은 표 찾기 실패(앱 길에서는 닿지 않는다)뿐이고 그때는 0 으로 둔다.
 */
export function playerDetailOf(source: PlayerDetailSource): PlayerDetail {
  const salary = detailSalaryOf(source)
  if (source.isPitcher) return pitcherDetailOf(source, salary)
  // 손 0xb63c0 타자 갈래 — 마타자는 표 0xd88b0, 그 밖은 +0xb 비트 4
  return batterDetailOf(source, salary, batterHandOf(source.profile, source.aceIndex))
}
