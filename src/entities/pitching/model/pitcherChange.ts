/**
 * **경기 중 CPU 투수 교체** (binary.mod 0xc1ba4 → 0xac428 판정 · 0xabfcc 새 투수 · 0xac360 마무리 굴림
 * · 0xaf09c 교체 실행 — E-defense-rules E-6 · 3c, P7-leftovers E1·E2).
 *
 * 간이 타석 루프 0xc262c 는 **타석마다** 먼저 0xc1ba4 를 부르고, 그 안에서 수비 팀 투수 교체를
 * 판정한다. 그래서 사람이 잡지 않고 넘긴 타석에서는 **양 팀 투수가 모두 바뀔 수 있다**
 * (우리 팀이 공격하는 자동 타석이면 상대 투수가, 우리 팀이 수비하는 자동 타석이면 우리 투수가).
 * 사람이 직접 던지는 타석은 이 길을 지나지 않는다 — 그때 우리 투수를 바꾸는 것은 `#` 메뉴다(R4 1b).
 *
 * ⚠️ **감독 강판(`entities/pitcher-career/managerHook`)은 여기 없다.** 0x504cc 는 모드 3
 * (나만의리그 투수편) 전용이라 팀 경기(모드 1·2·8·9)에는 원본에도 없다 (P1 2절).
 *
 * 공개 이름 모음 — 하위 폴더 (`pitcherChange/`): `types`(카운터 +0x27c · 판정 입력 · 후보 꼴) · `judge`(교체 판정 0xac428) ·
 * `closer`(마무리 굴림 0xac360) · `roster`(칸별 보직 · 능력 합 0xb5b50) · `choose`(새 투수 0xabfcc) · `pick`(고르기 0xac5d6) ·
 * `otherSlices`(다른 조각)
 */
export { EMPTY_MOUND_COUNTERS, type MoundPitcherCounters, type ReplacementCandidate } from '@/entities/pitching/model/pitcherChange/types'
export { judgePitcherChange } from '@/entities/pitching/model/pitcherChange/judge'
export { CLOSER_ROLL_PERCENTS, closerRollIndexOf, rollsCloser } from '@/entities/pitching/model/pitcherChange/closer'
export { pitcherAbilitySumOf, ROSTER_PITCHER_ROLES, rosterPitcherRoleOf } from '@/entities/pitching/model/pitcherChange/roster'
export { chooseReplacementPitcher } from '@/entities/pitching/model/pitcherChange/choose'
export { replacementPitcherSlotOf } from '@/entities/pitching/model/pitcherChange/pick'
