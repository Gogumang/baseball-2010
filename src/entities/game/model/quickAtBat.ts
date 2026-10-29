/**
 * 원본 간이 타석 (binary.mod 0xc262c 루프 · 0xc11f0 스윙 · 0xc1818 투구 판정 — 전부 디스어셈 대조).
 * 사람이 조작하지 않는 타석은 원본도 이 길로 돌린다: 동료 여덟 타순, 상대 팀 공격,
 * 그리고 하루치 다른 팀 경기(0xc2a48)까지 전부 같다.
 *
 * **투구마다 두 갈래로 나뉜다** (0xc262c): `rand(0,100) <= 59` 면 스윙(0xc11f0), 아니면 투구 판정(0xc1818).
 * 스윙 판정은 사람 타석과 똑같이 0xab214(`swingResultOf`)로 가고, 투구 판정은 볼·스트라이크를 세어
 * 볼넷과 루킹 삼진을 만든다. 14회에는 스윙을 강제해 경기가 끝나게 한다.
 *
 * **이 길은 원본도 결과를 먼저 굴린다** (2026-10-07 확인 — 사람 타석과 다른 점). 0xc11f0 은 0xab214 의 결과 코드로
 * 점프표 0xd9000 을 곧장 타고(코드 3 → rand(0,10000) < rand(0, 주력) 면 1루타 · 15·18 → rand(0,666) < rand(0, 주력) 면
 * 한 루 더 · 24 홈런 …, E-4 표), 타구 패턴을 쏘지도 수비 판(상태 0x17)을 돌지도 않는다. 패턴 덱을 꺼내는 0xb0930 ·
 * 0xb0938 · 0xb0b00 을 부르는 곳은 사람 장면의 타구 시작 `0x51408`(0x51490 · 0x514e8 · 0x5149e) 하나뿐이고
 * (xref), 0xc11f0 · 0xc1818 · 0xc262c 에는 덱도 판 끝 결과 코드 0x9d5bc 도 없다 — 안타·아웃은 0xc1170(안타 진루) · 0xc161c
 * (아웃 0xa7d0c) 가 결과 코드대로 곧장 적고, 그 뒤 정산 0xa8024 는 그 사건을 셀 뿐이다(E 3f).
 * 그래서 사람 타석(`features/defense-play` 판 끝 정산)과 달리 여기서는 결과 코드가 곧 결과다 — 원본 그대로 둔다.
 *
 * 공개 이름 모음 — 하위 폴더 (`quickAtBat/`): `types`(타자 · 투수 · 상황 · 결과 · 갈고리 꼴) · `constants`(원본 상수) ·
 * `pitch/`(구위 등급 0xb74bc · 코스와 세기 · 투구 판정 0xc1818) · `swing/`(보정 구조체 · 0xab214 입력 · 결과 코드 판정 · 세 번째 스트라이크 겨루기) ·
 * `loop/`(볼카운트 · 공 한 개 단계 · 타석 고리 0xc262c) · `otherSlices`(다른 조각)
 */
export type { QuickAtBatBatter, QuickAtBatPitcher, QuickAtBatPlay, QuickAtBatSituation } from '@/entities/game/model/quickAtBat/types'
export { pitchGradeOf } from '@/entities/game/model/quickAtBat/pitch/pitchGrade'
export { quickPitchOf } from '@/entities/game/model/quickAtBat/pitch/quickPitch'
export { judgePitchOf } from '@/entities/game/model/quickAtBat/pitch/judgePitch'
export { quickSwingBoostOf } from '@/entities/game/model/quickAtBat/swing/swingBoost'
export { thirdStrikeContestOf } from '@/entities/game/model/quickAtBat/swing/thirdStrike'
export { playQuickAtBat, simulateQuickAtBat } from '@/entities/game/model/quickAtBat/loop/playQuickAtBat'
