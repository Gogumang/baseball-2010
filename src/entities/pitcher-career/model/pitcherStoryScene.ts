/**
 * 나만의리그 **투수편**(모드 3) 이벤트 고르기 — 판정 `0xacfbc` 의 모드 3 갈래 (A-2 · A-3 확정).
 *
 *   1. 대상 0 은 코드가 번호로 부를 때만 · 모드 3 이 받는 대상은 **1·3** (타자편 1·2)
 *   2. 490 · 대상 1 · 질병 쿨다운 > 0 이면 불발 — 장면이 새로 선 뒤 관리 메뉴 확인 전(mgr+0x304)이면 안 본다 (`isIllnessCooldownBlocked`)
 *   4. 본 이벤트면 불발 · 5. trigger ↔ 화면 (0 ↔ 105 · 1 ↔ 112 · ≥2 ↔ 113)
 *   6. requiresEvent · 7. 날짜 창 (네 바이트 중 하나라도 0 이면 생략, now = 연차idx·45 + 경기 수 + 1)
 *   8. 조건 (switch 0xad1ba) — 0~3 은 `0xb6414(선수기록, i, 0)` = 투수 기록의 **제구·구속·변화·체력** 기본값,
 *      18 인기도 · 19 평판 · 22 질병 확률(0xadb32) · 24/25 이벤트 봤음/안 봤음. 4~17 · 26+ 는 통과.
 *
 *      20/21 은 스킬 v−1 획득/해제 — 투수 갈래는 `meetsPitcherSkillCondition` (아래).
 * 관리 화면(105)·지도(112)의 자동 발동(0x1cf9c → 0x8be80 → 0xadc70, 커서 이어 쓰기)은 `scanPitcherEventFrom`.
 *
 * 공개 이름 모음 — 하위 폴더 (`pitcherStoryScene/`): `eligibility/`(조건 switch 0xad1ba · 판정 0xacfbc · 장소 배정 0x8cdc0) ·
 * `skills/`(스킬 번호 · 경력 읽기 · 획득 표 0xd8408 · 해제 표 0xd8454 · 조건 20/21) · `scan`(자동 발동 0xadc70 · 오프닝 · 연초) ·
 * `signedReads`(s8 · s16 · u8) · `otherSlices`(다른 조각)
 */
export { isPitcherEventEligible, pitcherPlaceEventOf } from '@/entities/pitcher-career/model/pitcherStoryScene/eligibility/eligible'
export { meetsPitcherSkillCondition } from '@/entities/pitcher-career/model/pitcherStoryScene/skills/skillCondition'
export {
  PITCHER_YEAR_START_EVENT,
  PITCHER_YEAR_START_EVENT_ID,
  pitcherOpeningScanOf,
  scanPitcherEventFrom,
} from '@/entities/pitcher-career/model/pitcherStoryScene/scan'
