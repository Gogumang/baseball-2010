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
