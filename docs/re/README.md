# 원본 해독 문서 (게임빌 2010 프로야구 → 웹 이식)

원본 `base/게임빌2010프로야구/0002C663.jar` 의 `binary.mod`(ARM Thumb, 심볼 없음)와 데이터·에셋을 해독한 결과다.
2026-09-19 ~ 09-20 에 38개 주제로 나눠 작업했다.

## 먼저 읽을 것
| 파일 | 내용 |
|---|---|
| **[CORRECTIONS.md](CORRECTIONS.md)** | **나중 해독이 앞 판단을 뒤집은 것 40여 건.** 다른 문서를 읽기 전에 꼭 볼 것 |
| [DECISIONS.md](DECISIONS.md) | 사용자 결정 (원본 버그를 그대로 옮긴다 등)과 원본 버그 목록 |
| [UNRESOLVED.md](UNRESOLVED.md) | 아직 해석되지 않은 것 목록 |
| [INVENTORY.md](INVENTORY.md) | 원본 기능 전체 ↔ 웹판 대조표 (무엇이 없는지) |
| [TODO.md](TODO.md) | 작업 진행 기록 (38개 항목, 전부 완료) |

## 표기
- **확정** = 디스어셈으로 식·표까지 확인 · **유력** = 한 고리 미확인 · **미해결**
- 주소는 `binary.mod` VA (파일오프셋 + 0xfcc). 웹 파일:줄은 main `2fa9283` 기준
- 🌐 = 원본 서버가 필요해 오프라인 구현 불가
- A~K 문서는 맨 앞에 **"1. 구현 명세"**(그대로 옮길 수 있게 정리한 것), 뒤에 **"4. 상세 근거"**(해독 노트 전문)가 있다.
  P·Q·R 문서는 맨 위 체크리스트와 요약 뒤에 항목별 근거가 이어진다.

## 주제별 문서

### 경기 — 규칙과 판정
| 문서 | 내용 |
|---|---|
| [E-defense-rules.md](E-defense-rules.md) | 간이 경기 엔진, 연장·콜드게임, 순위 정렬, 병살·삼중살, 도루 |
| [R1-league-day-winner.md](R1-league-day-winner.md) | **CPU 끼리 경기의 승패가 뒤집혀 있다**(원본 버그, 확정) |
| [P2-fielding-ai.md](P2-fielding-ai.md) | 타구 뒤 수비 AI — 포구 예측·추적·송구·자동 주루·태그/포스 |
| [Q1-cpu-offense-ai.md](Q1-cpu-offense-ai.md) | CPU 타자의 스윙·번트 판단, CPU 도루·대타 |
| [I-controls.md](I-controls.md) | 사람 조작 전체 — 주루·송구·견제·교체·필살수비·레이저 송구 |
| [R3-field-view.md](R3-field-view.md) | 수비 화면 카메라, 동작 번호, 슬라이딩, 속도 단위 |
| [R8-record-triggers.md](R8-record-triggers.md) | 기록달성 40종의 판정 지점 전수 |
| [R10-game-states.md](R10-game-states.md) | 경기 장면 상태 표 (인트로·공수 교대·벤치 클리어링·자동진행) |
| [R15-ac758.md](R15-ac758.md) | 스윙 타이밍 등급(진동), 그 밖 작은 의문 7건 |

### 투수편 · 필살기
| 문서 | 내용 |
|---|---|
| [P1-pitcher-rules.md](P1-pitcher-rules.md) | 등판 로테이션·감독 강판·스태미나·투구 게이지·투수 평가 |
| [H2-special-skills.md](H2-special-skills.md) | 필살타법 5종·마구 6종 발동과 효과, 마선수 레벨별 횟수 |
| [D-pitch-trajectory.md](D-pitch-trajectory.md) | 공 궤적 — **원본 데이터(pitch.zt1)를 그대로 쓰기로 결정** |

### 육성 (나만의리그)
| 문서 | 내용 |
|---|---|
| [G-management-numbers.md](G-management-numbers.md) | 훈련·휴식·외출·부상·질병·아이템 수치 |
| [A-events-skills.md](A-events-skills.md) | 이벤트 발동 조건·보상·스킬 획득 |
| [B-season-awards.md](B-season-awards.md) | MVP·개인 타이틀·연봉·엔딩·평판 변화 |
| [K-bursts-special.md](K-bursts-special.md) | 돌발미션·올해의 목표·해금·스페셜·환경설정·GP 아이템 |
| [P3-titles.md](P3-titles.md) | 칭호(닉네임) 64개 획득 조건 |
| [C-create-palette.md](C-create-palette.md) | 선수 등록, 피부·팀 팔레트(.mpl), 좌타/우타 |
| [P5-national-match.md](P5-national-match.md) | 국가대항전과 히든 팀 해금 |
| [R9-myleague-states.md](R9-myleague-states.md) | 나리 관리 장면 상태 표 100~145 |
| [R7-number-leftovers.md](R7-number-leftovers.md) | 경기 뒤 인기도·사기, 투수 GP 아이템, 드래고나 해금 |

### 다른 모드
| 문서 | 내용 |
|---|---|
| [H-modes.md](H-modes.md) | 모드 번호·장면 구조, 홈런더비, 대전모드, 스킬 장착 |
| [J-modes-rules.md](J-modes-rules.md) | 일반모드 준비·경기진행 설정, 시즌 구단관리, 투수편 등록 |
| [P4-season-flow.md](P4-season-flow.md) | 시즌모드 진행 흐름·관중 수입·s_event |
| [R13-season-leftovers.md](R13-season-leftovers.md) | 시즌 잔여 상태, 포스트시즌 대진, 선수영입, 히든 장비 |
| [Q2-mission-rewards.md](Q2-mission-rewards.md) | 미션 보상·클리어 횟수, 명예의 전당 선수 활용 |

### 화면·연출·에셋
| 문서 | 내용 |
|---|---|
| [F-ui-layout.md](F-ui-layout.md) | 메시지 상자, 외출 지도, HUD, 타이틀, 메인 메뉴, 경기 결과 |
| [P6-screens.md](P6-screens.md) | 미션 선택·기록연감·스페셜·상점·대진표·엔딩·환경설정 배치 |
| [R4-lineup-screens.md](R4-lineup-screens.md) | 교체 화면, 엔트리 편집, 일반모드 준비 단계 |
| [R14-game-side-screens.md](R14-game-side-screens.md) | 홈런더비 결과, 감독 강판 대사 창 |
| [R11-special-leftovers.md](R11-special-leftovers.md) | 에디트(이름 변경), 글 입력, 명전 삭제, 모드 잠금 |
| [R12-shop-guards.md](R12-shop-guards.md) | 상점 가드 문구, 장비 컬렉터 해금, 구내매점 만료 |
| [R2-game-effects.md](R2-game-effects.md) | 경기 연출(HOMERUN·불꽃·컷인·전광판)과 효과음 장면 |
| [L-sound-effects.md](L-sound-effects.md) | 사운드 52개 변환·재생 시점, 연출 에셋, 장비 외형 |
| [R5-font-particles.md](R5-font-particles.md) | 원본 비트맵 한글 글꼴, 파티클 설정 (`_raw/work/R5/` 에 변환 스크립트) |
| [R6-sprite-leftovers.md](R6-sprite-leftovers.md) | 좌우 반전, 시즌 관중 그림, 그리기 효과 식 |

### 그 밖
| 문서 | 내용 |
|---|---|
| [P7-leftovers.md](P7-leftovers.md) | 1차 문서에 남았던 작은 조각 14건 |
| [Q0-coverage-audit.md](Q0-coverage-audit.md) | 빈 곳 감사 — 무엇이 아직 안 풀렸는지 훑은 기록 |

## 웹 이식 우선순위 (제안)
1. **틀린 것 고치기** — 완투 기록 조건(R8), 연장 한 이닝 어긋남(E), 희생플라이(E·P2), 평판 구간 보정과 칸 7개(B·P7), 인기도 식(R7), 연봉 등급 고정(B)
2. **원본 데이터로 바꾸기** — 사용자 투구 궤적(D), 팀·피부 팔레트(C), 원본 글꼴(R5), 사운드(L)
3. **큰 빈 기능** — 수비 화면과 사용자 조작(I·P2·R3), 투수편(P1·H2·J), 돌발미션(K), 칭호(P3), 시즌모드(P4·R13)
4. **화면을 원본 배치로** — F·P6·R4·R14
5. **연출** — R2·R6·R5(파티클)

## 원본 자료 위치
- 노트 원본과 작업 스크립트: `_raw/notes/`, `_raw/work/`, `_raw/docs-head/`
- 디스어셈 도우미: `_raw/re.py` (`re dis|func|xref|xval|u8|s16|str|findstr`)
- 검증 중간 결과: `_raw/verify/` (V1~V5, 188항목 중 178 확인 후 중단)
