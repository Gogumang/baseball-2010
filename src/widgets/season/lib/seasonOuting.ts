/**
 * 시즌 외출 5종 (장면 0x105 상태 **0xd1** 지도 → 가드 0xbd38 → 결과 0xc81c) 의 표.
 *
 * 근거: `docs/re/P4-season-flow.md` **3 절 확정** (가드·비용·효과표·입원 치료),
 * 6 절(사기 변화 모음) · `docs/re/G-management-numbers.md` 171행(서브 아이템 점프표).
 *
 * ⚠️ **나만의리그 외출(`shared/config/outingPlaces.ts`)과 값·가드가 다르다 — 절대 재사용 금지.**
 * P4 3절·7절이 못 박은 것이다: 인기도 조건이 p0·p4 에만 있고 값도 다르며, 시즌 팀에는
 * 부상 개념이 없어 부상 검사가 없다.
 *
 * ⚠️ **본래 자리는 `entities/season-mode/model` 이다** — 이번 작업의 담당 폴더가 아니라
 * 여기 두었다. 굴림·적용(`rollSeasonOuting`)은 난수를 받아서 한다.
 *
 * - 장소 · 비용 · 효과표 · 서브 아이템(`outingTables`) · 가드 0xbd38 과 거절 · 확인 글(`outingCheck`)
 * - 결과 팝업 0x17 글(`outingResultText`) · 결과 0xc81c 굴림 · 적용(`rollSeasonOuting`)
 */

export {
  SEASON_OUTING_PLACES,
  SEASON_OUTING_ACTIVITIES,
  SEASON_OUTING_COSTS,
  SEASON_OUTING_REQUIRED_POPULARITY,
  SEASON_OUTING_EFFECTS,
} from '@/widgets/season/lib/seasonOuting/outingTables'
export type { SeasonOutingPlace } from '@/widgets/season/lib/seasonOuting/outingTables'
export { checkSeasonOuting, seasonOutingRefusalTextOf, seasonOutingConfirmTextOf } from '@/widgets/season/lib/seasonOuting/outingCheck'
export { rollSeasonOuting } from '@/widgets/season/lib/seasonOuting/rollSeasonOuting'
