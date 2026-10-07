# D. 공 궤적·구질 — 결정 기록 (2026-09-19)

## 결정
궤적 코드 해석은 안전 필터에 막혀 **더 진행하지 않는다.**
대신 **원본 데이터(`data/pitch.zt1`)를 그대로 쓴다** (사용자 결정).

## 확인한 것 (웹판 코드 기준)
- 원본 궤적 데이터는 이미 웹판에 전부 들어 있다: `src/shared/config/original/pitchRecords.ts`
  (구질 21종 × 구속 단계별 레코드, 3D 제어점, 비행 틱 수, 폼). 생성기는 `tools/generate_game_data.py`.
- **CPU 투구는 이미 원본 데이터로 날아간다**: `src/entities/pitching/model/selectPitch.ts` → `pitchPathOf`
  (`src/entities/pitching/model/pitchCurve.ts`) → `src/widgets/batting-stage/lib/trajectory.ts` 의 `ballPixelAt`.
  이 코드는 첫 커밋부터 있었고 다른 세션이 최근 건드리지 않았다.
- **원본 데이터를 안 쓰는 곳은 사용자 투구(투수편) 하나**: `src/entities/pitching/model/pitchCommand.ts` 의
  `buildPitch` 가 `worldPath: null` 로 2D 추정 곡선을 쓴다.

## 남은 일 (구현 — 아직 안 함)
- `buildPitch` 가 CPU 와 같은 `pitchPathOf` 를 부르게 바꾼다. 필요한 재료는 모두 있다:
  구질 번호(구질 순번+1) · 목표점(코스 칸 → `ZONE_CENTERS` + `ZONE_HALF_WORLD`) · 속도 단계(`pitchSpeedStageOf`).
- 추정으로 남는 것: 게이지(PERFECT 등)가 속도 단계·제구에 주는 영향, 마구(B-스플라인 레코드) 궤적.

## 손대지 않은 D 항목
스트라이크존 크기, 구질 21종 원본 수치(데이터에서 계산한 값은 이미 `pitchTypes.ts`), 투구 AI, 사용자 타격 판정(0xab214),
마선수 투수 단계 표. 사용자가 따로 결정하기 전까지 보류.

## 2026-10-07 — 타구 궤적은 해석을 허락받아 원본 물리 세계대로 옮겼다
- 사용자가 **타구 궤적 · 판 끝 · 파울 판단 로직**의 해석을 허락했다(메인 e4cda1d 메시지 "사용자 허락으로 직접 뜬 공 객체"). 투구 궤적은 위 결정 그대로 `pitch.zt1` 데이터다.
- 타구 공 객체(vtable 0xd7afc)의 미리 계산 = 물리 세계 0xbfed0(공 한 틱 0xbf094 · 비행 0xa28c0 · 착지 0xbf240 · 장애물 0x9f7e8 · 통지 0xa2bf0 · 마무리 0xa2a88)를 직접 떠서 웹 `entities/batting/model/ballPhysics.ts` 로 옮겼다(지어낸 중력 130 · 반발 40% · 담장 거리 26000 · 폴 패턴 각 근사를 걷음). 중력·바운드 % 는 pattern.dat 머리 바이트 4~8(90 · 75 · 50 · 95 · 0).
- 송구 공도 같은 세계로 날린다(ec5a0a6 · 82d1022). 사슬 전체와 판 끝 결과 코드 0x9d5bc · 관문 0xb0d28 은 [I 2b "판 끝 결과 코드 · 관문 전체 · 궤적 세계"](I-controls.md), 파울 끝은 [S2 ③](S2-fair-foul.md).
