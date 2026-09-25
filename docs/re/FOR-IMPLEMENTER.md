# 웹판을 고치는 사람에게 — 할 일 목록

원본(`base/게임빌2010프로야구/0002C663.jar` 의 `binary.mod`)이 **기준**이다. 웹판이 원본과 다르면 웹판이 틀린 것이다.
판정 표기는 원 문서를 그대로 따른다: **확정** = 디스어셈으로 식·표까지 확인 · **유력** = 한 고리 미확인 · 🌐 = 원본 서버가 필요해 오프라인 구현 불가.
**사용자 결정: 원본 버그도 그대로 옮기고, 수정은 나중에 한다** (`DECISIONS.md`). 버그를 "고쳐 놓은" 웹 코드도 원본 쪽으로 되돌린다.
무엇을 하기 전에 **[CORRECTIONS.md](CORRECTIONS.md) 를 먼저 읽을 것** — 뒤 해독이 앞 문서를 뒤집은 40여 건이 거기 모여 있고, 본문에 정정이 안 들어간 곳이 있을 수 있다.
웹 파일:줄은 원래 저장소 `/Users/evan123/Desktop/code/baseball-2010` 의 main `2fa9283` 기준이다.
**5차 해독(S1~S10)과 최종 감사(Q3)가 끝난 뒤 갱신했다 — 새로 닫힌 것은 아래 F 절에 모았다.**

---

## A. 지금 웹이 틀린 것

원본과 **다르게 동작하는** 곳. 기능이 아예 없는 것은 B 로 갔다.

### A-1. 경기 규칙 · 판정

| 우선순위 | 웹 파일:줄 | 지금 동작 | 원본 동작(수치·식) | 근거 문서 | 판정 |
|---|---|---|---|---|---|
| 상 | `src/features/play-game/model/gameFlow.ts:271-277` · `src/entities/game/model/gameRecords.ts:109` | 완투·완봉·노히트·퍼펙트(28~31)를 **조건 없이** 준다("팀 조건조차 없이 항상 집계") | 0xa7de8 은 ① 사람 팀 승리 ② 모드 ≠ 4(나리 타자편) ③ 사람이 코스를 확정한 적 있음 ④ 현재 투수 아웃 == 3×치른 이닝 일 때만 준다 → **모드 4 인 웹에선 원본대로면 한 번도 나오면 안 된다**. 지는 경기의 "완투승" 도 원본엔 없다 | R8-record-triggers.md 9절·6절 | 확정 |
| 상 | `src/entities/game/model/quickAtBat.ts:41,81` · `data/balance.json:187` · `src/entities/league/model/leagueDay.ts:16,87-89` | 10회부터 보정(+5), 14회에 스윙 강제, 14회 상한·동점이면 홈 승 | 원본 이닝은 0-기준이라 **11회부터 +5 보정, 15회에 스윙 강제** → 1-기준이면 `from=10`, `forced=15`. **연장 상한 없음·무승부 불가**(14회 상한과 "동점 → 홈 승" 은 원본에 없다) | E-defense-rules.md E-1 · 3d | 확정 |
| 상 | `src/entities/game/model/baseState.ts:99-104` · `simulateHalfInning.ts:93` | CPU 간이 엔진에서 "뜬공 + 3루 주자 + 2아웃 미만 → 1점"(희생플라이) | **원본 간이 엔진에 희생플라이가 없다.** 결과 코드 0(아웃)은 주자를 전혀 움직이지 않는다 → CPU 경기에 점수를 더 낸다 | E-defense-rules.md E-2 · 3f | 확정 |
| 상 | `src/entities/game/model/baseState.ts:92-104` | (사람 경기) 3루 주자 + 2아웃 전 뜬공아웃이면 **무조건** 1점 | 뜬공 포구 시 모든 주자 요구 루 = 원래 루(0xa9620 태그업), 그 뒤 자동 진루 0xaf918 이 **수비 송구보다 2틱 이상 빠를 때만** 다음 루로 → 희생플라이가 보장되지 않고, 1·2루 주자 태그업 진루도 있다 | P2-fielding-ai.md 7절 | 확정 |
| 상 | `src/entities/game/model/baseState.ts:63-83` | 안타 진루가 고정(1루타면 3루 주자만 득점 등) | 주자마다 0xaf918 로 추가 진루 판단 → 1루타에 2루 주자 득점·1루→3루 가능. **2아웃이면 득점 보류**(메시지 0x13) | P2-fielding-ai.md 7절 (보류 지점은 UNRESOLVED U-02) | 확정(식) / 미해결(보류 구현 지점) |
| 상 | `src/entities/league/model/leagueDay.ts:87-89` | "원정 득점 > 홈 득점 → 원정 승"(= 버그를 고친 쪽) | **원본 0xc2a48 은 진 팀에 승을 준다**: `원정 > 홈 ? (홈 승, 원정 패) : (원정 승, 홈 패)`, 상대전적도 뒤집히고 동점이면 원정 승. 포스트시즌 0xc2760 은 정상 | R1-league-day-winner.md 항목5 · DECISIONS.md 2026-09-20 ① | 확정 (원본 버그, **그대로 옮기기로 결정**) |
| 상 | `src/entities/league/model/leagueDay.ts:29-40` (`matchupsOf`) | 번호 작은 팀 = 원정 | 0xb7844: 짝 중 작은 번호가 `!r7`, **날짜/9 의 홀짝 + 22일을 넘으면 반전** | R1-league-day-winner.md 항목5 · UNRESOLVED U-40 · DECISIONS ① | 확정 |
| 상 | `src/entities/league/model/league.ts:66-73` | `Array.sort` 로 승·패·상대전적(팀 번호로 **바르게**) → 팀 번호 | 0xb79d8 은 선택 정렬 중인 **배열 위치**로 상대전적 표를 찾는다 → swap 이 한 번이라도 나면 엉뚱한 팀끼리 비교. 마지막 기준은 "현재 배열 위치가 앞선 팀" | E-defense-rules.md 2절 · 3e | 확정 (원본 버그, 그대로 옮김) |
| 상 | `src/entities/pitching/model/selectPitch.ts:49` | CPU 투구 패턴 난이도 기본값 `'normal'` | 옵션 `+0x2c` = 난이도, **기본 2 = hard 이고 뒤로 바꾸는 곳이 없다** → 원본은 늘 `pitchpattern_hard` | L-sound-effects.md 요약·4-A · P7-leftovers.md K2 · DECISIONS ② | 확정 |
| 중 | `src/entities/game/model/simulateHalfInning.ts:92-98` | 땅볼 진루타 난수를 `canAdvance` 일 때만 뽑는다 | 원본은 아웃 ≤1 이면 **주자가 없어도** `rand(0,10000)` 을 먼저 뽑는다(판정 자체는 웹과 같음) → 같은 시드 재현을 원하면 순서를 맞출 것 | E-defense-rules.md E-3 · 3g | 확정 |
| 중 | `src/entities/batting/model/battedBallOutcome.ts` · `missionClearability` | 장내(그라운드) 홈런이 없어 3루타로 센다 | 원본에는 그라운드 홈런이 **있고 홈런 + 그라운드홈런 둘 다로 센다**. 타구 근사에 만들 길이 없으니 최소한 미션 "그라운드홈런" 판정만이라도 홈런 쪽으로 | E-defense-rules.md E-8 · 1e | 확정 |
| 중 | `src/entities/batting/model/battedBallOutcome.ts:22,36` | 페어 45~135 (양끝 포함) | 0x36140 은 `−135 < a < −45`(양끝 제외) — **정확히 선 위(±45·±135)는 폴** | P2-fielding-ai.md 7절 | 확정 (페어/파울 문턱 자체는 UNRESOLVED U-01) |
| 중 | `src/entities/batting/model/swingSkills.ts:27-39` (`atBatRecordCodeOf`) | 삼진 5 · 땅볼 6 · 그 밖 아웃 7 · 나머지 8 | 원본(0xa8024) 5 기타아웃 · 6 뜬공 · 7 삼진 · 8 볼넷 · 9 사구 | P7-leftovers.md A1 | 확정 (9 "사구" 이름만 유력) |
| 중 | `src/entities/game/model/gameRecords.ts:9` | 기록달성 게이트가 "공격·수비 팀이 사람 팀인가" 만 본다 | 원본은 그 밖에 ① 자동진행 뒤에는 전부 없음 ② 모드 5·6·7(미션·홈런더비) 전부 없음 ③ 번호마다 방향 고정(0~15·32~35·37~39 = 사람 공격, 16~31·36 = 사람 수비; 28~31·37~39 는 게이트 없음) | R8-record-triggers.md 9절 | 확정 |
| 하 | `src/entities/game/model/gameRecords.ts:62-77` (34·35) | 볼넷·사구를 함께 센다 | 원본은 **결과 8(볼넷)만** 세고 사구(9)는 안 세며 백투백 카운터(ctx+0x162)는 끊는다. 지금은 사구가 없어 차이 없음 | R8-record-triggers.md 9절 | 확정 |
| 하 | `src/entities/game/model/gameRecords.ts:159` 주석 | 18~23 판정 자리를 0xa7c4c·0xa7d0c 로 적음 | 16·17 은 0xa7c4c, **18~23 은 0xa7998**, 25 는 0xa7d0c | R8-record-triggers.md 7절·9절 | 확정 |

### A-2. 육성(나만의리그) 수치

| 우선순위 | 웹 파일:줄 | 지금 동작 | 원본 동작(수치·식) | 근거 문서 | 판정 |
|---|---|---|---|---|---|
| 상 | `src/entities/career/model/gameEvaluation.ts:85-96` (`reputationChangeOf`) | 인기도·안타·홈런·사이클·무안타·병살·득점권만 본다 | ① **평판 구간 보정 꼬리표**(0xd82a0 / 0xd82c8)가 통째로 빠졌다 ② 칸 7개 빠졌다: 만루홈런 +2 · 끝내기 안타/홈런 +3 · 번트안타 +1 · 볼넷 2개↑ +1 · 역전 득점 +2 · 동점 득점 +2 · 삼진 2개↑ −2 | B-season-awards.md B-10 · 4절 · P7-leftovers.md B1·B2 · P1-pitcher-rules.md 5-2 · DECISIONS ③ | 확정 |
| 상 | `src/entities/career/model/gameEvaluation.ts:20-22,31-34` (인기도) | 안타·홈런이고 타점>0 → 끝내기 5, 아니면 `[3,4,5,6][루타−1]` | **홈런만** 표를 쓰고 칸은 **득점 수**: 솔로 3 · 투런 4 · 스리런 5 · 만루 6, 끝내기 홈런 5 | R7-number-leftovers.md 1c | 확정 |
| 상 | `src/entities/career/model/gameEvaluation.ts` (`WALK_OFF_WITHOUT_RBI` 4) | "타점 없는 끝내기" 에 4 | 원본 4 는 "끝내기 **and 득점>0**". 득점 없는 끝내기 가지가 원본엔 없다 → 웹 상수의 뜻이 뒤집혀 있다 | R7-number-leftovers.md 1c | 확정 |
| 상 | `src/entities/career/model/gameEvaluation.ts` (인기도) | 홈런이 아닌 플레이의 득점 가산이 없다 | 1점 → +1 · 2~3점 → +2, **안타면 여기에 루타 점수를 더한다**(예: 2타점 2루타 = 2+2 = 4). **안타 아닌 타점**(밀어내기·희생플라이·땅볼 타점)도 +1/+2. 웹 주석의 "진루 보너스 r6" 이 실은 루타 점수였다 | R7-number-leftovers.md 1c | 확정 |
| 상 | `src/entities/career/model/gameEvaluation.ts:66-67` | 합계 = 점수 + 사이클 7 | 그 **앞에** 삼진 2개 이상(G+0x108 > 1)이면 −1 (0xa6934) | R7-number-leftovers.md 1c | 확정 |
| 상 | `src/app/model/seasonEvents.ts:29` | `TITLE_RANK = 0` 고정 | 연봉협상 등급 k 가 늘 0 → 강경은 늘 387(−20%), 정중은 늘 391(−10%) 이 된다. 등급은 개인 타이틀 순위에서 온다 | B-season-awards.md B-5 · 5a · 요약 | 확정 |
| 상 | `src/entities/career/model/seasonFlow.ts:22` | `GOAL_TABLE = 0` 고정 | 원본은 **선수 타입 비트**로 표를 고른다(장타형 = 둘째 표 0xd7f9e). 단계 2(+10%)·3 도 웹엔 없다 | B-season-awards.md B-9 · 7절 | 확정 (표를 읽는 줄은 UNRESOLVED U-23 유력) |
| 상 | `src/entities/career/model/condition.ts:41-52` | 부상/질병 중 **하나만**, **장비 보정 전**에 곱하고, **사기 감소가 없다** | 0xb570c: 부상·질병을 **둘 다**, **장비 보정 뒤**에 적용하고, **사기 감소 보정**이 더 있다 — 사기 31~50 −10% · 11~30 −20% · ≤10 −50% | G-management-numbers.md G-1 · 4-3 · 요약 2 | 확정 |
| 상 | `src/entities/career/model/gpItems.ts:55-64` | 한계 비교를 `effectiveAbilityOf`(장비·스킬·부상 포함)로 한다 → 장비가 있으면 기본값을 한계 **아래로 깎는다** | 0xa4488 은 **기본값(장비·스킬 빼고)** 으로 비교하고, 기본값이 한계를 넘을 때만 한계로 내린다. 웹 주석 "장착 보너스 포함 0xb6414" 도 틀림 | G-management-numbers.md G-5 · 5-1 · 요약 10 | 확정 |
| 상 | `src/entities/career/model/outing.ts:23-36` | 가드 순서가 사기 → 건강 → 소지금이고, **보험증서면 소지금 검사를 건너뛴다** | 0x16cf0 순서가 다르고, **소지금 검사는 보험증서를 보지 않는다**(0x16d42) → 200만 미만이면 보험증서가 있어도 막힌다 | G-management-numbers.md G-3 · 3-1 · 요약 11 | 확정 (원본 버그, 그대로 옮김) |
| 중 | 외출 빈 장소 처리 (문서가 가리킨 곳: `RALPH_PROGRESS.md:534`) | 빈 장소(440~444)에서 **행동을 쓴다(추정)** | 0x1c014(플래그 +0x167): **빈 장소는 행동을 쓰지 않는다** — 웹과 반대 | G-management-numbers.md G-4 · 3-4 · 요약 3 | 확정 |
| 중 | `illnessChanceOf` (`src/entities/career/model/condition.ts` 계열) | 사기 구간만 본다 | 사기 >70 0 · 51~70 2 · 31~50 4 · 11~30 7 · ≤10 14 % 에 **유리몸 +10 · 행운 −20** 보정이 붙는다 | G-management-numbers.md G-8 | 확정 |
| 중 | `src/entities/career/model/gpItems.ts` 알림 | "+10" 으로 표시 | 실제로 +10 올리면서 글에는 "히트 **6** 상승" / "모든능력치 **8** 상승" 이 찍힌다(인자 6·8) | G-management-numbers.md 2절 · 5-1 · DECISIONS | 확정 (원본 버그, 그대로 옮김) |
| 중 | `src/entities/career/model/playerCareer.ts:339-340` | 행동 플래그를 **2경기마다** 푼다 | 원본 기준은 "경기 한 번"(커리어 +4). 관리 화면이 2경기마다만 열리면 결과는 같지만 기준이 다르다 | G-management-numbers.md G-6 · 4-5 | 확정 |
| 중 | `src/entities/career/model/seasonFlow.ts:77` (`judgeEnding`) | 식은 원본과 같다 | **첫 줄(부상 누적 엔딩 500)이 빠졌다**: 부상 중 치른 경기 수 +0x1b6 을 세고 20경기가 되면 엔딩 0 (0xa3a84) | B-season-awards.md B-6 · B-7 · G-management-numbers.md 요약 8 | 확정 (카운터 뜻은 유력) |
| 중 | `src/entities/story/model/storyScene.ts` (`isInDateWindow`) | 연차 둘 다 0 일 때만 날짜 창 검사를 생략하고, 경기 번호를 45 로 자른다 | 0xacfbc: **네 바이트 중 하나라도 0 이면** 생략. 경기 번호 자르기 없음 | A-events-skills.md A-2 · 상세 1절 | 확정 |
| 중 | `src/entities/story/model/storyScene.ts` (`nextEventFor`) | 매번 배열 처음부터 훑고, "분기 전용 63개 제외" 규칙이 있다 | 원본은 **커서를 이어 쓴다**. "분기 전용 제외" 규칙은 원본에 없다 — 원본은 **대상 0** 으로 막는다 | A-events-skills.md A-1 · 상세 1·3절 | 확정 |
| 중 | `src/entities/batting/model/swingSkills.ts:42-44` | 스킬 16·17 이 `slice(-2)`(가장 **최근** 둘)를 보고 개수 조건이 없다 | 원본(0xaba7e~)은 링버퍼의 **가장 오래된 둘**(용량이 차기 전에는 그 경기 첫 두 타석)을 보고, 개수 조건 **>3 / >2** 가 있다 | A-events-skills.md A-5 · "스킬 16·17 의 최근 두 타석" | 확정 (코드 5~9 의 뜻만 유력) |
| 중 | `src/entities/story/model/eventReward.ts` · `src/app/model/seasonEvents.ts` | 이벤트 393~396 보상에 연차 보정이 없다 | 0x8d508: 393·394·395 — 타자·투수편 종류 0 +3y · 1 −2y · 3 +y / 396 — 종류 0 −4y · 1 −3y (y = 0-기준 연차) | A-events-skills.md A-6 · K-bursts-special.md K-2 | 확정 |
| 중 | 스킬 조건 20·21 (`storyScene.ts` 조건 switch) | 조건 20/21 미구현 → 이벤트 402~438 이 뜨지 않는다 | 스킬 획득(20)·해제(21), 스킬 번호 = v−1. 그리고 **+0x1d0 플래그**(마이너스 스킬을 한 번 해제했으면 다시 못 얻음, 표 0xd7e10 = [2,3,4,5,17,18,19,20])가 웹에 없다 | A-events-skills.md A-4 · 상세 4절 | 확정 |
| 중 | `src/entities/career/model/titles.ts:35-61` + `seasonFlow.ts:62-66` | 27개 중 3·4·43 을 그 해 이후 계속 판정, 25·26 을 시즌 끝에 판정, 여러 개를 한꺼번에 배열로 붙인다 | 3·4 는 **9년차에만**, 43 은 **6년차 18경기째에만**, 25·26 은 **다음 시즌 첫 경기 전**에 지난해 +0x6a 로 판정. 부여는 **관리 화면 진입 때 번호 작은 것 하나씩 팝업** | P3-titles.md 9절 · 요약 | 확정 |
| 하 | `src/entities/career/model/titles.ts:64` (`currentTitleOf`) | titleIds 의 마지막을 장착 | 원본도 얻는 즉시 장착(선수 +0x1c4, 0x1b214)이지만 **# 키로 고르는 화면**과 "닉네임이 적용되었습니다" 가 있다 | P3-titles.md 10-3 | 확정 |
| 하 | `src/entities/career/model/training.ts:87-89` ('훈련완료' 가드) | 우리가 넣은 안전장치라고 주석에 적혀 있다 | **버그 아님 — 원본과 같다.** 필살타법 창 0x17828 이 L=4 면 모든 칸을 StrMODE[63] 으로 막는다. **주석만 고치면 된다** | CORRECTIONS.md 1절 · R7-number-leftovers.md 4절 | 확정 |
| 하 | `src/entities/career/model/gpItems.ts:25,68` · `subItems.ts:10,20` · `recovery.ts:17` · `outing.ts:79` · `abilityLimit.ts` · `training.ts:90-91,106-119` · `condition.ts:36,60-93` · `equipment.ts:40,151` · `playerCareer.ts:166,337` · `eventReward.ts:57,106` · `storyScene.ts:91` | 값은 맞는데 주석이 "추정"·"못 찾았다" 로 남아 있다 | 전부 **원본과 같음이 확정**됐다 — 주석만 정리 | G-management-numbers.md 0절 · 5-1·5-2·5-3 · A-events-skills.md A-4 | 확정 |

### A-3. 화면 · UI

| 우선순위 | 웹 파일:줄 | 지금 동작 | 원본 동작(수치·식) | 근거 문서 | 판정 |
|---|---|---|---|---|---|
| 상 | `src/widgets/special-swing/ui/SpecialSwingWindow.tsx:66,77` | 이름을 `BATTER_BURSTS[cursor]` 로 뽑아 **넷째 칸이 늘 "미라지 스윙"**, 칸을 "레벨" 로 표시, 기술 바꾸기 없음 | 0x17cec/0x17828: 넷째 칸은 **타입 1 이면 "메테오 스윙"**, 칸 = 기술 번호(칸 i == 배운 수일 때만 훈련), 확인 키로 **기술 바꾸기**(StrMODE 69~71), 인기도 100/500/1000/1500 조건, **G 부족이면 [65] 로 막음**, L ≠ i 칸은 [63]/[64] 안내 | H-modes.md H-4 · 상세 "필살타법 선택" · R7-number-leftovers.md 4절 | 확정 |
| 상 | `src/features/shop/model/shopSelection.ts:110` | GP 아이템 가드가 **G 부족 하나뿐** | 0x13460: G부족(65) → 능력치최대(192) / 사기최고(91) / 건강(208) / 마이너스스킬없음(209) / 이글아이맥스(210) / 스태미나최대(211) → 확인(82). **6개 가드가 통째로 빠졌다.** 이글아이는 앞줄에 StrMODE[224] 를 덧붙인다. 엄마의도시락은 최대인 능력만 192 줄로 나열하고 4개 다 최대일 때만 구매 불가 | R12-shop-guards.md 5절 · 요약 ① | 확정 |
| 상 | `src/entities/career/model/equipment.ts:141` (`hiddenOpenIdOf`) | 컬렉터 해금이 **타자 id 만**(36·40·44·48) | 부위별로 타자 36·40·44·48 / **투수 20·24·28·32** | R12-shop-guards.md 5절 · 요약 ② | 확정 |
| 중 | `src/entities/career/model/equipment.ts:108` | 해금 알림 뒷줄이 타자 문구 고정 | StrCOMMON 141·142·143 = 해금 알림 뒷줄, id **13~18 시즌 / 19~34 나리 투수 / 35~50 나리 타자** 로 갈린다 | R12-shop-guards.md 5절 | 확정 |
| 중 | `src/features/shop/model/shopSelection.ts:29-35` 주석 | 장착 성공 알림을 "StrMODE[142]" 로 적었다 | **StrMODE 에 그런 글이 없다.** 원본은 확인 팝업(81) 뒤 따로 알림이 없다 | R12-shop-guards.md 5절 | 확정 |
| 상 | `src/widgets/standings/lib/standingsLayout.ts:34-36` · `StandingsWindow.tsx:24` | `POSTSEASON_ROW_COUNT = 4` — "포스트시즌 플래그면 4줄"(아무도 안 씀) | 줄 원점·18px·박스는 같다. **4줄은 국가대항전 4개국 순위**(L+0xac, 0xb7f0c) — img_text 75~78 대한민국·일본·쿠바·미국 | P6-screens.md 4a-2 · CORRECTIONS.md 2절 | 확정 |
| 중 | `src/pages/mission-select/ui/MissionSelectScreen.tsx` + `src/app/model/useMissionSession.ts:150` · `src/shared/api/save/missionRecordPort.ts` | 클리어 키 목록만 저장 — **G 보상·클리어 횟수·감소식이 없다** | 미션 보상 G 와 클리어 횟수·재클리어 감소식이 원본에 있다. 잠금 규칙("바로 앞 미션을 깼으면 열림")은 웹이 맞다 | Q2-mission-rewards.md 1-웹 · 2b | 확정 |
| 중 | 미션·홈런더비 선수 고르기 (문서가 가리킨 곳: `RALPH_PROGRESS.md:459`) | 육성 선수가 없으면 **신인 능력치로 대체** | **신인 대체가 없다** — 육성 선수도 명예 선수도 없으면 미션·홈런더비에 못 들어간다(코드 5/6 은 팝업만). 원본은 "육성/명예 × 투수/타자" 네 갈래 + 빈칸 안내 3종 | Q2-mission-rewards.md 3-1 · 3-2 · 4절 | 확정 |
| 중 | `src/pages/main-menu/model/mainMenu.ts:27-34` | 첫 커서를 저장 유무로 고르고, 저장이 없으면 최근게임을 못 고르게 막는다 | 원본은 **늘 커서 0(최근게임)** 에서 시작하고 잠그지 않는다. 원본이 잠그는 칸은 **대전모드 하나**(전역 +0x42 == 0 → StrMAINMENU[115]) | R11-special-leftovers.md 4-2 · 요약 ④ | 확정 (웹 쪽이 친절 — 그대로 둬도 무방) |
| 중 | `src/shared/ui/MessageBox/MessageBox.tsx`, `.css.ts` | 한 줄 예/아니오 상자 높이 86, 열림·닫힘 애니 없음, 글 색 `ORIGINAL_COLORS.text` | h = **79**, 상자 y = 120, 글 y = 140, 버튼 (59,169)·(140,169). 열림(세로 ×2 펼침)·닫힘(가로 ÷2) 애니가 있고 글 색은 **흰색**(0x74682). 창 종류는 **1 알림 · 2·4 예/아니오 · 3 버튼 없음 · 8 · 16** | F-ui-layout.md F-1 · "웹판과 다른 점" · CORRECTIONS.md 2절(V4 정정) | 확정 |
| 중 | `src/pages/outing-map/ui/OutingMap.tsx:19,21,50,65-68` · `OutingMapScreen.tsx:43-76` · `OutingMapScreen.css.ts:23` | 프레임 6(길 점선)을 늘 그림 · 화살표 (x+11, y+7+MAP_TOP) · [!] (x+10, y+15+MAP_TOP) · 장소를 누르면 **전체 화면 목록** · 고른 칸을 `brightness(1.3)` | 프레임 6 은 **밤에만**(화면을 어둡게 한 뒤) · 화살표 기준점 **(x + w/2, y + MAP_TOP)**(웹이 2px 왼쪽·7px 아래) · [!] 기준점 **(x + w>>1, y + MAP_TOP)**(웹이 15px 아래) · 장소 기능 목록은 **말풍선**(고른 프레임의 박스 3, 다섯 곳 모두 70×42) · 장소 이름에 외곽선(검정/노랑)·글색(흰/검정)·고른 칸 강조 · 안 고른 건물은 **반투명 7/16 (globalAlpha ≈ 0.44)** | F-ui-layout.md F-2 · 2-3~2-7 · R6-sprite-leftovers.md 3a | 확정 |
| 중 | `src/widgets/batting-stage/lib/renderHud.ts:14` | "확대 연출 없음" 이라 적혀 있다 | S·B·O 램프(파트 13·14·15)는 카운트가 바뀌면 **5배 → 1배로 5틱 동안** 줄어든다 (위치 = x − (z−1)·w/2) | F-ui-layout.md F-3 · 3-1 | 확정 |
| 중 | `src/shared/config/original/trainingAnimation.ts:35-36` | 타격형 동작표(0xd49e8·0xd4a48)만 있다 | **장타형 동작표가 따로 있다**: 히트/모든능력치 0xd4a18 = [0,5,6,7,8,9,10,11,11,11,11,11] · 파워 0xd4a6c = [0,5,6,7,8,8,8,8,8] | F-ui-layout.md F-6 | 확정 |
| 중 | `src/widgets/batting-stage/lib/renderScenery.ts:31,86-98` | 전광판을 박스 2 로 잘라 **첫 프레임 고정** | 박스 **0**(창 종류 3 만 2), x 이동 +0x8c 틱당 −1px, 되감기 −153 → 상자w+2, 환경설정 저장 **+0x3a(전광판) OFF 면 안 그린다** | R2-game-effects.md 6절 · 9절 · 요약(5) | 확정 |
| 중 | `src/widgets/batting-stage/*` (좌우 반전 없음) · `RALPH_PROGRESS.md:749` | 타자 side 를 1 로 고정 — **좌타 배치만** 그린다 | 원본은 `career.battingSide` 를 그대로 쓴다. 그림 객체 +0x3c = 손(0 우타 / 1 좌타)이고, 우타면 효과 0x11 로 타자를 뒤집고 **구장(+0x60)도 통째로 뒤집히며 판정 사각형은 좌타일 때 480−x−w** 로 뒤집힌다 | C-create-palette.md C-5 · R6-sprite-leftovers.md 4절 · 요약 ④ | 확정 (투수 쪽 +0x3c 의 좌/우 뜻만 유력) |
| 중 | `src/pages/title/model/titleIntro.ts` · `ui/TitleScreen.tsx:13,32` | 옛 디코더 프레임 번호로 짠 키프레임, TOUCH SCREEN 8프레임 깜빡임, 저작권 (55,306) 추정 | 전부 원본 애니로. **전체이용가**는 인트로가 끝난 뒤 (198,2) 에 계속 그린다(웹은 인트로 중에만) | F-ui-layout.md F-4 · 4-1 · 4-2 | 확정 |
| 중 | `src/pages/create-player/ui/CreatePlayerScreen.tsx` (+ `:20` 주석) | PixelScreen + 버튼 목록, "그림 팔레트는 아직 바꾸지 않는다" | 원본 등록 화면은 **관리 화면의 기본정보 카드**(0x15e20) 위에 커서만 얹은 것(0x15f34). 미리보기·타석 그림 모두 피부 팔레트를 쓴다. (좌표는 `pages/management/lib/basicInfoLayout.ts` 와 같은 숫자) | C-create-palette.md C-6 · 1절 · 4절 | 확정 (화살표 세부 유력) |
| 중 | `src/widgets/event-portraits` | 초상화에 피부·장타형을 반영하지 않는다 | `event_char_0.mpl`: 피부 0 → mpl 안 씀 · 1 → 팔레트 0 · 2 → 팔레트 1, **장타형이면 프레임 +8**. 인물 8·9 는 팔레트 2 | C-create-palette.md C-1 · event_char_0 절 · CORRECTIONS.md 2절(V2) | 확정 |
| 중 | `src/shared/config/original/acePlayers.ts:24-33` (`burst`) | 마선수 기술 이름에 **일반 기술 이름**을 순번으로 붙였다(메디카 "파워 스윙" … 드래고나 "캐넌 볼") | 마타자 StrCOMMON[0x5f+n] = 100~104(핑크 봄…크로스 액스), 마투수 [0x5a+n] = 95~99(싸이킥 스타…브레스 웨폰). 생성기 `tools/generate_game_data.py` 의 `COMMON_*_BURST_RANGE` 를 고쳐야 한다 | H2-special-skills.md 6절 · 4-1 | 확정 |
| 하 | `src/widgets/batting-stage/lib/stageScenery.ts:82-93,110` | 판정 글자 번호표·애니 지연이 "(추정)" | 표 0xcfe90 과 같다 → **확정으로 바꿔도 된다**. 애니 칸 길이 = max(1, 지연 + 보정)(0x93d90) | R2-game-effects.md 7절 · 9절 | 확정 |
| 하 | `src/shared/config/frameRate.ts:6,14` | `DEFAULT_SPEED_LEVEL = 2` "(추정)" | 값은 원본과 같다(0x9f2a4, 16fps = 62ms) → 주석만 "확정" 으로 | F-ui-layout.md F-9 · 7절 | 확정 |
| 하 | `src/pages/settings/` (환경설정) | 투구 기본값을 **게이지**로 둔다 | 원본 상세 설정의 투구 기본은 **기본(게이지 OFF)** | K-bursts-special.md K-5 · 5-2 | 유력 (라벨 순서 미확인) |
| 하 | `src/pages/story/ui/StoryScreen.css.ts:5` | `PORTRAIT_HEIGHT = 104` 로 발밑을 판 바닥에 맞춘다 | 원본 관리 화면 초상화 바닥은 화면 좌표 **y = 135**(240×320), 외출 지도·장소는 252 | R6-sprite-leftovers.md 5절 | 확정 |
| 하 | `tools/decode_pzx.py:_part_style` | PZX 파트 효과 5~0xC·0x7E 를 무시 → mode_ui/game_ui 선택 칸이 기본색 | 효과 0x05+n = 붙은 0x40 형 mpl 에서 **그 파트 이미지의 n번째 변형 팔레트**(0xc8bb4). 관리 화면의 "선택 칸 주황" 이 이것 | C-create-palette.md C-3 · PZX 파트 효과 절 | 확정 (0x7E 는 무시가 맞음 — P7 C1) |
| 하 | `src/entities/career/model/training.ts:64-144` | `specialSwingLevel` 을 올리지만 **경기에서 읽는 곳이 없다** | 배운 수는 고를 수 있는 번호의 상한이고, 경기엔 고른 번호(+0x18)만 쓰인다 | H2-special-skills.md 6절 · 1-2 | 확정 |

---

## B. 원본에 있는데 웹에 없는 것

기능 단위로 묶었다. **예상 크기**는 "에이전트/사람 한 명이 붙었을 때" 기준 — 상(여러 번) · 중(한 번으로 빠듯) · 하(한 번에 끝남).

### B-1. 수비 화면과 사용자 조작 — 예상 크기 **상** (이 저장소에서 가장 큰 빈 칸)

- **무엇**: 웹에는 야수·주자·공·카메라 개념이 아예 없다. 타구는 `quickAtBat` 결과 코드로 바로 안타/아웃이 된다.
  - 수비 좌표계: 월드 40000×32500, 시야 = 화면×(40000/620, 32500/500), 매 틱 (공 x, 공 z − 높이) 를 가운데로, `[0, W−Vw]×[0, H−Vh]` 로 자르고 20%/틱 따라가기
  - 이동 속도: **야수 전원 220/틱**(능력치 무관), 주자 300 + 주루×7/100(+팀 등급)/틱, 슬라이딩 +40
  - 포구: 예측 지점으로 직선 이동, 포구 반경 내야 500 · 외야 300, 높이 창 ≤1000 / 1001~1700 / 필살 1701~4000·501~1500
  - 송구: 속도 940+8g, 악송구 보정 = 10 − 등급(야수 +0xe4), 악송구 ≈1.1%, 펌블 = 움직이는 공을 잡을 때마다 등급별 2.0~0.5%
  - 중계·협살·커버: 외야 송구 17000 이상이면 내야 중계(+3틱), CPU 수비는 35% 넘게 간 주자에 협살(AI 상태 8)
  - 사람 조작: 진루 2/4/8·모두 진루 0·귀루 3/1/7·모두 귀루 CLR·슬라이딩 OK(진행률 71~94%, 속도 +40)·송구 1루 6/2루 2/3루 4/홈 8·견제 1루 3/2루 1/3루 7·**필살수비**(슬라이딩·점프 캐치) → **레이저 송구**("반짝이는 순간" 입력)
  - 그라운드 룰 2루타(state[0x20]>0 && state[0x1e] → 결과 10), 장내 홈런(state[0x25])
- **근거 문서**: `I-controls.md` 0·1a·2a~2d·3a·3c · `P2-fielding-ai.md` 전체·7절 · `R3-field-view.md` 1~5·6절 · `R2-game-effects.md` 2절(deadly_effect)
- **필요한 데이터/표**: `stadium/defense.pzx`(310×500) · `defender` 스프라이트 + `defender.mpl`(팀 15색) · `ace/defender_<마선수>` 10폴더(이름 표 0xd3f10) · 선수 수비 위치 코드(레코드 +0x1c, C 참조)
- **남은 미해결**: U-01 페어/파울 문턱(`0x9d660`), U-02 2아웃 득점 보류, U-07~U-11 (송구 목표 점수식·도착 틱·충돌·AI 상태 8·9·0xe)

### B-2. 투수편(나만의리그 투수) — 예상 크기 **상**

- **무엇**: 등록(보직 선발/구원, 투구 타입, 우/좌완, **기본 변화구 2개 선택**), 등판 로테이션(선발은 짝수 날짜 카운터로 2경기마다 로스터 0번, 구원은 간이 엔진이 8회 내 팀 수비 첫 타석에 교체), **감독 강판**(선발만, 평판/100 4줄 표 0xcfa58: 체력 ≤20% · 체력 0% · 한 이닝 4실점 · 만루), 스태미나(구질별 9/11/12/13 소모, 용량 = 체력 실효·사기 보정 + 250(첫 투수 +200), 회복 40/80/20%), 투구 게이지 등급 t(0~5)와 능력치 배율 70~110% · 목표점 흩어짐 표 0xcfd60, 경기 뒤 투수 평가·감독 글(USER_EVT 2~37·38), 투수 레코드 칸(+0x20 아웃 · +0x22 실점 · +0x24 세이브 · +0x26 탈삼진 · +0x28 투구수 · +0x2e 승 · +0x2f 패, 방어율 = 실점×2700/아웃), 구질 훈련·히든 변화구 오픈(r_event 30~33)
- **근거 문서**: `P1-pitcher-rules.md` 1~6절 · `J-modes-rules.md` 3-1·3-3 · `R14-game-side-screens.md` 4절(강판 뒤 감독 대사 창 0x86198)
- **필요한 데이터/표**: 투수 시작 능력치 표(C-4 의 투수 표), 투수 개인 타이틀(다승·삼진·방어율) 판정에 필요한 0xb6ce8 식
- **주의**: 승·패·세이브 투수를 정하는 코드를 **아직 못 찾았다**(U-03, 필요도 상). 평가 "실점"(R+0x128)을 채우는 코드가 없다는 것도 **부재 증명(유력)** — D 참조

### B-3. 필살타법 5종 · 마구 6종 — 예상 크기 **중**

- **무엇**: 웹은 경기에서 필살·마구를 전혀 쓰지 않는다(`GameScreen.tsx:75` 이름 표시만, `selectPitch.ts:52-53` `magicCount: 0`).
  - 필살타법: '0' 키 → 남은 횟수 ≠ 0 이면 스윙에 번호 싣기, 히트·파워 +150~220, B +15~20%, C +6~9% (보정 구조체 0x34d6c 12바이트, 상한 B ≤ 9000 · C ≤ 4500)
  - 마구: 구질 칸 5 = 22, 레코드 번호 = **3(m−1) + f/2**(육성·일반) · **m + 7**(마투수) — pitch.zt1 구질 22 블록 17레코드(`pitchRecords.ts` PITCH_RECORDS[21])
  - 타이밍 창: |d| = 0·1·2 에서 100·63·27, |d| ≥ 3 이면 0 (`swingTiming.ts:9-20` 식은 이미 맞다 — 공이 안 나올 뿐)
  - 횟수: 육성 번호별 2·3·4·5 / 4·5·6·7, 마선수 레벨별 2·2·3·4·5 / 3·4·5·6·7, 스킬 23 +1/+2
- **근거 문서**: `H2-special-skills.md` 1~3절·6절 · `Q1-cpu-offense-ai.md` 5절(CPU 마타자) · `H-modes.md` H-4
- **주의**: "공 객체 +0x10(마구 번호)을 되돌리는 코드가 없다" 는 **부재 증명(유력)** — 맞으면 첫 마구 뒤 모든 투구에 마구 보정이 남는다. 밸런스가 정반대가 된다(D 참조)

### B-4. 돌발미션 — 예상 크기 **중**

- **무엇**: 시즌(모드 2) · 나리 투수(3) · 나리 타자(4) 에서 매 타석 준비 때 조건을 통과한 행마다 `rand(0,1000)/10 < b9` 주사위 → 통과 후보 중 균등 1개 → **경기당 최대 1회**. 타석이 끝날 때 결과비트(B0~B11, 0x801)로 성공/실패/무효 판정, 보상은 사기·인기도·평판·소지금
- **근거 문서**: `K-bursts-special.md` K-1 (열 16개·목표 판정표 전부) · `P7-leftovers.md` K1(결과비트 조건) · `CORRECTIONS.md` 1절("단타도 성공")
- **필요한 데이터/표**: `XlsBATTER_BURST`(40행) · `XlsPITCHER_BURST`(44행) · `XlsSEASON_BURST`(56행) 각 16바이트 + `*_TEXT`(행 520 = 4줄) — **C-1 로 새로 뽑아야 한다**

### B-5. 칭호(닉네임) 64개 — 예상 크기 **중**

- **무엇**: 웹에 27개뿐. 없는 것 = 2(1년차 MVP) · 5(우승 5회) · 8(국가대표) · 11·12(MVP 6·10회) · 13(전설 스킬) · 14~20(연애 이벤트 300~303) · 30(평판 0 유지) · 32·33(MVP 연속·4회) · 34(스킬 11) · 38(도루 100+홈런 150) · 44(주루 800+도루 200) · 45(능력 모두 999) · 46(필살타법 4단계) + **투수편 16개 전부(48~63)**. 명성 사다리, # 키 고르기 화면, 64개 완성 보상 60,000 G
- **근거 문서**: `P3-titles.md` 9절·10절·요약
- **주의**: 칭호가 쓰는 선수 필드(+0x184·+0x185/+0x186·+0x6a·+0x201)의 실제 사용처는 **유력**(U-31)

### B-6. 시즌모드 전체 — 예상 크기 **상**

- **무엇**: `mainMenu.ts:30` `isAvailable: false` — 통째로 없다.
  - 장면 0x105 상태 기계, 관리 메뉴 6칸·2경기 주기, 시즌 시작·새 해
  - 구단관리: 구장관리(관중석·전광판·잔디), **트레이드**(성공률 0xcf24, +20%/+50% G), 선수영입(육성·명전 선수, 원본 레코드 고르는 규칙 확정), **코치채용**(마선수 10명 보너스, 계약금·필요 인기도 0xa248), 팀 능력치 4종(0xb592c~0xb5a14), 팀 트레이닝·지옥훈련 500G, 관중 입장수·경기 수입(0xa34b8), 10년차 엔딩
  - s_event 30개(형식은 r_event 와 같음), 시즌 외출 5종(나리와 값·가드가 **다르니 재사용 금지**), 시즌 팀 질병·사기
  - 포스트시즌 대진(4팀·3라운드, 승수 3/3/4) — 식은 `league.ts:75-119` 에 이미 원본과 같은 값으로 있으나 나리 쪽에서만 쓴다
  - 시즌 잔여 상태: 0xd4(연초 올해의 목표) · 0xd9/0xda(선수 상세) · 0xdd(경기정보) · 0xde(팀 트레이닝 연출) · 0xe0(엔트리 편집) · 0xe1 · 0xfa(🌐 G충전), 세 번째 점프표 0xcc024 의 그리기 함수 약 40개
- **근거 문서**: `P4-season-flow.md` 1a~6절·7절 · `R13-season-leftovers.md` 1~12절 · `J-modes-rules.md` 4절 · `R9-myleague-states.md`(나리 쪽 대응)
- **필요한 데이터/표**: `s_event.zt1` 30개(C-5), 장비 가격표 앞/뒤 44칸(**앞 44칸 = 투수**, R12 정정), 구장 아이템 가격
- **주의**: 구장 아이템의 실제 **구매 처리와 가격 출처를 못 찾았다**(U-04, 필요도 상). 평판 평가 16칸(SR+0x1a0)의 뜻도 절반만 안다(U-06)

### B-7. 국가대항전 — 예상 크기 **중**

- **무엇**: 대한민국은 늘 내 팀, 매 라운드 사람 경기 한 판 + 같은 라운드 다른 경기는 0xc2dac 로 CPU 시뮬(판정 **정상**). 순위는 승 내림·패 오름, 동률이면 한·일·쿠·미. 매 경기 전 대한민국 투수 스태미나 전부 회복. 대표팀 명단은 내 선수를 원래 팀 로스터 칸 k 에 끼우고 그 칸 선수는 벤치 끝으로(타자는 수비 위치를 물려받음).
  - 나리: 홀수 년차 연말에 올해 목표 4개 이상이면 선발(461) → 출전(463)일 때만 치름 / 시즌모드: 짝수 연차idx 마다 무조건 출전(상태 242~244)
  - 보상: 나리 우승 인기+20·평판+30·소지금+2000만·G+1000(**준우승 없음**) / 시즌 우승 +30·+40·+5000만·G+1000, 준우승 +20·+20·+2500만
  - 히든 팀 오픈: 참가하면 대한민국, **우승하면 결승 상대**(일본·쿠바·미국)
- **근거 문서**: `P5-national-match.md` 1a~6절 · `K-bursts-special.md` K-3 · `J-modes-rules.md` 1-1
- **원본 버그(그대로 옮김)**: 대한민국이 결승에 못 가면 우승국을 rand(0,2) 50:50 으로 정함 · 결승에서 져도 "대표팀 탈락!!" · 선발을 거절해도 내 선수가 대표팀 명단에 들어감 · 시즌 준우승 문구는 2500만인데 코드는 2000만을 더함

### B-8. 홈런더비 — 예상 크기 **중**

- **무엇**: `mainMenu.ts:32` `isAvailable: false`. 기회 10구, 비거리 `d = |착지점 − (20000,1000,30000)| / 265`(한 타구 상한 160), 마투수 등장 단계(누적 800/1200/1600/2000), 단계 0 은 구질 1 고정·존 중심 목표, 단계 ≥1 은 마투수 구질 22 만, 콤보 보너스 G += 콤보×5, 이벤트 존 적중 +200 G, 보너스 게임(최대 콤보 수만큼 추가), `G = (누적/100) × [1,2,3,4,5][단계] + 보너스`(99999 상한), 최고 기록 저장 +0x5c, 결과 화면(176×213 창)
- **근거 문서**: `H-modes.md` H-2 · `R14-game-side-screens.md` 1~3절·5절 · `P7-leftovers.md` H1(이벤트 존 조건 = `pattern.flags & 2`) · `Q2-mission-rewards.md` 3-1(진입 = 결과 2 육성타자 · 4 명예타자)
- **필요한 데이터/표**: `stadium/event_zone.pzx`, `ui/combo.pzx`, `ui/result.pzx`

### B-9. 일반모드 준비 · 엔트리 · 경기진행 설정 — 예상 크기 **중**

- **무엇**: `mainMenu.ts:28` `isAvailable: false`.
  - 준비 흐름(메인 메뉴 상태 18~23): 유저 팀 → AI 팀 → 선공/후공 → 구장 → 마투수 → 마타자 → 경기정보, 빠른실행(랜덤 + `*` 로 변경)
  - **엔트리 편집기**(0x55864): 타순·수비·투수 탭, 선발 변경, 마선수 잠금, 교환 규칙. 웹 `battingOrder.ts` 는 나리 주인공 타순 승강일 뿐 엔트리 편집이 아니다
  - **경기진행 설정**: 찬스(값 0 = 사람 공격 중 2·3루 / 1 = 사람 수비 중 3루) · 이닝(전체/3/6) · 상세(타자조작·공격주자·투수조작·수비주자). 메인 메뉴 경기정보에서는 **모드 1(일반)만** 연다
  - 경기 중 사람 교체 `#`(대타·투수 교체) — 없으면 기록 "대타 홈런"(5)이 날 길이 없다
  - **보직 불일치 수비 −20% 는 시즌모드에만** 있다(일반·대전은 원본에도 없음 — 설명서와 다름)
- **근거 문서**: `J-modes-rules.md` 1-1·1-2·1-3·2-1·2-3 · `R4-lineup-screens.md` 1b·1c·2a/2b·2d·3a/3b·4절·5절 · `P7-leftovers.md` J1 · `CORRECTIONS.md` 2절(찬스 값 정정)
- **필요한 데이터/표**: 구장 그림 `hidden_board` / `hidden_fence` 0~2(웹 참조 0)

### B-10. 나리(나만의리그)에서 빠진 화면·상태 — 예상 크기 **중**

- **무엇**: 원본 장면 0x106 은 상태 100~145 로 돈다. 웹은 화면 유니온 10여 개로 줄어 아래가 없다.
  - **109 순위표 · 142 경기 준비 · 143 경기 전 엔트리 · 144 전환** — 원본은 경기 앞에 늘 "순위표 → 매치업 → (엔트리 편집) → 밀기" 세 화면이 낀다. 웹 `useCareerSession.ts:310-324`·`:262` 는 곧바로 `beginGame()`
  - **128 포스트시즌 대진 화면**과 우승 보상(정규시즌 우승 +10/+500만, 한국시리즈 +15/+25/+1000만 — `seasonFlow.ts`·`playerCareer.ts` 에서 못 찾음, 유력: 없음)
  - **115 연초 처리**(0x8a680): 연초 대사 + 올해의 목표 창 + `+0x1d0` 플래그 초기화
  - **106 [기록실]** — 웹은 순위표 창(`ManagementScreen.tsx:83`)을 띄우지만 원본은 두 갈래 팝업 → **124 선수 기록 목록**이고 순위표는 109 쪽이다
  - **119·129·120** 기본정보 / 칭호('*') / 능력치 상세('0') 키 경로
  - 구조 차이: 원본은 `[장면+0x24]`(뒤 상태) 한 칸으로 **114 이벤트 재생을 어느 상태에서나 끼워 넣고 제자리로 돌아온다**. 웹 `context` 는 4가지뿐이라 같은 일반성이 없다
- **근거 문서**: `R9-myleague-states.md` 각 상태 절 + "웹판 대조" 절 · `R13-season-leftovers.md` 2절
- **남은 미해결**: 새 시즌 처리 0x1b768 내부(U-22)

### B-11. 경기 장면 연출 상태 — 예상 크기 **중**

- **무엇**: 웹 `gameFlow.ts:170-181` 은 사람 타석 사이를 반 이닝 시뮬로 한 번에 넘긴다 → 아래 장면 단계가 전부 없다.
  - `0xc` 경기 시작 인트로(두 팀 VS + 라이벌전 띠, 54틱, 효과음 61, OK 건너뛰기) — 라이벌 짝 표는 `gameEvaluation.ts:98-114` 에 이미 맞게 있다(사기 ×2 에만 쓰임)
  - `0x18` 공수 교대 판(70틱 운동장 → 점수판·두 팀 판, 징글 13) + **반 이닝마다 이어하기 자동 저장**, 그리고 경기 끝 결과 판(점수 + 승·패·세 투수 3줄)
  - `0x13` 맞은 직후 짧은 연출 → 인플레이
  - `0x1e` 사구 뒤 **20% 확률 벤치 클리어링**(100틱)
  - `0x21` 자동진행 중계 화면(속도 3단계, 좌우 키, CLR 중단 질문 StrGAME[6], 배경음 33, "공격팀(PLAYER/COM)" 띠) · **자동진행 G 소모**(대전모드 6회까지)
  - `0x23` 강판 뒤 감독 대사 → 자동진행
- **근거 문서**: `R10-game-states.md` 3~7절·9절 · `I-controls.md` 4d · `R14-game-side-screens.md` 4절
- **남은 미해결**: U-57~U-59 (인트로 띠 좌표, img_text 글자, `0xae3e8` 잔가지)

### B-12. 기록달성 판정 중 빠진 것 — 예상 크기 **중**

- **무엇**: `gameRecords.ts:17-20` 이 "빠진 것" 으로 적은 목록 — **5 대타 홈런 · 6·7 백투백 · 8 도루 성공 · 24 도루 저지 · 26·27 병살/삼중살 · 32·33 3·4연속 파울 · 36 필살송구 아웃**
  - 지금 구조로 **바로 붙일 수 있는 것**: 6·7 백투백(`batterGameLog.ts` 가 동료 타석까지 돌림), 8 도루 성공(사용자 도루 성공에 붙이면 됨), 5 대타 홈런(대타 교체가 생기면 플래그 하나)
  - **수비 화면이 있어야 하는 것**: 24 · 26 · 27 · 36 (간이 엔진에는 도루 실패도, 한 타석 2아웃도 없어서 원본도 안 나온다)
  - 32·33 은 사람이 직접 치는 타석(0x51408)에서만
- **근거 문서**: `R8-record-triggers.md` 9절 · `R3-field-view.md` 5절 · `R15-ac758.md` 5절

### B-13. CPU 공격 AI (사람이 투구할 때) — 예상 크기 **중**

- **무엇**: 지금 사람이 투구하는 곳은 투수 미션뿐(`useMissionSession.ts:133` → `simulateBatter.ts`). 웹 식은 **원본에 없는 지어낸 값**이다.
  - 스윙 여부: `battingPattern.arr`(S·B·O·주자 열)로 치기/번트/지켜보기 → 존 밖이면 20px 띠 `(2000−1.5h)/10000`, 그 밖 `(250−h/4)/10000`. 존 판정은 0xcfb54/0xcfb7c 사각(33px 존, 20px 띠)
  - 실투면 선택 0 + 타이밍 d=0 강제 스윙(0x33cbc)
  - 타이밍: d ∈ {0,+1,−1}, K = 2900 + h/4
  - 번트 종류 rand(1,4), 마선수 제외
  - CPU 도루: 투구마다 1루 1.1% / 2루 0.5% / 1·2루 0.3%
  - CPU 대타: 경기당 1회, 2아웃↑·안타 ≤1·적시타 0, 주자별 10~50%
- **근거 문서**: `Q1-cpu-offense-ai.md` 1b·1c·2·3a·3b·4·5·6절
- **필요한 데이터/표**: `battingPattern.arr` 72행 (C-4)
- **원본 버그(그대로 옮김)**: CPU 도루 확률의 주력 열이 계산상 늘 1 → 주력과 무관하게 1.1%/0.5%/0.3% 고정 (0x520de)

### B-14. CPU 투수 교체 · 간이 엔진 도루 — 예상 크기 **중**

- **무엇**: 웹 `leagueDay.ts:49-50` 은 선발만 쓰고 `simulateHalfInning` 은 투수를 고정해 받으며 체력 소모도 없다(`quickAtBat` 의 stamina 는 고정값). 원본은 CPU 가 투수를 바꾼다(구간: 1~4회 / 5회 / 7회 / 6회·8회+, **8회에 마선수** — CORRECTIONS 정정), 새 투수 고르기 0xabfcc, 카운터 A(team+0x284)·B(team+0x280) = 투수별 실점·이닝 실점. 간이 엔진에는 **도루(성공만, 실패 없음)** 도 있다(표 0xd9064 = [1,5,10,15,20,30,40,50,60,80] — `steal.ts` 가 이미 가진 표)
- **근거 문서**: `E-defense-rules.md` E-5·E-6·3c · `P7-leftovers.md` E1·E2 · `CORRECTIONS.md` 2절
- **남은 미해결**: 정규시즌 CPU 끼리 경기의 선발 교체(U-16)

### B-15. 마선수 · 명예의 전당 · 스페셜 — 예상 크기 **중**

- **무엇**:
  - **마선수 잠금·오픈·레벨**: 웹은 전부 개방·배율 100% 고정. 원본은 해금 id 0~7, 기록달성 누계 문턱(삼진콤보x3 14 → 레오니, 풀카운트삼진 54 → 붕붕머신, 퍼펙트 3 → 발렌타인, 도루성공 54 → 어거지죠, 솔로홈런 54 → 로제, 사이클 2 → 크라이져, 만루홈런 54 → 킹타이거), G 오픈 가격(6000/9000/12000, **드래고나·킹타이거는 0 = G 로 못 연다**), 레벨 5단계(비용 3000·6000·9000·12000 G, 능력 배율 60·70·80·90·100%)
  - **명예의 전당**: 등록 **20000 G**, 칸 타자 최대 8 · 투수 최대 4(기본 타자 4 · 투수 2, 나머지는 현금 🌐), **삭제**(확인 팝업 기본 "아니오", 시즌 팀에 든 선수는 시즌 경기 진행 중이면 삭제 불가), 시즌·미션·홈런더비에서 사용
  - **에디트**: 팀 고르기(5×2, 팀 0~9) → 기본 명단 보기 → 이름 입력(최대 8바이트) → 선수 id 이름표(9바이트 × 투수 80 + 타자 120)에 저장. 에디트 초기화 = 이름표 1800바이트 0
  - **전부 수집 보상** 8칸: 리그 1위 1회 3000 · 5회 10000 · 10회 20000 · 미션 모두 30000 · 기록 모두 40000 · 스킬 모두 50000 · 닉네임 모두 60000 · 엔딩 모두 90000 G
  - **기록 통계**(StrMAINMENU 129~182), G포인트 사용 내역, 이어하기 5000 G, 스킬 슬롯 확장(최대 6/8/10, 5000/10000 G), 마이너스 스킬 해제 불가·최면요법
- **근거 문서**: `K-bursts-special.md` K-3·K-4 · `H-modes.md` H-5 · `Q2-mission-rewards.md` 4절·5-2 · `R11-special-leftovers.md` 1·3·4절 · `P6-screens.md` 2a·2d·2f · `R9-myleague-states.md` 141·145
- **남은 미해결**: U-24 마선수 레벨업 창(`XlsACE_LEVEL_UP`), U-28 해금 id 41 의 조건
- **🌐**: 명전 "선물", G 충전, 친구추천·선물받기, 데이터 백업/복구, 랭킹, 미션다운, 대전모드

### B-16. 상점 · 장비 · 구장 아이템 — 예상 크기 **중**

- **무엇**: A-3 의 가드 6개 외에, 투수·시즌 GP 아이템이 통째로 없다(투수 십전대보탕 = 스태미나 100%, 시즌 7종: 또또상품권 300 · 영지버섯 300 · 종합건강진단 500 · 십전대보탕 500 · 이글아이 1000 · 협회허가증 2000 · 구내매점 2000). 구내매점은 `rec[0x55] = 45` 로 시작해 시즌 경기마다 −1, 0 이 되면 만료 알림(StrUSER_EVT[113]). 히든 장비(오토봇 배트 등) 오픈 비트 자체가 없다
- **근거 문서**: `R12-shop-guards.md` 4절·5절·요약 · `K-bursts-special.md` K-6 · `R7-number-leftovers.md` 3절 · `R13-season-leftovers.md` 10절·11절 · `P4-season-flow.md` 5절
- **주의**: 구장 아이템 구매 처리(U-04)와 "필요 인기도" 표 `0xd44c4`(유력)는 아직 못 풀었다

### B-17. 화면 배치를 원본대로 — 예상 크기 **상** (화면 수가 많다)

- **무엇**: 아래 화면들이 전부 `PixelScreen + MenuList` 같은 웹 자체 배치다. 원본 좌표·그림 번호는 문서에 다 있다.
  | 웹 파일 | 원본 배치 |
  |---|---|
  | `pages/mission-select/ui/MissionSelectScreen.tsx:53-76` | 192×212 판 + **5×3 미션 격자**(28px, 중심 (120,79)) + slt_frame 프레임 1 · "MISSION" 탭 · 보상 "%dG" · 성공 "%d회" · 머리띠 제목 12/13 |
  | `pages/record/ui/RecordScreen.tsx:18-67` | 기록연감 **5탭**(기록·진행·스킬·닉네임·통계) 192 판, 탭 막대 slt_frame 4~8, 4열 41×25 칸 격자 + ▲▼ |
  | `pages/special/ui/SpecialScreen.tsx:33-43` | 반원 바퀴 옆 **main_ui 프레임 15~21·28 의 8칸 세로 목록 + 흰 설명 판** |
  | `pages/shop/ui/ShopScreen.tsx:23-107`, `ItemShopScreen.tsx:36` | mode_ui 프레임 33 박스 배치, 탭 2개(img_text 278·105), 아이템 **5×2 격자 33px**(mode_ui 34), 이름 딱지 #12307E |
  | `pages/season-end/ui/SeasonEndScreen.tsx:15-43` | 포스트시즌 대진표 = mode_ui 프레임 53 계단 4칸 + 선분 54~57(#08044A, 이긴 길 빨강) + "N위" 딱지 |
  | `pages/ending/ui/EndingScreen.tsx:62-71` | mode_ui 프레임 10 띠 창(0,65,240,72) + mode_back + 걸어오는 캐릭터 + ending.pzx 세피아 + **원형(아이리스) 전환** + 제작진 흐름 |
  | `pages/settings/ui/SettingsScreen.tsx:26-72` | 192 판, **6줄 25px**(사운드·속도·진동 값 줄 + 상세 설정·모드 초기화·게임 데이터 관리), 소리 막대 98+k·속도 꺾쇠 102+k·진동 OFF/ON 노랑 사각 |
  | `pages/game-result/ui/GameResultScreen.tsx:50-57` | 결과 판 176×182 (대전 승리면 202) |
  | `shared/ui/Panel`·`PixelScreen` | 공용 창 0x55e60 판 모양 + 공용 페이지 0x593c8 (경기 결과·환경설정·기록 화면이 모두 이 판) |
  | 메인 메뉴 `MainMenuScreen.tsx:67-71` | 화면 아래 **반원 바퀴**(중심·원·각도 확정, 칸별 main_ui 그림은 경우 번호 0·1·2). **2026-09-13 사용자 요청으로 셀렉트박스로 바꾼 것** → 되돌릴지는 결정 사항 |
- **근거 문서**: `P6-screens.md` 1~6절 · `F-ui-layout.md` F-1·F-5·F-8·6-2·6-3·6-6 · `R4-lineup-screens.md` 1b·4절 · `R14-game-side-screens.md` 1~3절 · `R6-sprite-leftovers.md` 2절
- **남은 미해결**: U-50 목록 격자 위젯 내부(한 번 풀면 U-51·U-55·U-60 이 같이 닫힌다), U-53·U-58(그림을 렌더해 눈으로 읽기)

### B-18. 연출 · 소리 · 글꼴 · 파티클 — 예상 크기 **상**

- **소리**: 웹에 소리 코드가 **전혀 없다**. 원본 `sound/*.mmf` 52개(야마하 SMAF). 재생 시점 번호표는 `L` 8절·`R2` 8절에 있다(효과음 5/6/59 타구 강·보통·약, 7, 9, 8/27 헛스윙/필살, 12/28 투구/마구, 13 공수 교대, 14/15/26 투수 등판, 10 득점(유력), 17 Safe, 25 Foul, 53 공 놓침, 61 타석 시작, 0x1f 신기록, 0x20 실패, 0x24 성공, 0x25 무효). **진동**도 없다(환경설정 +0x3b, 100/200/300·500ms)
- **경기 연출**: `deadly_effect`(수비 포구 번쩍임 + 줌 펀치 → 큰 OUT) · `game_effect`(강속구 불꽃 >151km/h, HOMERUN 글자, 타격 불꽃 2·3 + ptc 006/007, MAX 투구 링) · `player_effect`(투수 지친 눈 체력 ≤34%/≤19%, "!", 바람 줄, 수비 먼지·고리) · 삼진 양끝 파티클 ptc 008 · 마선수 등장 컷인(0x473f0)
- **이펙트 그림 16폴더 — 6차(R2 12~15절)에서 정체가 다 밝혀졌다. 남은 것은 아래 셋뿐이다**
  - `effect_pitcher`(+0x1044) — 투수 앵커, 애니 0 8칸(마지막 칸 제외 = 7틱). **`게임+0xfc8` 이 22 로 바뀌는 틱만 찾으면 바로 붙는다** (R2 14-0)
  - 마선수 마구 이펙트 5종(+0x1038, `0x46fa8`) — 투수 앵커. leony 는 투구 단계표 `0xd00dc` 까지 풀렸고, psyker·dragona 는 그림 1장을 `(단계−7)` 배율로 키운다. bbmachine·ballantine 갈래(`0x47250`)의 인자와 호출지가 남았다 (R2 14-2)
  - `sky_effect_light`·`sky_effect_light1` — 밤 경기 하늘 조명. 팔레트 줄까지 확정 (R6 6절)
  - ✅ **끝난 것**: 마구 1·4(폼 묶음 0) 의 공 이펙트 `effect_fire`/`effect_shinning` → 2026-09-25 이식 (`src/widgets/batting-stage/lib/magicBallEffect.ts`, R2 14-1)
  - ⛔ **만들지 말 것**: `effect_frame`·`effect_power`·`effect_tornado`·`effect_meteor`·`medica_effect` — 원본에 그리는 코드가 없다 (R2 15절)
- **아직 안 옮긴 작은 차이 — 마구 1 도 불꽃 공이 된다**: `0x3b55a` 가 **마구 번호 1** 에서 공 경로 번호 8 부터 `게임+0x1080 = 1`(ball.pzx 불꽃 묶음)로 바꾼다. 웹 `src/entities/pitcher-career/model/magicPitch.ts` 의 `MAGIC_BALL_KIND_BY_NUMBER = [0,0,0,0,0,0,0,0,2,1]` 에는 8(ballantine)→2 · 9(dragona)→1 만 있다. **투구를 고를 때가 아니라 그릴 때 프레임 8부터** 바뀌는 값이라 `magicBallKindOf` 가 아니라 `trajectory.ts:ballFrameIndexAt` 쪽에서 덮어야 맞다
- **글꼴**: 원본 비트맵 한글 글꼴 `synGak9_11.ft2`(9×11 조합형 벌 글꼴) · `synGulimAsc5_11.ft2`(5×11 영문 94자). 웹은 Galmuri 웹 글꼴
- **파티클**: `ptc/001~026.ptc`(51바이트 설정) + `ptc/ptcimg.pzx`. 웹은 없다 (`public/sprites/ptcimg/frames` 는 **합성된 그림이라 못 쓴다** — 파트 그림 `0NN.png` 를 써야 한다)
- **그 밖**: `fence_season.pzf` 20프레임(시즌 구장 성장), 장비 외형 스프라이트 57폴더(`item_bat_*` / `item_pit_*`, 장착 시 겉모습 — 웹은 `batterLayers.ts:6,14` 가 다리 고정), 효과 0x10(확대/축소)·0x11(뒤집기)
- **근거 문서**: `L-sound-effects.md` 1-A~1-E2·2-A·2-B·3절·5-A~5-D · `R2-game-effects.md` 2~11절 **및 12~15절(6차)** · `R5-font-particles.md` 1~10절 · `R6-sprite-leftovers.md` 1·3b·3c·**6**절
- **이식 불필요(확정)**: `ui/combo.pzx` · 필살타법/타자 마선수 이펙트 그림 5폴더 — **원본도 그리지 않는다**

### B-19. 팀·피부 팔레트 — 예상 크기 **중**

- **무엇**: 웹 스프라이트는 PZX 기본 팔레트로만 뽑혀 타자 몸통·헬멧·수비수는 "팀 2 · 황인", 투수 몸통은 "팀 0 · 황인" 고정이다. 원본은 `.mpl` 로 **피부 × 15 + 팀** 팔레트를 덮어쓴다(0xc8c7c 가 이미지 팔레트를 앞에서부터 통째로 덮음)
- **근거 문서**: `C-create-palette.md` C-1·C-2·C-3 · `L-sound-effects.md` 3절(장비 등급별 색) · `CORRECTIONS.md` 2절(V2 정정)
- **구현 방법 둘 중 하나**: ① 빌드 때 mpl 적용 스크립트로 변형 PNG 생성 ② 인덱스 색 PNG + mpl JSON 으로 런타임 팔레트 교체(용량이 작다)

### B-20. 환경설정 · 모드 초기화 — 예상 크기 **하**

- **무엇**: 사운드 볼륨(0~4, ×25, 기본 2), 진동(기본 ON), 주루(자동)·송구(수동)·전광판(ON) 수동/자동, 터치, 손잡이 방향(좌/우), **시즌 초기화·에디트 초기화**, 시즌 경기 진행 중 초기화 막기(StrMAINMENU 210·211·212)
- **근거 문서**: `K-bursts-special.md` K-5·5-2·5-3 · `P6-screens.md` 5절 · `R11-special-leftovers.md` 3-1

---

## C. 데이터로 뽑아야 하는 것

생성기 `tools/generate_game_data.py`(또는 `tools/decode_pzx.py` · `tools/decode_events.py`)를 고쳐 새로 뽑을 표·에셋. 원본 파일은 `base/게임빌2010프로야구/0002C663.jar` 안에 있고, 이미 푼 것은 `base/work/jar/` · `base/extracted/` 에 있다.

| # | 무엇 | 원본 파일 / 주소 | 지금 상태 | 근거 문서 |
|---|---|---|---|---|
| C-1 | **돌발미션 3표 16바이트 원시값** | `data/XlsBATTER_BURST`(40행) · `XlsPITCHER_BURST`(44행) · `XlsSEASON_BURST`(56행), 행 16바이트(u8×16) | `base/extracted/*.json` 의 `names` 는 **행 바이트를 잘못 읽은 것** → 생성기에서 16바이트 원시값으로 다시 뽑을 것 | K-bursts-special.md K-1 · 4절 1-7 |
| C-2 | **돌발미션 대사 표** | `*_BURST_TEXT`, 행 520 = (u8 화자, u8 표정, 문자열 128) × 4줄 — 0 제안 · 1 성공 · 2 실패 · 3 무효 | 미착수 | K-bursts-special.md K-1 |
| C-3 | **경기 중 기록달성 G 표** | `0xd8158`(40칸) — 3루타 10 · 솔로 8 · 2점 10 · 3점 12 · 만루 15 · 대타 10 · 백투백 20 · 백투백투백 40 · 도루 2 · 연타x3 5 · x4 15 · x5 30 · 2홈런 5 · 3홈런 20 · 4홈런 40 · 사이클 100 · 삼구삼진 2 · 풀카운트삼진 3 · 콤보x3 5 · x6 20 · x9 40 · 10K 10 · 15K 20 · 20K 40 · 도루저지 3 · 삼구삼자범퇴 5 · 병살 2 · 삼중살 100 · 완투 10 · 완봉 20 · 노히트 100 · 퍼펙트 120 · 3연속파울 3 · 4연속 5 · 2볼넷 5 · 3볼넷 8 · 필살송구 3 · 10점차 10 · 20점차 20 · 30점차 40 | 최근 커밋 `23aaed1` 이 이 표를 쓰는 것으로 보임(문서에서 확인 안 함) | K-bursts-special.md K-4 · 4-5 |
| C-4 | **CPU 타자 행동 확률표** | `data/battingPattern.arr` 72행 (S·B·O·주자 열 → 치기/번트/지켜보기) | `/usr/bin/grep -rl battingPattern src tools` = **0건**. CPU 타자는 웹의 지어낸 확률표를 쓴다 | L-sound-effects.md 4-C · Q1-cpu-offense-ai.md 1b·6절 |
| C-5 | **시즌 이벤트 s_event** | `s_event.zt1` 30건(2332바이트, 형식은 r_event 와 같아 `tools/decode_events.py` 로 그대로 읽힘) | `base/extracted/` 에 `s_event_txt.json` 만 있고 `s_event.json` 은 생성 안 됨 | P4-season-flow.md 2a |
| C-6 | **마선수 오픈 가격·기본 능력치·힌트** | `XlsACE_LEVEL_UP` u16[5] (이름과 달리 레벨업 표가 아니다). 레벨업 비용 표 `0xd1724` × 1000 = 3000·6000·9000·12000 G, 레벨 배율 60·70·80·90·100% | `acePlayers.ts` 에 능력치만 있고 잠금·오픈·레벨 없음. 웹 참조 0 | K-bursts-special.md K-3 · 3-3 |
| C-7 | **마선수 기술 이름 범위 고치기** | 마타자 StrCOMMON[0x5f+n] = 100~104 · 마투수 [0x5a+n] = 95~99 | 생성기의 `COMMON_*_BURST_RANGE` 가 **일반 기술 이름 쪽을 가리키고 있다**(A-3 참조) | H2-special-skills.md 6절 · 4-1 |
| C-8 | **팔레트(.mpl)** | `bat/batter_balancer`·`batter_sluger`(0x30, 45×82색) · `bat/batter_helmet`(15×26) · `pitcher`(45×41) · `defender`(15×48) · `event_char_0`(3×239) · `ui/game_ui`·`ui/mode_ui`(**0x40 이미지별 변형형**) · `ui/img_text`(5×3) · `ui/mode_icon`(1×50) · mode_back·stadium/*·item/* | 스프라이트가 기본 팔레트로만 뽑혀 있다. mpl 파서는 문서에 형식이 다 있음(모든 파일 파싱 성공) | C-create-palette.md C-1·C-2 |
| C-9 | **PZX 파트 효과 5~0x64** | `decode_pzx.py:_part_style` 이 무시 중. 효과 `0x05+n` = 붙은 0x40 mpl 의 n번째 변형 팔레트(0xc8bb4) | mode_ui(이미지 0·1·31)·game_ui(8·9) 의 선택/비활성 색이 안 나옴. `generate_management_sprites.py` 가 따로 만든 주황과 같은 색인지 미대조 | C-create-palette.md C-3 |
| C-10 | **PZX 프레임 박스** | `decode_pzx.py` 가 버리는 프레임 박스 `i16 x,y,w,h` | 화면 배치(B-17)의 근거가 이 박스다 → **디코더가 박스도 뽑게 할 것** | C-create-palette.md C-6 주 |
| C-11 | **비트맵 글꼴(ft2)** | `synGak9_11.ft2`(w9 h11, 글자당 13바이트, **483조각** + 끝 67바이트 = 획수 표 3개) · `synGulimAsc5_11.ft2`(w5 h11, 7바이트, 94자 = 0x21~0x7E). 비트는 행 우선·MSB 먼저 | 웹은 Galmuri 웹 글꼴. **한글은 ① 합성 루틴(0x9bb28)을 옮기거나 ② 2350자를 한 번 그려 PNG 시트로 굽는 길** | R5-font-particles.md 2·4·6·10절 · L-sound-effects.md 5-C · CORRECTIONS.md 2절(488→483 정정) |
| C-12 | **파티클(ptc)** | `ptc/001~026.ptc` 51바이트 설정 + `ptc/ptcimg.pzx` | 웹 참조 0. `public/sprites/ptcimg/frames` 는 **파트를 겹쳐 합성한 그림이라 못 쓴다** → 파트 그림 `0NN.png` + 파트 오프셋 필요. 51바이트 배치는 확정(A값·mode 해석만 유력) | R5-font-particles.md 7~9절 · L-sound-effects.md 5-A · CORRECTIONS.md 2절 |
| C-13 | **사운드 52개 변환** | `sound/*.mmf`(야마하 SMAF). **ffmpeg 은 거부한다**(MTR 미지원). **WildMIDI master(0.5.1 개발판, `-DWANT_MAFM=ON`)** 로 52개 전부 WAV 렌더 성공 | 웹에 소리 코드가 전혀 없다. **권장 경로**: 빌드 때 한 번 렌더 → ogg 로 줄여 `public/` 에 두고 WebAudio(배경음 loop, 효과음 1회). MIDI 경로는 권하지 않음 | L-sound-effects.md 1-C·1-D |
| C-14 | **시즌 구장 펜스** | `stadium/fence.pzd` + `fence_season.pzf`(20프레임 = 5개씩 4묶음: 바탕 높이 67→99→108→116 + 좌석 줄 4장). `decode_pzx.py:382 decode_split_pair` 가 이미 푼다 | `public/sprites` 에 폴더 자체가 없다 | L-sound-effects.md 5-D · R6-sprite-leftovers.md 1절 |
| C-15 | **장비 외형 스프라이트** | `item_bat_*` / `item_pit_*` 57폴더 + 같은 PZX 를 mpl 다른 줄로 칠한 **등급별 색** | 웹은 다리 `item_bat_leg_0` 고정, 손 아이템 없으면 bat/batter_batter | L-sound-effects.md 3절 |
| C-16 | **마선수 수비 스프라이트** | `ace/defender_<마선수>` 10폴더 (medica·psyker·leony·bbmachine·ballantine·dragona·kao·roze·death·tiger), 이름 표 `0xd3f10`(20바이트 간격) | 웹 src 참조 0. 수비 화면(B-1)과 함께 | Q0-coverage-audit.md 3절 · R3-field-view.md 7절 |
| C-17 | **수비 화면 에셋** | `stadium/defense.pzx`(310×500) · `hidden_fence_0~2` · `hidden_board_0~2` · `stadium/event_zone` | 웹 참조 0 | INVENTORY.md 1·2 · J-modes-rules.md 1-3 · L-sound-effects.md 5-D |
| C-18 | **선수 수비 위치** | XlsBATTER_DATA 행 바이트 28(레코드 +0x1c) = 1 지명 · 2 포수 · 3 1루 · 4 2루 · 5 3루 · 6 유격 · **7 = 1루 쪽 외야 · 8 = 3루 쪽 외야** · 9 중견 | `roster.json` 에 수비 위치가 없다(능력치 4개만). `CreatePlayerScreen.tsx:15` 는 `['내야','외야']` 둘뿐 | R3-field-view.md 2-2·6절 |
| C-19 | **미션 조건코드의 뜻** | 미션 레코드 바이트 13 = **투수 미션 조준점 흔들림 세기**(0x39c5c). 바이트 4 = 아웃(bit0-1)·볼(bit2-3)·스트라이크(bit4-5) 는 생성기와 **같다** | `generate_game_data.py:392-394` 주석 "뜻은 미해독" 을 고치고, 값을 투수 미션 조준 입력에 넣을 것 | E-defense-rules.md E-7 · 4a · 4b |
| C-20 | **경기 밸런스 표** | `d_level.dat` 488바이트 = 경기 밸런스 설정표(타격 cfg+0x10/0x12, 제구 등급 배율 0x1e0, 수비 이동 cfg+0x28, 송구 cfg+0x1a/+0x2a, 에러 cfg+0x2c). **난이도 옵션이 아니다** — 파일 하나를 모든 모드가 쓴다 | 지금은 값 일부를 손으로 옮겨 씀(`swingTiming.ts:5,12` · `swingResult.ts:12,69` · `quickAtBat.ts:26` · `data/balance.json`). **생성기가 파일을 직접 읽게 할 것** | L-sound-effects.md 4-D |
| C-21 | **마구 레코드** | pitch.zt1 구질 22 블록 17레코드. 고르기 = `3(m−1) + f/2`(육성·일반 1~4) · `m + 7`(마투수 5~9) | 데이터는 이미 `pitchRecords.ts` PITCH_RECORDS[21] 에 있다 — **고르는 식만 넣으면 된다** | H2-special-skills.md 3-5 |

---

## D. 조심할 것

### D-1. 앞 문서를 믿지 말고 CORRECTIONS.md 를 함께 볼 것

해독은 1차(A~L) → 2차(P·Q) → 3차(R) 순서였고 **뒤 문서가 앞 문서를 고친 일이 잦다**. 본문에 *(정정)* 을 넣었지만 빠진 곳이 있을 수 있다. 특히 자주 틀렸던 종류:

- **0-기준 이닝을 회로 잘못 옮긴 것** — E 의 CPU 투수 교체 구간, 연장 보정 둘 다 여기서 한 칸씩 어긋났다
- **점프표를 한 칸 밀려 읽은 것** — F 의 메시지 상자 창 종류(1 알림 · **2·4** 예/아니오 · 3 버튼 없음)
- **같은 칸을 모드마다 다르게 해석한 것** — `S+0x12c` 는 포스트시즌이 아니라 **국가대항전 진행 중** 플래그, `career+0x4a` 는 연승이 아니라 **이번 경기 인기도 변화**, `SR+0x7a` 는 **정규시즌 1위 횟수**
- **"원본 버그" 로 적었다가 버그가 아니었던 것 3건** — 이벤트 490 완치(실제로는 질병에 걸린다), 돌발미션 "안타" 단타 실패(단타도 성공), 필살타법 레벨 4 표 밖 읽기(창이 막는다)
- **모드 번호** — 미션 모드 **5 = 투수 · 6 = 타자**(H 가 거꾸로 적었다)
- **아이템 창 종류** — **4 가 구장 아이템**, 3 은 장비 상점
- **장비 해금 표** — **A=1 이 타자 쪽**, 가격표 뒤 44칸도 타자(= 앞 44칸이 투수)

### D-2. "유력" 에 머문 위험한 것 — 특히 **부재 증명 4건**

"찾아봤는데 없더라" 로 낸 결론이라, 틀리면 규칙이 **정반대**가 된다. 웹에 옮기기 전에 다시 확인할 것.

| 부재 증명 | 맞으면 | 틀리면 | 근거 |
|---|---|---|---|
| **공 객체 `+0x10`(마구 번호)을 되돌리는 코드가 없다** | 첫 마구 뒤 **모든 투구에 마구 보정이 남는다** | 마구는 한 구만 특별하다 | H2 3-4 · DECISIONS |
| **투수 평가의 "실점"(`R+0x128`)을 채우는 코드가 없다** | 완투승이 늘 완봉으로 세어지고 실점 감점이 안 걸린다 | 투수편 평가가 전부 달라진다 | P1 요약 |
| **일반·대전모드에 보직 불일치 벌점이 없다** | 일반모드는 벌점 없음(시즌만 −20%) | 설명서대로 수비가 20% 약해진다 | P7 J1 · INVENTORY 2 |
| **`combo.pzx` 를 그리는 코드가 아예 없다** | 삼진 콤보 표시는 **빠진 기능**(이식 불필요) | 그려야 한다 | R2 (4)·5절 |

그 밖에 유력에 머문 것 (`UNRESOLVED.md` ③ 절):

- **구원 투수를 사람에게 넘기는 고리** — 8회 교체까지는 확정, 조작권 이양 한 줄이 유력. 틀리면 투수편 구원 등판이 사람 손에 안 온다
- **마투수 난입 순서 = `XlsACE_PIT_DATA` 행 순서** — "행 순서 = 메모리 순서" 가정 (U-25)
- **올해의 목표 창이 표 `0xd7f9e` 를 읽는다** — 읽는 줄을 못 봤다 (U-23). 목표 수치가 다른 표에서 올 수 있다
- **장비 "필요 인기도" 표 `0xd44c4`** — 읽는 곳이 설명 줄 한 곳뿐. 가격/인기도 조건이 뒤바뀔 수 있다 (U-04 와 같은 뿌리)
- **`skin+0xb0/+0xa4/+0xb4` = team_logo / game_ui / stadium_symbol** — 그림 크기·번호로 맞춘 추정
- **투수 쪽 단일 PZX `+0x3c` 의 좌/우 뜻** — 타자 쪽(0 우타 / 1 좌타)만 확정. 틀리면 투수 스프라이트가 좌우 반대
- **미션 머리띠 `[this+0x88]==6` → 타자편** — 모드 번호(5 투수 / 6 타자)와 거꾸로 보인다
- **`0x5eae1` 반환 1~4** — R11 은 미해결로 적었지만 **Q2 가 이미 확정**(1 육성투수 · 2 육성타자 · 3 명예투수 · 4 명예타자) → **Q2 를 따를 것**

### D-3. 필요도 "상" 이던 6건 — **5건 해결, 1건은 🌐**

| # | 무엇 | 결과 |
|---|---|---|
| ~~U-01~~ | 페어/파울 판정의 문턱값 | **해결 (S2)**: 페어 = −135 ≤ 각 ≤ −45 (양끝 포함). 웹 `battedBallOutcome.ts:22` 와 같은 식이다 |
| ~~U-02~~ | 2아웃 득점 보류 처리 | **해결 (S2)**: 보류는 `state[0]` 에 쌓이고, 메시지 `0x13` 은 득점 +1 이다 |
| ~~U-03~~ | 승·패·세이브 투수 판정 | **해결 (S1)** |
| ~~U-04~~ | 구장 아이템 구매 처리·가격 출처 | **해결 (S3)**: 가격은 `0xcbc64`, `0xd44c4` 는 필요 인기도였다 |
| U-05 | 드래고나(해금 id 3) 오픈 조건 | 🌐 **로컬로 여는 길이 없다(확정)** — 아래 참조 |
| ~~U-06~~ | 평판 평가 기록 16칸의 이름 | **해결 (S4)**: 14칸 확정·1칸 유력·1칸 미사용 |

### D-4. 검증이 중간에 멈췄다

교차 검증 V1~V5 는 **188개 항목 중 178개를 확인하고 사용자 요청으로 중단**했다(`_raw/verify/`). 2차(P·Q) 결과 검증은 **하지 않았다**. 확인하지 않은 항목에도 D-1 과 비슷한 실수가 남아 있을 수 있다.

### D-5. 🌐 = 구현 불가

원본 서버가 필요해 오프라인으로는 원리상 못 만든다. **만들어 넣으면 "원본 근거 없음" 으로 표기할 것.**

- 대전모드 상대 데이터·보상·등급·랭킹 (랭킹 서버 `218.145.70.37:32206`) — 로컬 대체(CPU 외인구단 대전)만 가능
- G포인트 충전·선물·친구추천·선물받기·WAP, 데이터 백업/복구, 미션 다운로드, 명예의 전당 "선물", 명전 현금 슬롯 구매
- **드래고나(해금 id 3)**: 원본의 유일한 경로가 온라인 선물함이라, **"원본대로" = 잠긴 채로 둔다**(사용자 결정 2026-09-20 ④). 대체 조건을 새로 만들지 않는다
- 대전모드 승리 추가 보상 칸(`app+0x112`/`+0x138`), 대전 승패 바이트 조합식

### D-6. 죽은 코드로 닫은 것 (만들지 말 것)

- `ui/combo.pzx` — 그리는 코드가 없다
- **필살타법·타자 마선수 이펙트 그림** `effect_frame`·`effect_power`·`effect_tornado`·`effect_meteor`·`medica_effect` — `경기+0x1034`·`+0x103c` 에 싣기만 하고 그리는 코드가 없다 (R2 15절, 부재 증명 방법도 거기 있다)
- 경기 상태 `0x20` — 경기 끝(`0x19`)의 쓰이지 않는 쌍둥이 번호. 들어오는 길이 **없다**
- 야수 동작 `0x78` — "동작 5 의 세 번째 포즈로 정지" 인 상수, 따로 구현 불필요
- 게이지 모드의 체력 0% 감점, USER_EVT 97~99(연속 4안타 강판)
- 시즌 상태 `0xf4`(들어갈 수 있는데 나가는 길이 없다), `0x13460` 창 종류 0·5

---

## E. 추천 순서

### 1단계 — 틀린 것부터 고친다 (작고 확정이 많다)

A 절의 **상** 항목을 그대로 훑는다. 코드가 이미 있어서 값·조건만 바꾸면 되는 것들이다.

1. 경기 규칙: 완투 기록 조건(`gameFlow.ts:271-277`) · 연장 한 이닝(`quickAtBat.ts:41,81`) · 희생플라이(`baseState.ts:99-104`) · 땅볼 난수 순서 · 기록 게이트
2. 나리 수치: 평판 구간 보정 + 칸 7개 · 인기도 식 네 군데 · 연봉 등급(`seasonEvents.ts:29`) · 목표표(`seasonFlow.ts:22`) · 능력치 감소(`condition.ts:41-52`) · GP 아이템 한계(`gpItems.ts:55-64`) · 외출 가드(`outing.ts:23-36`)
3. 원본 버그 되돌리기(**사용자 결정**): CPU 리그 경기 승패 뒤집기 + 홈/원정 배정(`leagueDay.ts`) · 순위 동률 색인 버그(`league.ts:66-73`) · 투구 난이도 hard(`selectPitch.ts:49`) · GP 아이템 알림 6·8
4. 이벤트·스킬: 날짜 창과 커서(`storyScene.ts`) · 스킬 16·17 링버퍼(`swingSkills.ts:42-44`) · 연차 보정 · `+0x1d0` 플래그
5. 상점 가드 6개(`shopSelection.ts:110`) · 컬렉터 투수 id(`equipment.ts:141`) · 필살타법 창(`SpecialSwingWindow.tsx:66,77`) · 순위표 4줄(`standingsLayout.ts:34-36`)
6. 덤: "추정" 주석 정리(A-2 마지막 줄 · A-3 의 `stageScenery.ts` · `frameRate.ts`)

### 2단계 — 원본 데이터로 바꾼다 (C 절, 코드 변화가 작고 효과가 크다)

1. **팔레트(C-8·C-9·C-10)** — 이것부터 하면 3~4단계 화면 작업이 전부 편해진다
2. **글꼴(C-11)** · **사운드(C-13)** — 둘 다 빌드 도구 한 번으로 끝난다
3. **파티클(C-12)** · **fence_season(C-14)** · **장비 외형(C-15)**
4. 표: `battingPattern.arr`(C-4) · `d_level.dat` 직독(C-20) · 마구 레코드 고르기(C-21) · 미션 조건코드(C-19) · 마선수 이름 범위(C-7)
5. 공 궤적은 **건드리지 않는다** — `pitch.zt1` 원본 데이터를 그대로 쓰기로 이미 결정했다(D-pitch-trajectory.md)

### 3단계 — 큰 빈 기능 (한 덩어리씩, 병렬로 돌리지 말 것)

의존 순서가 있다. **수비 화면이 먼저** 들어가야 그 뒤 것들이 붙는다.

1. **B-1 수비 화면과 사용자 조작** — 이게 들어가야 B-12 의 기록 24·26·27·36, 그라운드 홈런, 에러, 중계·협살이 붙는다. (붙이기 전에 U-01·U-02 를 먼저 푸는 것이 좋다)
2. **B-2 투수편** + **B-3 필살타법·마구** — 투수편이 서면 칭호 투수 16개·투수 GP 아이템·구질 훈련이 함께 열린다. (U-03 승·패·세이브 판정 선행)
3. **B-4 돌발미션**(C-1·C-2 선행) · **B-13 CPU 공격 AI**(C-4 선행) · **B-14 CPU 투수 교체·간이 엔진 도루**
4. **B-6 시즌모드** — 가장 크다. 1a 상태 기계 → 관리 메뉴 → 구단관리 → s_event → 포스트시즌 순. (U-04·U-06 선행)
5. **B-7 국가대항전** · **B-8 홈런더비** · **B-9 일반모드 준비·엔트리** · **B-5 칭호** · **B-15 마선수·명전·스페셜** · **B-16 상점 나머지** · **B-20 환경설정**

### 4단계 — 화면을 원본 배치로 (B-17, B-10)

2단계의 팔레트·글꼴이 끝난 뒤가 싸다. `decode_pzx` 가 프레임 박스를 뽑게 해 두면(C-10) 좌표를 손으로 옮기지 않아도 된다.

1. 공용 부품부터: 메시지 상자 · 공용 창 0x55e60 · 공용 페이지 0x593c8 · 목록 격자 위젯(U-50 을 풀면 여러 화면이 같이 닫힌다)
2. 그 위에 미션 선택 · 기록연감 · 스페셜 · 상점 · 대진표 · 엔딩 · 환경설정 · 경기 결과
3. B-10 의 나리 빠진 화면(109·142·143·144·128·115·124)과 상태 전이 구조

### 5단계 — 연출 (B-18, B-11)

규칙에 영향이 없으니 맨 뒤다.

1. **B-11 경기 장면 상태**(인트로 · 공수 교대 판 · 타격 직후 · 벤치 클리어링 · 자동진행 중계 · 경기 끝 결과 판)
2. **B-18 연출**: game_effect · player_effect · deadly_effect · 마선수 컷인 · 전광판 흐름 · 삼진 파티클 · 소리 재생 시점 · 진동

> 그 다음에도 남는다면 `UNRESOLVED.md` ④ 절의 "다음에 해독한다면 이 순서" 를 그대로 쓰면 된다.


---

## F. 5차 해독(S1~S10)으로 새로 닫힌 것

앞 문서에 "남은 것 / 미해결" 로 남아 있던 것 중 **U 번호 21개**가 닫혔다. 아래는 **이식할 때 직접 쓰는 결론만** 추린 것이고, 식·주소·근거는 각 문서에 있다.

### F-1. 경기 규칙 — 지금 웹과 직접 맞대 볼 것

| 무엇 | 원본 | 문서 |
|---|---|---|
| **페어/파울 문턱** | 각도 하나만 본다. 페어 = **−135 ≤ a ≤ −45**(양끝 포함). 좌표·거리·폴 접촉은 안 본다 | S2 |
| 넓은 판정(수비 AI용) | `−145 ≤ a ≤ −35` (페어 쐐기를 양쪽 10도씩 넓힌 것) | S2 |
| 담장·필살 판정 | 양끝 **제외** — 선 위는 폴 | S2 |
| **2스트라이크 번트 파울 = 아웃** | 파울 판정 결과가 7(파울)이 아니라 11(아웃)로 바뀐다 | S2 |
| **2아웃 득점 보류** | 2아웃 + 땅에 닿은 플레이 + 타자주자가 살아 달리는 중이 아니면 득점을 `state[0]` 에 쌓아 두고, 플레이 끝에 3아웃이 아니면 그때 올린다. 3아웃이면 다음 플레이 초기화가 지워 **무효** | S2 |
| **승리 투수** | **6회(0-기준 5) 이후** 득점 시점에만 정해진다 → 5회까지만 점수가 나면 승리 투수가 빈다(원본 버그) | S1 |
| 패전 투수 | 이닝 조건 없음 | S1 |
| **세이브** | 종류 코드 1/3/9 를 리드와 남은 아웃으로 정하지만, **코드를 0 으로 되돌리는 곳이 없어 한 번도 기록되지 않는다**(원본 버그) | S1 |
| 승계 주자 실점 | `runner+0x30` 에 적힌 투수에게 귀속(진루 때 복사) | S1 |
| 야수선택과 퍼펙트 | 출루 허용 표시가 **주자 목록의 마지막 원소만** 봐서, 타자주자가 살고 앞 주자가 죽으면 퍼펙트가 안 깨진다(원본 버그) | S5 |
| **협살** | 뒤 주자부터, "다음 루까지 35% 넘게 남은" 주자를 고른다. **사람이 수비하면 절대 안 일어난다**(조건에 "수비 팀이 CPU" 가 있다) | S8 |
| **견제** | 루 커버 야수가 "루 번호 + 1" 로 고정(2루 견제도 늘 3번 야수). **주자 리드 폭이라는 값은 없다** — 주자는 루 좌표에 정확히 붙어 있다 | S8 |
| **0.1% 폭투** | `d_level.dat` T=10 → 매 투구 0.1%. 볼넷·사구가 아니면 공이 포수 뒤로 빠진다(각 60~130·세기 160~280). 타격 기록 없음 | S8 |
| CPU 송구 목표 루 | 루 기본 점수 `[홈 4000, 1루 1000, 2루 2000, 3루 3000]` + 확실한 아웃 가산. 첫 아웃에 2배 가중. 난이도는 "여유 최대 루 vs 점수식" 한 곳에서만 갈린다 | S7 |
| 송구 도착 틱 | 커버 야수 유무로 갈리고, 준비 틱은 내야 3 / 외야 6, 중계는 거리 ≥ 17000 일 때 +3틱 | S7 |

### F-2. 투수편

- **투수 평가 칸 5개**: 출루 허용 · 상대 타자 수 · 사구 · **세이브 기회**(등판 순간 리드 중) · **t=5 로 던진 공 수**. 이 중 실제로 읽히는 건 사구·세이브 기회 둘뿐 (S5)
- `state+0x6a` = 상수 6 → `state[0x6a]==state[0x6b]` 은 **"7회 콜드게임이라 구원 등판 기회가 없었다"** (S5)
- **투구 게이지에 PERFECT/GOOD 같은 결과 글자가 원본에 없다.** 가운데로 작아지는 원 한 장(`ui/slt_pitch.pzx` 0x3a~0x43)뿐이고, 최고는 "가운데" 가 아니라 **마지막 칸**이다. ~~웹 `pitchCommand.ts:24,27-51` 의 이름·창·보정값은 전부 원본에 없는 값~~ → **2026-09-25 에 고쳤다**: 투구 화면 둘이 누른 칸 g(0~9)를 그대로 넘기고 `pitchGradeOf` 가 `t = max(g−4,1)` 로 뽑는다. `pitchCommand.ts`·`PitchGauge.tsx`·`MISSION_GAUGE_CELLS` 는 지웠다 (S5 · P1 4-3)
- 정규시즌 **CPU 끼리 경기도 매 경기 4인 로테이션을 한 칸 전진**한다. 웹 `teamRoster.ts:44-46` 은 늘 0번 투수 (S5)
- 강판 플래그 `S+0x68/0x69` 는 경기 상태 9 에서 매 경기 초기화 — 경기 사이에 새지 않는다 (S5)
- `R+0x154` 는 무안타 이닝이 아니라 **삼자범퇴 이닝** (S5)

### F-3. 시즌모드

- **구장 아이템** (S3): 가격표 `0xcbc64` — 관중석 3/6/10/20억 · 전광판 2/4/7/15억 · **잔디 1/2/3억**. `0xd44c4` 는 가격이 아니라 **필요 인기도**. 구매해도 **인기도는 안 깎인다**. 구단관리의 "교체" 에는 가격·보유 가드가 **아예 없다**. 잔디는 어떤 계산에도 안 들어가는 순수 겉모습. 히든 4~6 도 효과는 4번과 같다
- **시즌 평판 16칸** (S4): 삼중살 +4 · 벤치클리어링 −1 · **병살 −2/3개** · **탈삼진 +1/3개** · 내 타자 삼진 −1/3개 · 안타/2루타/3루타 합계 구간 보정 · 홈런 ×1/3/4/5 · 사이클 ×7. **병살이 깎고 탈삼진이 올리는 건 점프표가 코드 4·5 를 뒤집어 놓았기 때문이고, 표 그대로가 실행값이다**
- **국가대항전 플래그를 시즌모드가 안 내린다** (S6, 확정): 대회 뒤 정규 경기마다 대진표로 샌다. ⚠️ 시즌 진행 불가급이라 "원본 그대로" 원칙과 충돌 — **사용자 판단 대기**
- 대표팀은 리그 배열이 아닌 **별도 슬롯**이라 CPU 로스터가 섞이지 않는다 (S6)
- 선수영입은 교체가 아니라 **끼워넣기** — 빠지는 선수도 정원 상한도 없다 (S6)
- 선수 `+0xa` 의 **bit6:bit5 = 종류 코드** (00 일반 투수 · 01 일반 타자 · 10 마타자 · 11 마투수), 하위 5비트 = 칸 번호 (S6)

### F-4. 화면·위젯

- **목록 격자 위젯** (S9) — 모든 목록 화면이 공용으로 쓴다. `0x79ed5(obj, 종류, cx, cy, 칸너비배열[], 줄높이, 열수, 줄수, 가로틈, 세로틈, 플래그)`. **가로만 가운데 정렬**이고 `cy` 는 첫 줄 위쪽 y. 열림 애니는 위에서 한 줄씩 가속하며 떨어진다. 커서는 둥근 네모 RGB(48,69,205) + 2px 튕김. ⚠️ 칸 x 가 `colW[(i−1) mod 열수]` 를 읽어 열 너비가 다르면 어긋난다(원본 버그)
- **마선수 레벨업** (S9): 비용 `1000 × [3,6,9,12][현재레벨]` G. 오픈 플래그 `mgr[0x30+idx]`, 레벨 `mgr[0x13a+idx]`, **idx 0~4 = 마투수 · 5~9 = 마타자**. 웹 `acePlayers.ts:23-33` 은 차례가 반대라 그대로 옮기면 해금 id 와 어긋난다
- **렌더해서 읽은 글자** (S10): 경기 끝 투수 3줄 = **승리투수 · 패전투수 · 세이브**(img_text 388·389·329) · 인트로 = "〈홈팀〉 **스타디움**"(185) · 자동진행 띠 = "**진행속도설정**"(386) · 교체 화면 = "**타자 교체**"/"**투수 교체**"(149·150·299), 딱지는 이름·보직·타율·홈런 / 이름·보직·**방어**·**삼진** · 작은 지도 주자 점 = game_ui 이미지 21
- `ui/img_text.mpl` 팔레트 5장(흰·노랑·주황빨강·짙은파랑·회색). **글자 그림은 언제나 흰색 한 장**이고 그릴 때 색을 갈아 끼운다 (S10)
- 에셋 자체는 웹 `public/sprites/` 에 이미 다 있다(md5 일치). 쓰는 데가 없을 뿐이다 (S10)

### F-5. 최종 감사 결론 (Q3)

**게임 규칙·데이터 기준으로는 사실상 다 해석됐다.** 남은 것은 규칙이 아니라 "그림·좌표·연출" 이다.

- 게임 범위 코드(엔진·런타임·통신 제외) **81.4% 덮임**, 전체 `.text` 기준 73.5%
- **정체 모를 기능 덩어리는 0.** 안 덮인 133KB 는 그래픽 엔진·IME·적재기·C 런타임·기기/서버 통신(110KB) + 0x100 미만 도우미 990개 + UI 위젯 내부
- 장면 점프표 478칸 중 문서 0 은 메인 메뉴 적재 표 23칸뿐, **문자열표 11개의 빈 곳은 전부 닫힘**
- 에셋 285개 중 **272개(95.4%) 처리**, 데이터 파일은 100%
- 감사가 새로 찾은 빈 곳 7건(N-1~N-7)은 전부 필요도 하~중 → `Q3-final-audit.md`
