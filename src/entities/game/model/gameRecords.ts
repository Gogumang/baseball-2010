/**
 * 기록달성 (binary.mod 0xa77f0 기록 추가 · 0x4ea0c 경기 끝 지급 — 누락 탐색 9차, QA 대조).
 * 기록마다 횟수를 세고, 경기가 끝나면 Σ 횟수 × 금액을 G포인트로 준다 (상한 99999). 이름은 StrGAME[id+8].
 * 금액 표는 두 벌이고 값은 같다: 경기 끝 지급이 0xcfbf8, 경기 중 누계가 0xd8158.
 *
 * **원본은 기록을 팀 단위로 센다.** 지급 게이트 0xa77f0 은 그 밖에도 세 가지를 본다 (R8 1절·9절):
 *   ① 자동진행(30G 스킵)으로 넘어간 뒤에는 아무것도 주지 않는다
 *   ② 모드 5·6·7(미션 투수·타자·홈런더비)에서는 아무것도 주지 않는다
 *   ③ 번호마다 방향이 고정이다 — 0~15·32~35·37~39 는 사람 **공격**, 16~31·36 은 사람 **수비**
 *      (28~31·37~39 는 게이트를 건너뛰고 0xa7de8 이 직접 가린다)
 * 지금 웹은 나만의리그 타자편(모드 4)이고 자동진행이 없으며, 모드 3·4 에서는 내 팀 전체가
 * "사람 팀" 이라(0x3a20a) 공격·수비 양쪽이 다 통과한다 → 세 조건 모두 지금은 걸리지 않는다.
 * 그래서 나만의 타자도 동료 투수의 수비 기록을, 나만의 투수도 동료 타자의 공격 기록을 받는다 — B-129 고친 길(기본 켬)은
 * 자기 포지션 쪽만 남긴다 (`ownPositionRecords.ts`, 진행기가 기록을 붙이는 자리에서 거른다).
 * 동료 여덟 타순의 기록도 여기로 들어온다 — `batterGameLog.ts` 가 타순별로 따로 세고,
 * 사용자 타석과 같은 `recordBatterAtBat` 을 쓴다.
 * 완투 계열 28~31 도 들어왔다 (`completeGameRecordIdsOf`) — 상대 공격이 실제 타석으로 돌아가
 * 피안타·실점을 셀 수 있게 되면서 가능해졌다.
 * 삼진 계열 16~23 과 삼구 삼자범퇴 25 도 들어왔다 — 투구 판정 경로(0xc1818)를 옮기면서 공 수·볼 카운트를
 * 셀 수 있게 된 덕이다.
 * 남은 아홉 가지 중 나만의리그 타자편(gameFlow)에 붙은 것: 6·7 백투백 · 8 도루 성공 · 32·33 연속 파울
 * (파울은 타석 화면이 `atBatPitchTally` 를 넘겨야 실제로 들어온다). 24 도루 저지는 사람 공격 중 도루라
 * 게이트에서 버려진다. 5 대타 홈런은 타자편에서 **원본도 나오지 않는다**(CPU 대타는 플래그를 안 세운다).
 * 26·27 병살·삼중살 · 36 필살송구 아웃은 사람 수비 화면에서만 쌓인다 — 타자편엔 그 화면이 없다.
 * 함수마다 "배선 자리" 를 적어 두었다.
 * 상대 공격은 이제 원본 간이 타석(0xc11f0)으로 돌지만 아직 타격 결과만 만든다 —
 * 삼진 콤보·병살·삼자범퇴 같은 투구·수비 사건을 세려면 수비 쪽 상태(state+0x88~0x8a)를 더 옮겨야 한다.
 * 경기 중 누계를 화면에 실시간으로 보여 주는 것(0xa77f0)도 아직 없다.
 *
 * **팀 경기(모드 1·2·8·9)도 쌓고 준다** — 0xa77f0 은 모드 5·6·7 만 막고(a780a), 경기 끝 0x4ea0c 는 모드 5·6 만
 * 미션 갈래로 보낸 뒤(4eb64) 나머지는 `Σ 횟수 × 0xcfbf8[k]` 를 저장 G 에 더한다(4ebe0~4ec5a).
 * `features/play-team-game/model/teamGameFlow` 가 여기 판정 함수를 잇는다: 우리 타석(사람 장면·간이 엔진) 0~15·5·6·7,
 * 연속 파울 32·33, 도루 8, 우리 수비 타석 16~23·25·26·27·36, 경기 끝 28~31·37~39. 자동진행(유료) 뒤에는 막는다.
 * 24 도루 저지는 팀 경기에 CPU 도루(우리 수비 중)가 아직 없어 나오지 않는다.
 *
 * 공개 이름 모음 — 하위 폴더 (`gameRecords/`): `names`(이름 · 금액 0xcfbf8) · `atBat`(타석 0xa8024 · 점수차 승 0xa7de8) ·
 * `completeGame`(완투 계열 0xa7de8) · `strikeouts`(0xa7c4c · 0xa7998 · 25) · `plays/`(대타 홈런 · 백투백 · 파울 · 도루 · 병살 · 필살송구) ·
 * `teamGate`(지급 게이트 0xa77f0) · `outs` · `otherSlices`(다른 조각)
 */
export { RECORD_NAMES, recordGamePointsOf } from '@/entities/game/model/gameRecords/names'
export { atBatRecordIdsOf, gameEndRecordIdsOf } from '@/entities/game/model/gameRecords/atBat'
export { completeGameRecordIdsOf, type CompleteGameInput } from '@/entities/game/model/gameRecords/completeGame'
export {
  strikeoutCallRecordIdsOf,
  strikeoutRecordIdsOf,
  strikeoutTallyRecordIdsOf,
  threePitchInningRecordIdsOf,
  type StrikeoutRecordInput,
} from '@/entities/game/model/gameRecords/strikeouts'
export { backToBackRecordOf, foulRecordOf, pinchHitHomeRunRecordIdsOf } from '@/entities/game/model/gameRecords/plays/offensePlays'
export { stealPlayRecordIdsOf, type StealPlayRunner } from '@/entities/game/model/gameRecords/plays/runnerPlays'
export { laserThrowOutRecordOf, multiOutPlayRecordIdsOf } from '@/entities/game/model/gameRecords/plays/defensePlays'
export { passesRecordTeamGate } from '@/entities/game/model/gameRecords/teamGate'
