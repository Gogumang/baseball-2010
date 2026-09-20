# 원본 해독 할 일 목록

> 끊겨도 이어서 할 수 있도록 여기에 상태를 적는다. 항목별 세부 체크리스트는 각 결과 파일 맨 위 `## 체크리스트` 에 있다.
> 상태: `[ ]` 안 함 · `[~]` 진행 중 · `[x]` 끝남 · `[-]` 불가(서버 필요 등)
> 결과 파일 위치: 새 작업 = `docs/re/_raw/notes/<이름>.md` · 1차 작업 = 스크래치패드 `re-notes/` (여기 `_raw/notes/` 로 복사해 둠)
> 검증 결과: `docs/re/_raw/verify/`

## ▶ 실행 순서 (2026-09-20~ — 동시에 3개)
> 병렬로 돌리다 네트워크가 끊겨 12개가 한꺼번에 멈췄다(14:10~20:14). 이제 아래 순서로 **하나씩**만 돌린다.
> 각 결과 파일 맨 위 체크리스트로 이어서 한다. 끝나면 줄을 `[x]` 로 바꾸고 다음으로.
1. P1 투수편 경기 규칙 (체크리스트 4/11 에서 이어서)
2. P2 수비 AI
3. R1 하루치 경기 승패 재확인
4. Q1 CPU 공격 AI
5. P3 칭호 64 (3/10 에서 이어서)
6. P4 시즌모드 진행 흐름
7. P5 국가대항전
8. H2 필살타법 · 마구
9. P6 남은 화면 배치 (1/12 에서 이어서)
10. Q2 미션 보상 · 명예의 전당 선수
11. P7 작은 조각 묶음
12. Q0 빈 곳 감사 → 나온 후보를 R8~ 로 덧붙임
13. R2 → R3 → R4 → R5 → R6 → R7 → R8 → R9 → R10 → R11 → R12 → R13 → R14 → R15

## 1차 해독 (2026-09-19)
- [x] A 이벤트 조건 · 보상 · 스킬 → `A-events-skills.md`
- [x] B 시즌 끝 · 시상 · 연봉 · 엔딩 → `B-season-awards.md`
- [x] C 선수 등록 · 팔레트 → `C-create-palette.md`
- [x] D 공 궤적 — 안전 필터로 중단, **원본 데이터(pitch.zt1) 그대로 쓰기로 결정** → `D-pitch-trajectory.md`
- [x] E 수비 판정 · 경기 규칙 → `E-defense-rules.md`
- [x] F 화면 배치 → `F-ui-layout.md`
- [x] G 관리 메뉴 수치 → `G-management-numbers.md`
- [x] H 모드 · 홈런더비 · 스킬 창 → `H-modes.md`
- [x] H2 필살타법 · 마구 발동과 효과 → `_raw/notes/H2-special-skills.md`
- [x] I 경기 중 사용자 조작 → `_raw/notes/I-controls.md`
- [x] J 일반모드 · 시즌 구단관리 · 투수편 등록 → `J-modes-rules.md`
- [x] K 돌발미션 · 해금 · 스페셜 · 환경설정 → `K-bursts-special.md`
- [x] L 사운드 · 연출 · 안 쓰는 에셋 → `_raw/notes/L-sound-effects.md`

## 2차 해독 (2026-09-19 추가 — 빈 영역)
- [x] P1 투수편 경기 규칙: 등판 로테이션 · 강판 · 스태미나 · 사용자 투구 게이지 → `_raw/notes/P1-pitcher-rules.md`
- [x] P2 수비 AI: 수비수 추적 · 포구 · 자동 주루 · 태그/포스 → `_raw/notes/P2-fielding-ai.md`
- [x] P3 칭호(닉네임) 64개 획득 코드 → `_raw/notes/P3-titles.md`
- [x] P4 시즌모드 진행 흐름: 관리 메뉴 · s_event 30 · 시즌 외출 · 우승 보상 · 선수영입 → `_raw/notes/P4-season-flow.md`
- [x] P5 국가대항전 경기 → `_raw/notes/P5-national-match.md`
- [x] P6 남은 화면 배치: 미션 선택 · 기록연감/통계 · 스페셜 · 시즌 끝 · 상점 · 에디트 → `_raw/notes/P6-screens.md`
- [x] P7 작은 조각 묶음 (A·B·E·G·J·H·K 의 미해결 잔여) → `_raw/notes/P7-leftovers.md`

## 3차 해독 (2026-09-19 추가 — 계속 찾기)
- [x] Q0 빈 곳 감사: 상태 기계·문자열표·에셋·주소 구간 전수 → `_raw/notes/Q0-coverage-audit.md`
- [x] Q1 CPU 공격 AI (사람이 투구할 때 타자 스윙·번트·도루·교체, battingPattern.arr) → `_raw/notes/Q1-cpu-offense-ai.md`
- [x] Q2 미션 보상 · 명예의 전당 선수 활용 → `_raw/notes/Q2-mission-rewards.md`

## 4차 대기열 — 하나씩 차례로 (2026-09-19)
> 한 번에 에이전트 하나. 앞 항목이 `[x]`/`[-]` 가 되면 다음 `[ ]` 를 띄운다. 결과 파일 = `_raw/notes/<이름>.md` (맨 위 체크리스트로 이어하기)
- [x] R1 하루치 경기 승패 뒤집힘 재확인 (0xc2a48 score 칸 ↔ side 대응, 포스트시즌 0xc2760 과 비교) — E 원본 버그 후보 → `R1-league-day-winner.md`
- [x] R2 경기 연출 좌표·타이밍: deadly_effect · game_effect · player_effect · combo · board_ani(전광판), 효과음 장면 잔여(8·10·12~15·26~28·44·53·59·61, 음성 17·25) → `R2-game-effects.md`
- [x] R3 경기 화면 잔여: 카메라 추적·경계, 수비수 동작 번호 이름·외야 6·7 좌우, 슬라이딩 실제 이득, 주자/야수 속도 단위, 필살송구 아웃 기록 지점 → `R3-field-view.md`
- [x] R4 교체·준비 화면: 대타·투수 교체 화면 내부, 엔트리 선발 변경(엔트리 편집 0x5561c~0x58370, 나리 상태 124·143 공용), 경기정보 값 줄 0x5de44, 교체 화면 그리기 0x384b8, 일반모드 준비 각 단계 코드(메인 메뉴 준비 상태 진입 함수), 경기진행 설정 값↔문구 → `R4-lineup-screens.md`
- [x] R5 비트맵 글꼴(한글 조합형 벌 고르기 식, 0xd602e) · ptc 파티클 51바이트 필드 뜻 → `R5-font-particles.md`
- [x] R6 그림 잔여: fence_season 20프레임 ↔ 구장 아이템, 메인 메뉴 칸별 main_ui 1~4 분기, 효과 1·인자7 / 0x10, 그림 객체 +0x3c 좌우 반전, 관리 화면 초상화 바닥 y → `R6-sprite-leftovers.md`
- [x] R7 수치 잔여: 경기 뒤 인기도(0xa690c)·사기(0xa73c4) 식 재확인, 드래고나 해금 경로, 투수 GP 능력 아이템 대상, 필살타법 창 최고 레벨 차단 → `R7-number-leftovers.md`
- [x] R8 기록달성 남은 판정 지점: 지급 함수 0xa77f0 호출지 25곳의 기록 번호·조건 표 (대타홈런·백투백·도루 성공·도루 저지·병살·삼중살·연속 파울·필살송구), 0xa7998 → `R8-record-triggers.md`
- [x] R9 나리 장면 0x106 상태 표 100~145 전체, 연초 처리 0x8a680, 상태 114·128·137·145 → `R9-myleague-states.md`
- [x] R10 경기 장면 이름 없는 상태: 12(0x3b80c) · 19(0x406e8) · 24(0x4f928/0x4fe9c) · 30(0x401d4) · 경기 시작 소개 33(0x4258c) → `R10-game-states.md`
- [x] R11 스페셜 잔여: 에디트 이름 변경 0x2b2e0 · 글 입력기 0x2d370→0x26860→0x707a1 · 명전 삭제·시즌 중 막기 0x2ac00 · 모드 목록 잠금 0x28cb0 → `R11-special-leftovers.md`
- [x] R12 상점·아이템 가드: 나리 구매 0x13460 · StrMODE 208~210·224 · StrCOMMON 141·142 · 기간제 아이템 만료 알림 StrUSER_EVT 85~113(0x8b1b8·0x8b924) · 구장 아이템 문구 0x837ea → `R12-shop-guards.md`
- [x] R13 시즌 잔여 상태: 0xd9/0xda · 0xdd/0xde/0xe0/0xfa · 세 번째 점프표 0xcc024 칸 함수 약 40개 → `R13-season-leftovers.md`
- [x] R14 경기 부수 화면: 홈런더비 결과 0x45c18 · 강판 뒤 감독 대사 창 0x86198·0x85f38 → `R14-game-side-screens.md`
- [x] R15 경기 0x51408 이 함수 포인터로 쓰는 0xac758 의 정체 → `R15-ac758.md`

## 교차 검증
- [-] V1~V5 — 사용자 요청으로 중단 (2026-09-19). 중간 결과만 `_raw/verify/` 에 있음
- [-] 2차 해독 결과 검증 — 하지 않음

## 해독 불가 (원본 서버 필요)
- [-] 대전모드 상대 · 보상 · 등급, 랭킹, G 충전 · 선물, 데이터 백업/복구, 미션 다운로드

## 5차 대기열 — UNRESOLVED.md 의 남은 63건 (2026-09-20~, 동시에 3개)
> UNRESOLVED.md ④ "다음에 해독한다면 이 순서" 를 그대로 따른다. 🌐·죽은 코드·궤적은 하지 않는다.
- [x] S1 U-03 승·패·세이브 투수 판정 (state+0x44/0x50/0x5c 를 쓰는 곳 전수) → `S1-win-loss-save.md`
- [x] S2 U-01·U-02 페어/파울 문턱(0x9d660)과 2아웃 득점 보류(메시지 0x13) → `S2-fair-foul.md`
- [x] S3 U-04 구장 아이템 구매 처리와 가격 표 0xd44c4 → `S3-stadium-items.md`
- [x] S4 U-06 평판 평가 16칸(SR+0x1a0)의 칸 이름 → `S4-season-reputation.md`
- [x] S5 U-13~U-17 투수편 잔여 5건 (평가 칸 5개·state+0x6a·게이지 글자·CPU 선발 교체·S+0x68/0x69) → `S5-pitcher-leftovers.md`
- [x] S6 U-18~U-21 시즌·국가대항전 뒷정리 4건 (S+0x12c 리셋·대표팀 복구·선수 +0xa 비트·0xb6720) → `S6-season-cleanup.md`
- [x] S7 U-07~U-09 수비·주루 AI 잔여 앞쪽 (송구 목표 점수식 0xafb24·도착 틱 0xaf284·충돌 종류 vt6c) → `S7-fielding-ai-2.md`
- [x] S8 U-10~U-12 수비 AI 상태 8·9·0xe·메시지 0xbc3·state[0x19]·견제 리드 폭 → `S8-fielding-ai-3.md`
- [x] S9 U-24 마선수 레벨업 창 + U-50 목록 격자 위젯(0x79ed5/0x7a571 — U-51·55·60 동반) → `S9-widgets.md`
- [x] S10 U-46·U-53·U-58 에셋 렌더해 눈으로 읽기 묶음 → `S10-asset-reading.md`
- [x] S11 Q3 최종 감사: 정말 다 해석됐는지 독립 확인 → `Q3-final-audit.md`
