# 원본 버그 — 웹에 그대로 옮긴 것 (2026-10-26)

원칙은 "항상 원본과 같게, 원본 버그도 그대로"이다(`DECISIONS.md` 2026-09-19). 이 표는 그 원칙에 따라 **원본(binary.mod)에 있던 버그를 웹에도 그대로 둔 것**을 모은 것이다.
사용자가 "이건 고쳐줘" 하고 고를 수 있게 항목마다 id(B-xx)를 붙였다.

- 기준: 웹 main `4cc3bcb5`(round9-r261 머지). 항목마다 지금 웹 코드에 그 동작이 남아 있는지 주석·코드로 확인했다.
- 출처: 웹 `src` 의 "원본 버그 / 원본 그대로" 주석, 커밋 메시지, 이 저장소의 `DECISIONS.md` · `CORRECTIONS.md`(2-1절) · `FOR-IMPLEMENTER.md` · 각 노트의 "원본 버그" 절.
- 같은 버그가 여러 곳(모드·파일)에 적힌 것은 한 줄로 묶었다.
- 영향: **큼** = 승패·돈·보상이 크게 바뀌거나 공짜로 얻는 길이 생김 · **중** = 자주 겪거나 진행·기록이 눈에 띄게 달라짐 · **작음** = 드물거나 글·기록만 조금 틀림 · **거의 없음** = 그림 몇 px·안 드러나는 길.
- 사용자 결정으로 이미 고친 것, 웹이 원본과 다를 수밖에 없는 것은 아래 2절에 따로 적었다. 예전에 "원본 버그"로 적었다가 버그가 아니었던 것은 3절에 있다.

개수: 큼 7 · 중 27 · 작음 49 · 거의 없음 17 = **100건** (그 밖에 고침·웹 다름 5건, 정정 10건)

## 1. 남아 있는 원본 버그

| id | 모드/화면 | 증상 | 원본 근거 주소 | 플레이 영향 | 웹 위치 |
|---|---|---|---|---|---|
| B-01 | 경기(투수편·팀 경기·미션) | 마구를 한 번 던지면 그 경기 끝까지 직구·변화구에도 마구 보정이 계속 붙는다(투수가 바뀌어도 남음) | 공+0x10 을 지우는 코드 없음 — 싣기 0x3de10, 읽는 26곳 전수(H2 3-4) | 큼 | `src/entities/pitcher-career/model/magicPitch.ts` · `src/entities/pitching/model/magicPitchGame.ts` |
| B-02 | 경기(마구) | 마구의 "잘 맞을 확률·홈런 확률" 보정이 타자 쪽을 올린다 — 마구가 오히려 장타를 돕는다 | 보정 0x34d6c out+0xa/+0xb → 타격 판정 0xab214(부호 양수, H2 2절) | 큼 | `src/entities/pitcher-career/model/magicPitch.ts` · `src/entities/batting/model/swingBoost.ts` |
| B-03 | 일반·대전·빠른실행 | 사람이 마선수를 "없음"으로 골라도 CPU 팀은 늘 마투수·마타자를 하나씩 받는다 | 0x31054 가 고른 번호를 `ldrb` 로 읽음(−1 → 0xff, S13 1-4) | 큼 | `src/entities/game/model/aceOpponent.ts` |
| B-04 | 시즌·나리 포스트시즌(CPU 끼리) | CPU 끼리 포스트시즌 경기는 점수를 **덜 낸** 팀이 이긴다 | 0xc2760 c28e2~c290a + 준비 0xc239c 명단 엇갈림(R1 정정) | 큼 | `src/entities/league/model/postseasonPlay.ts` · `src/entities/league/model/leagueDay.ts` |
| B-05 | 나리 타자편·투수편 연말 | 포스트시즌 시리즈가 끝날 때마다 올해의 목표·타이틀·MVP 발표가 보상째 다시 나온다 | 136 진입 0x10bb0 → 0x8bdc9(392), 본 표시를 안 봄(0x8bdc8 → 0xae170) · 0x19774 | 큼 | `src/app/model/useCareerSession.ts` · `src/app/model/usePitcherLeagueSession.ts` |
| B-06 | 시즌 구장관리 | 구장관리 교체에 검사가 없어 사지 않은 구장 아이템도 끼울 수 있다 | 구장관리 교체(S3 6절, 구장 아이템 0x9a84) | 큼 | `src/pages/season/ui/StadiumShopScreen.tsx` · `src/entities/season-mode/model/stadiumItems.ts` |
| B-07 | 시즌 경기 | 경기를 이어할 때마다 관중 수입이 소지금에 한 번 더 들어간다(끄고 이어하면 돈이 는다) | 경기 장면 셋업 0x39fdc 모드 2 → 0xa34b8(0x3a3e4) | 큼 | `src/entities/season-mode/model/seasonAttendance.ts` · `src/app/model/useSeasonSession.ts` |
| B-08 | 경기(마구) | 그 경기 첫 마구는 횟수가 안 줄어 한 경기에 표보다 1개 더 던진다 | 소모 0x345fc 조건이 `공+0x10 != 0` | 중 | `src/entities/pitching/model/magicPitchGame.ts` · `src/entities/pitcher-career/model/magicPitch.ts` |
| B-09 | 경기 전반 | 스태미나 0 인 투수가 한 개 더 던지면 1% 로 되살아난다 | 0xaeb08 else 가지 s' = 100 | 중 | `src/entities/pitcher-career/model/pitcherStamina.ts` |
| B-10 | 경기 기록(모든 모드) | 세이브가 거의 안 붙는다 — CPU 리그 세이브는 늘 0 | state+0x64 를 0 으로 되돌리는 코드 없음 · 경기 끝 검사 0xa7eaa(S1) | 중 | `src/entities/game/model/winLossSave.ts` · `src/entities/league/model/leaguePlayerStats.ts` |
| B-11 | 수비(사람) | 사람이 수비하면 협살이 절대 안 일어난다 | 협살 시작 조건 `state[0x31+수비측] == 1`(CPU, S8 1-4) | 중 | `src/entities/fielding/model/rundown.ts` · `src/features/defense-play/model/runDefensePlay.ts` |
| B-12 | 수비(사람) 레이저 송구 | 레이저 송구 입력 창이 19틱이 아니라 실제 7~9틱뿐이다 | 카운터가 틱이 아니라 0xb2648 호출마다 오름(0x524c0 틱당 2~3번) | 중 | `src/entities/defense-controls/model/laserThrow.ts` · `src/features/defense-play/model/laserTick.ts` |
| B-13 | 나리 타자편 9회 이후 | 자동진행이 멈춘 끝내기 판에서 아웃 수가 3을 넘어(4~5) 설 수 있다 | 0xc22b4 c2318~c232e(`st[6] = t − rand(d, t+1)`) | 중 | `src/features/play-game/model/gameFlow.ts` |
| B-14 | CPU 끼리 경기·간이 타석 | 볼넷이 밀어내기가 아니라 모든 주자 한 루씩 — 3루 주자 혼자여도 득점 | 0xc1818 c1918~c194a → 0xc0fb4(sim, 1) | 중 | `src/entities/game/model/baseState.ts` |
| B-15 | 사람 경기의 CPU 도루 | CPU 도루 확률이 주루와 상관없이 1.1% / 0.5% / 0.3% 고정 | 0x520de · 표 0xd047c(속도칸이 늘 1) | 중 | `src/entities/fielding/model/cpuSteal.ts` |
| B-16 | 시즌 평판 | 병살을 잡으면 평판이 깎이고 탈삼진이 평판을 올린다 | 점프표 0xd7d7c 의 코드 4·5 뒤집힘(S4 2b) | 중 | `src/entities/season-mode/model/seasonReputation.ts` |
| B-17 | 국가대항전 중(나리·시즌) | 대회 동안 내 팀 사기를 읽고 쓰는 칸이 그날 상대국 칸이다 — 사기 변화·돌발 사기가 하루 끝에 사라지고 경기 사기는 상대국 표값으로 선다 | 0x1f940/0x1f8f8 1f95e~1f97a · 0x1f570 1f58a~1f5a4 · 0xa3a24/0xa3a44 · 하루 끝 b8216 | 중 | `src/entities/career/model/nariMorale.ts` · `src/entities/team/model/teamMorale.ts` · `src/entities/career/model/nariCupTeams.ts` · `src/entities/season-mode/model/seasonRewards.ts` |
| B-18 | 시즌 새 해 | 국가대항전을 치른 해에는 새 해 팀 사기가 100 으로 안 돌아간다 | 0x6e0c 6ea0~6ea8 이 `[this+0xa4]`(상대국 슬롯)에 씀 | 중 | `src/entities/season-mode/model/seasonRecord.ts` |
| B-19 | 시즌 트레이드 | 성공률이 등급 차의 절댓값이라 더 좋은 선수를 내줘도 확률이 떨어진다 · 실제 확률은 표시보다 1% 낮다 | 0xcf24(뽑기 1..100) | 중 | `src/entities/season-mode/model/playerTrade.ts` |
| B-20 | 시즌 트레이드 | 트레이드는 시즌모드 내내 한 번뿐이다(GP 아이템으로만 다시 열림) | SR+0x56 을 되돌리는 코드 없음 | 중 | `src/entities/season-mode/model/playerTrade.ts` · `src/entities/season-mode/model/seasonItemShop.ts` |
| B-21 | 시즌 코치 | 코치 보너스가 상대 팀 선수에게도 붙는다 | 0xb5a74 팀 검사 없음(J 4-2) | 중 | `src/features/play-team-game/model/gameAbilities.ts` · `src/entities/league/model/leagueDay.ts` |
| B-22 | 시즌 선수영입 | 영입이 교체가 아니라 끼워넣기 — 밀려난 선수가 안 빠지고, 투수 영입은 칸 번호가 새 투수와 겹친다 | 0xb521c · S6 4-4 | 중 | `src/entities/season-mode/model/playerRecruit.ts` |
| B-23 | 시즌 장비 | 장비를 바꿔 끼우면 앞 장비가 사라져 다시 사야 한다(산 기록이 없다) | 니블 하나뿐(P4 8-4) | 중 | `src/entities/season-mode/model/seasonEquipment.ts` |
| B-24 | 나리 휴식 | 사기가 100 이면 아프거나 다쳐도 휴식을 거절한다 | 0x1261c | 중 | `src/entities/career/model/outing.ts` |
| B-25 | 나리·시즌 외출(병원) | 입원 소지금 검사가 보험증서(나리)·병원 서브아이템(시즌)을 안 봐서 돈이 모자라면 입원이 막힌다 | 0x16d42(나리) · 가드 0xbd38(시즌) | 중 | `src/entities/career/model/outing.ts` · `src/widgets/season/lib/seasonOuting.ts` |
| B-26 | 나리 관리 메뉴 | 행동한 뒤 흑백 외출 칸에 들어갔다 취소하면 트레이닝·휴식·외출이 다시 켜진다(한 주기에 두 번 행동) | 외출 지도 취소 0x13ba4 13bc0~13bca(S+4 = 0) | 중 | `src/app/model/useCareerSession.ts` |
| B-27 | 나리 새 시즌 | 경기 뒤 누적 카운터가 새 시즌에 안 지워져 스킬 획득 조건 10·11·16 이 해를 넘어 쌓인다 | 0xa39bc · 0xa39c6 이 둘 다 +0x1e0 을 지움 | 중 | `src/entities/career/model/playerCareer.ts` |
| B-28 | 나리 경기 평가(116) | 평가 도중 끄고 이어하면 카운터가 한 번 더 쌓이고 보상을 다시 받는다 | S+0x50 == 2 면 116 재진입(R9 10-3) | 중 | `src/app/model/useCareerSession.ts` |
| B-29 | 시즌 경기 평가(0xe9) | 평가 화면에서 끄고 이어하면 평가·구내매점 감소·트레이드 요청을 다시 탄다 | 0xdea0 e114~e130(phase 2 그대로 저장) | 중 | `src/app/model/useSeasonSession.ts` |
| B-30 | 일반모드 이어하기 | 이어하기가 있을 때 새로하기 → 경기정보에서 OK 없이 나가면 [최근게임]이 옛 경기 대신 새 1회초 0:0 경기를 연다 | 22 들어옴 · 0x31134 · 23 나감 0x2a370 2a45a 가 모드 1 블록을 덮음 | 중 | `src/pages/general-mode/model/useGeneralMode.ts` |
| B-31 | 미션(투수) | 노히트노런 미션이 볼넷·사구 하나로 실패하고, "무사사구" 한도는 사구를 안 센다 | 0xaacc6~0xaaccc(R+0x130 출루 허용) · R+0x144 는 볼넷만(0xa8e2a) | 중 | `src/entities/mission/model/pitcherRun.ts` |
| B-32 | 홈런더비 | 이벤트 존은 공이 실제로 닿았는지 안 보고 200G 를 준다 | 0x514e6 이 놓으면서 적중(+0x3f)까지 세움 | 중 | `src/entities/home-run-derby/model/eventZone.ts` |
| B-33 | 나리 이벤트(발렌타인) | 2차 대결 재도전 이벤트 228·229 의 선행 번호가 1차 패배(219)라, 1차를 이기고 2차에서 진 사람에게는 재도전이 안 나온다 | 이벤트 표 228·229 `requiresEvent = 219`(2차 패배는 227) | 중 | `src/shared/config/original/data/events.json` |
| B-34 | 시즌 10년차 엔딩 | 엔딩 화면에서 특정 한 틀에 키를 누르면 영영 넘어가지 않는다 | 키 0x6b3c(단계 +1) · 그리기 0x8bd8 `단계 == 1` | 중 | `src/pages/season/ui/SeasonEndingScreen.tsx` |
| B-35 | 경기 기록 | 승리 투수는 6회 이후 득점·정규 9이닝 경기에서만 정해져, 승리 투수 없는 경기가 생긴다 | 0xa5c34 a5cf6~a5dea(S1) | 작음 | `src/entities/game/model/winLossSave.ts` |
| B-36 | 시즌·나리 순위표 | 승패가 같을 때 상대전적 비교가 엉뚱한 팀끼리 이뤄진다 | 0xb79d8(배열 위치로 팀 번호 표를 찾음) | 작음 | `src/entities/league/model/league.ts` |
| B-37 | 팀 경기 퍼펙트 | 야수선택으로 타자주자만 살면 퍼펙트가 안 깨진다 | 0xa8c6a(`movs r5,#0` 가 루프 안) | 작음 | `src/entities/pitcher-career/model/pitcherGameRecord.ts` |
| B-38 | 시즌 경기 평가 | 연장 완투는 인기도 보너스만 받고 평판 보너스는 못 받는다 | 인기도 st+0x6b · 평판 st+0x69 | 작음 | `src/entities/season-mode/model/seasonEvaluation.ts` · `src/features/play-team-game/model/teamGameFlow.ts` |
| B-39 | 투수편 경기 평가 | 선발 인기도의 실점 감점이 음수 비교라 한 번도 안 걸린다 | 0xa6c92(`adds r3,#6 ; bgt`) | 작음 | `src/features/play-pitcher-game/model/pitcherGameEvaluation.ts` |
| B-40 | 시즌 경기 평가·사기 | 동점 경기를 먼저 공격한 팀이 이긴 것으로 본다 | 0xb69c8 | 작음 | `src/entities/season-mode/model/seasonEvaluation.ts` · `src/entities/game/model/gameRecords.ts` |
| B-41 | 국가대항전 | 대한민국이 결승에 못 가면 우승국을 동전던지기로 정하고, CPU 경기 동점이면 선공 팀이 이긴다 | 0xb858c · 4f09a | 작음 | `src/entities/national-cup/model/nationalCup.ts` · `src/entities/career/model/nariCupGame.ts` |
| B-42 | 국가대항전 결과 | 결승에서 져도 "대표팀 탈락!!" 이 뜬다(준우승이라는 말이 없다) | StrMODE[143] · 0x85e6c | 작음 | `src/entities/national-cup/model/nationalCupFlow.ts` |
| B-43 | 시즌 국가대항전 보상 | 준우승 글은 "+2500만" 인데 실제로는 +2000만 | 0x8a2e(글) vs 0x8b76 `adds #0x14` | 작음 | `src/entities/season-mode/model/seasonRewards.ts` |
| B-44 | 나리 국가대항전 보상 | 나만의리그에는 준우승 보상이 없다 | StrMODE[200] 은 시즌 0x896c 에서만 | 작음 | `src/entities/national-cup/model/nationalCupFlow.ts` |
| B-45 | 나리 GP 아이템 | 능력치는 +10 오르는데 알림은 "6 상승"(모든능력치는 "8") | 0xa455c~0xa45fe(인자 6·8) | 작음 | `src/entities/career/model/gpItems.ts` |
| B-46 | 나리 상점 상세 창 | 영지버섯 사기 "현재" 칸이 먹기 전 값으로 보인다 | 0x14f92 에서 읽고 0x14fde 효과, 다시 안 읽음 | 작음 | `src/pages/management/lib/detailPopup.ts` · `src/pages/shop/lib/gpDetailView.ts` |
| B-47 | 시즌 트레이드 | 자리 벌점을 마스터 표에서 id 아래 비트로 찾아 대부분 선수는 벌점 0 이다 | 0xb6561 b6574 · b65b0 · b65ca | 작음 | `src/entities/season-mode/model/playerTrade.ts` |
| B-48 | 시즌 구장 아이템 | 구장 아이템을 사도 인기도가 안 깎이고, 잔디는 1~3억을 받으면서 아무 효과가 없다 | S3 5-1 · 8절 | 작음 | `src/pages/season/ui/StadiumShopScreen.tsx` · `src/entities/season-mode/model/stadiumItems.ts` |
| B-49 | 투수편 트레이닝 | 사기 0 이면 마구·구질 창도 안 열린다 | 키 0x12d48(사기 0 검사가 맨 앞) | 작음 | `src/pages/pitcher-league/model/usePitcherManagementMenu.ts` · `src/entities/pitcher-career/model/pitcherManagement.ts` |
| B-50 | 시즌 트레이닝 | 지옥훈련은 넷 다 최대일 때만 거절(일부 최대 칸은 헛돎) · 998 칸은 막히지 않고 999 가 된다 | 가드 0x9108(`> 998`) | 작음 | `src/widgets/season/lib/seasonTraining.ts` |
| B-51 | 경기(마구) | 마구 횟수가 구질을 고를 때가 아니라 코스 확정(OK)에서 준다 | 0x50e9c | 작음 | `src/entities/pitcher-career/model/magicPitch.ts` · `src/features/play-pitcher-game/model/pitchAim.ts` |
| B-52 | 돌발미션 | 단타로 3아웃째가 되면 "안타" 실패 · 끝내기 승리로 끝나면 삼진도 성공 · 고의사구 목표는 아무 볼넷이나 성공 | 결과비트 B5 · 0x801 | 작음 | `src/entities/burst-mission/model/burstMissionJudge.ts` · `src/entities/burst-mission/model/burstResultBits.ts` |
| B-53 | 홈런더비 | 마지막 공은 던진 공 수에도, 단계 상승 문턱에도 안 든다 | 0xae3e8 ae4b6(기회가 남을 때만) | 작음 | `src/entities/home-run-derby/model/derbyRun.ts` |
| B-54 | 홈런더비 | 볼 카운트가 공 사이에 안 지워져 넷째 볼부터 "볼넷" 콜이 난다 | 0x3e156 st[5]++ 에 모드 검사 없음 | 작음 | `src/pages/home-run-derby/lib/derbyPitchCall.ts` |
| B-55 | 홈런더비 | 볼넷·사구 뒤 다음 단계부터 내 타자 대신 마스터 팀 타순의 다른 타자가 친다 | 0x48d50 48ddc → 0xaebe4 | 작음 | `src/entities/home-run-derby/model/derbyLineup.ts` |
| B-56 | 수비 화면 | 수비 그림 창 첫 그림에서 펌블·악송구 실책을 두 번 센다(함성도 다시) | 0x43278 4381a~43904 | 작음 | `src/pages/defense/ui/DefensePlayback.tsx` |
| B-57 | 수비 | 홈 송구에는 자동 슬라이딩이 안 걸린다 | 0xb030c(+0x7c 홈 4 ≠ 목표 0) | 작음 | `src/entities/defense-controls/model/sliding.ts` |
| B-58 | 수비 견제 | 견제 커버 야수가 "루 번호 + 1" 로 고정이라 2루 견제도 늘 같은 야수가 들어간다 | 0xb28be~0xb2948 | 작음 | `src/entities/defense-controls/model/pickoff.ts` |
| B-59 | 수비 AI | 외야 백업 위치가 음수 쪽 큰 차이를 무시한다(dx·dz 양수 쪽만 봄) | 0xb4bae | 작음 | `src/entities/fielding/model/catchPrediction.ts` |
| B-60 | 수비 AI | 중계가 낀 외야 재송구 시간을 실제보다 짧게 본다 | 0xb3444 res[5](1구간 틱, S7) | 작음 | `src/entities/fielding/model/throwPlan.ts` |
| B-61 | 경기 기록 | 마타자 타석의 도루는 누구 기록에도 안 쌓인다 | 0xa56dc(지금 타자로 게이트) | 작음 | `src/features/play-pitcher-game/model/pitcherGameFlow.ts` · `src/features/play-game/model/gameFlow.ts` |
| B-62 | 설정 모드 초기화 | 투수편 나리 초기화를 막을 때 [212] 대신 [213] 글이 뜬다 | 0x2c950 `movs r1,#0xd5` | 작음 | `src/entities/settings/model/modeReset.ts` |
| B-63 | 일반모드 빠른실행 | 같은 팀끼리 경기가 나올 수 있다(AI 팀 고르기에도 검사 없음) | 0x314b0 재추첨 없음(J 2절) | 작음 | `src/pages/general-mode/lib/quickStart.ts` |
| B-64 | 일반모드 히든 팀 | 히든 팀(10~14)이 홈이면 구장 바닥색 표를 넘어 읽는다 · 구장 그림 빈칸 | 표 0xcfd0c 첨자 st+0x30 | 작음 | `src/features/play-team-game/model/sceneStadium.ts` |
| B-65 | 경기진행 설정 | 종류에서 OK 를 누르면 값이 "자동진행 없음"으로 돌아간다 · 찬스는 좌우 상관없이 뒤집힌다 · 투수조작 9회 칸은 연장까지 | 0x5ffcc 6003a~60044 | 작음 | `src/pages/match-settings/lib/matchSettingsMenu.ts` · `src/features/play-team-game/model/matchSettings.ts` |
| B-66 | 기록실 통계 탭 | 6·7 쪽 합계가 늘 "0G" | 0x58801(인자 4·5 만 더함) | 작음 | `src/pages/record/lib/statCells.ts` |
| B-67 | 시즌 경기 평가 글(0xe9) | 동점이면 "경기패배!" · 안타 수에서 홈런이 빠지고 2·3루타는 두 번 셈 · "(+200)" 이 "만" 앞에 붙음 | 0x8a6fc · 0xdea0 | 작음 | `src/entities/season-mode/model/seasonGameEvaluation.ts` |
| B-68 | 시즌 경기 뒤 결과판(0xf1) | 동점 경기는 두 팀 모두 LOSE | 그림 0xb400 b6c4 | 작음 | `src/pages/season/lib/dayResultBoard.ts` |
| B-69 | 나리 연봉 | 연봉이 u16 으로 감겨 상한을 넘으면 작은 값으로 돈다 | 0xa4fd8 `strh` | 작음 | `src/entities/career/model/seasonFlow.ts` |
| B-70 | 나리 스킬 획득 조건 | 칸별 훈련 수가 u8−s8 이라 128 을 넘으면 음수 · 몹쓸몸/유리몸 T 도 같다 | 0x18b86 · A 4절 | 작음 | `src/entities/story/model/skillCondition.ts` · `src/entities/career/model/playerCareer.ts` |
| B-71 | 나리 보상 19(타순 바꾸기) | 두 선수가 아니라 세 선수가 돈다 | 0xb5d09(갈래 i == b · b == a) | 작음 | `src/entities/career/model/nariTeamRecord.ts` |
| B-72 | 나리·시즌 마선수 | 넣었던 마선수가 팀 레코드에 남아 그 뒤 목록(CPU 트레이드 요청·십전대보탕)에 보인다 | 142(R9 10-1) · U-105 | 작음 | `src/app/model/useSeasonSession.ts` · `src/entities/career/model/nariTeamRecord.ts` |
| B-73 | 나리 포스트시즌 | 포스트시즌 경기 뒤 평가(116)가 앞 정규 경기의 기록 줄을 다시 보인다 | 0x4f268(포스트시즌이면 0xa719c 안 돎) | 작음 | `src/app/model/useCareerSession.ts` |
| B-74 | 미션 마선수 대결 | 메디카(team 16)를 이길 때만 클리어 칸이 오르고 첫 승은 −1 → 0 | 0xa5368 | 작음 | `src/app/model/useMissionSession.ts` |
| B-75 | 미션 마선수 대결 대기 | 대기 모드 값(g[0xf6])이 3·4 가 아니면 결과 판에서 못 나간다 | 0x407f0 408ce~40942 | 작음 | `src/app/model/useMissionSession.ts` |
| B-76 | 나리 엔딩 | 판정 없음(e = −1) 엔딩은 키가 안 먹는 화면에 갇힌다 | 0x1220c 12222(`bhi`) · 단계 > 2 `ble` | 작음 | `src/app/model/useCareerSession.ts` |
| B-77 | 나리 필살타법 창 | 장타형이 메테오 스윙을 골라도 "사용 중" 이 안 뜬다 | 0xa43c4(4+타입) vs 저장 0x17c64 · 0x1816c(1~4) | 작음 | `src/entities/career/model/playerCareer.ts` · `src/entities/batting/model/specialSwing.ts` |
| B-78 | 보상 알림 | 소지금이 줄 때도 부호 없이 "N만" 으로 보인다 | 0x8beb8 → 0x55cf4(\|값×100\|) | 작음 | `src/entities/story/model/rewardNotice.ts` |
| B-79 | 시즌 선수 카드 | 피부 칸 넷째 값이 "우타" 로 찍힌다 | 표 0x140022c | 작음 | `src/pages/season/lib/seasonPlayerDetail.ts` |
| B-80 | 시즌 능력치 상세 글 | 질병 줄은 질병 종류를 보지만 실제 −30% 는 입원 여유 칸을 봐서 글과 실제가 어긋난다 · 사기 줄도 정액 | 0x897e8 · 0xb5824(7264a07) | 작음 | `src/pages/season/lib/seasonPlayerDetail.ts` |
| B-81 | 표시 구속 | 너클볼은 rank 가 낮을수록 빠르게 표시된다 | 0x66dc0 | 작음 | `src/entities/pitching/model/displaySpeed.ts` |
| B-82 | 마투수 이펙트 | 레오니 마투수 이펙트가 화면에 안 나온다 | 0xbe8d5 목록 넣기가 비우기 0x4d744 뒤 · 53032~53044 | 작음 | `src/widgets/batting-stage/lib/acePitcherEffect.ts` |
| B-83 | 홈런 재생 | 타자 마선수 그림이 팀당 첫 한 명으로 뭉개진다 | 0x3a680~0x3a716(R3 7-3) | 작음 | `src/features/defense-play/model/defensePlayView.ts` · `src/features/defense-play/model/homeRunPlayback.ts` |
| B-84 | 나리 외출 칭호 | 2경기째 창에서 외출한 뒤 이어하면 외출 카운트가 또 지워진다 | 0xf684 fb92~fba8 | 거의 없음 | `src/entities/career/model/playerCareer.ts` |
| B-85 | 수비 | 슬라이딩 키를 두 번 누르면 또 걸리고 효과음만 한 번 | 0x518da | 거의 없음 | `src/entities/defense-controls/model/sliding.ts` |
| B-86 | 수비 필살 포구 | 필살 포구 번쩍임이 한 경기 첫 번에만 네 칸 다 나온다 | 0x93cfd(되감는 곳 없음) | 거의 없음 | `src/features/defense-play/model/defenseScene.ts` |
| B-87 | 타석 HUD 램프 | 칸이 0 으로 내려갔다 같은 수로 다시 켜지면 확대 연출이 없다 | 0x37736 · 0x37744 | 거의 없음 | `src/widgets/batting-stage/lib/renderHud.ts` |
| B-88 | 홈런 글자 | HOMERUN 글자가 살짝 오른쪽으로 치우친다 | 0x40b18(7글자 폭 합 / 2) | 거의 없음 | `src/widgets/batting-stage/lib/homeRunBanner.ts` |
| B-89 | 장비 창 | 아래 칸 빗변이 박스 X 만큼 더 밀린다 | 0x7c2f0(`adds r4, r7, r6`) | 거의 없음 | `src/pages/shop/lib/equipmentWindowLayout.ts` |
| B-90 | 메인 메뉴 | 바퀴가 도는 도중 270° 를 지날 때 칸이 20px 툭 튄다 | 0x24e8a~0x24eba | 거의 없음 | `src/pages/main-menu/lib/mainMenuLayout.ts` |
| B-91 | 메뉴 바탕 | 공 무늬가 한 바퀴마다 2px 튀고, 흐리기 바탕은 오른쪽 아래로 끌린다 | 0x5fd61 · 제자리 평균 | 거의 없음 | `src/pages/special/lib/skinBackdrops.ts` |
| B-92 | 글자 배치 | 못 그리는 글자가 든 줄은 잰 폭이 글자당 자간만큼 넓다 | 0x9c63a~0x9c654 | 거의 없음 | `src/shared/lib/font/layout.ts` |
| B-93 | 곡선 연출 | 베지어 차수 0 가중치가 10000 이 아니라 1 | 0xbcb84 | 거의 없음 | `src/shared/lib/bezier/bezier.ts` |
| B-94 | 목록 격자 | 칸 x 가 `colW[(i−1) mod 열수]` 를 읽어 열 너비가 다르면 어긋난다 — 원본 화면은 모두 같은 너비라 안 드러남 | 0x7a73e(S9) | 거의 없음 | — (드러나는 화면 없음) |
| B-95 | 시즌 엔딩 아이리스 | 원이 한 번 줄었다가 커진다 | seasonEndingLayout 식(t=1 이 t=0 보다 작음) | 거의 없음 | `src/widgets/season/lib/seasonEndingLayout.ts` |
| B-96 | 스토리 화면 효과 | '검정에서밝아짐' 은 어두워지고 '검게어두워짐' 은 밝아진다(이름과 모습이 반대) | L 1-E2(색 몫 (단계+1)/16) | 거의 없음 | `src/entities/story/model/screenEffect.ts` |
| B-97 | 명예의 전당 | A 자리 투수 몸 그림이 한 그림 늦고, 타자 칸에서 넘어온 첫 그림은 타자 자세 번호로 그린다 | [목록+0x204] 공유(P6 7-4) | 거의 없음 | `src/pages/special/lib/hallOfFameFigure.ts` |
| B-98 | 스페셜 영입 목록 | 안 쓰는 칸 10 에도 커서가 선다 | 0x26156~0x26180 | 거의 없음 | `src/pages/special/ui/SpecialScreen.tsx` |
| B-99 | 금액 표시 | 1억 50만이 "1억050" 으로 찍힌다 | 0x55cf4 `"%d억%03d"` | 거의 없음 | `src/entities/story/model/rewardNotice.ts` · `src/features/shop/model/shopSelection.ts` |
| B-100 | 일반모드 빠른실행 | '*' 재굴림은 구장을 안 바꾸고, 빠른실행 뒤 새로하기면 구장 커서가 목록 밖에서 시작한다 | 31262 · 31272 → 31280 · rec+0xc | 거의 없음 | `src/pages/general-mode/lib/quickStart.ts` · `src/pages/general-mode/model/useGeneralMode.ts` |

## 2. 고친 것 · 웹이 원본과 다른 것

| id | 모드/화면 | 원본 버그 | 원본 근거 주소 | 웹 상태 | 웹 위치 |
|---|---|---|---|---|---|
| B-101 | 경기 수비(홈런 건너뛰기) | 키로 건너뛴 홈런에서 타자주자와 같은 목록 틱에 홈을 밟은 앞 주자가 득점이 안 되고 판이 안 끝난다 | 목록 틱 머리 0xbf094(bf0a2)가 +0x3b 지움 · 52e16 | **고침(사용자 결정 2026-10-26)** — 앞 주자도 득점 | `src/features/defense-play/model/runDefensePlay.ts` |
| B-102 | 마선수 드래고나 | 오프라인으로 여는 길이 없다(온라인 선물함 전용) | 0x2bb48 · 기록 누계 표 0xd1ca8 에 없음 | **바꿈(사용자 결정 2026-10-25)** — 해금 표 `ace-dragona` 로 기본 풀림 | `src/shared/config/unlocks/unlocks.json` |
| B-103 | 시즌 MVP 발표 | 일곱 종류 1위가 모두 비면 MVP 고르기가 끝없이 돈다 | 0x8dd60 8ddc8 | 웹 다름 — 그때만 첫 굴림으로 멈춤(정규시즌을 치르면 닿지 않음) | `src/app/model/useSeasonSession.ts` |
| B-104 | 수비 송구 | 받는 점 끼워 넣기가 범위를 안 봐 공 객체 밖 메모리를 덮어쓴다 | b3010(T − 1 ≥ 130 · T = 0) | 웹 다름 — 메모리 덮어쓰기는 옮길 수 없음 | `src/features/defense-play/model/throwLaunch.ts` |
| B-105 | 벤치 클리어링(미션 마타자) | 니블 0 인 마선수는 장면 밖 쓰레기 값을 야수 칸으로 읽어 맞바꾼다 | [장면+0x1754](3abb8) | 웹 다름 — 그 칸을 0(보통 그림)으로 둠 | `src/widgets/field-walk/lib/benchClearingFieldInput.ts` |

## 3. "원본 버그" 로 적었다가 버그가 아니었던 것 (참고)

| 처음 판단 | 실제 | 근거 |
|---|---|---|
| 이벤트 490 이 질병을 치료한다 | 0x8c14e 가 값 0 을 질병 종류로 다시 써서 실제로 병에 걸린다 | P4 · CORRECTIONS 1절 |
| 돌발미션 "안타" 목표에서 단타는 실패 | 단타면 B5 가 켜져 성공(3아웃째 단타만 실패 — B-52) | P7 → K |
| 필살타법 레벨 4 에서 표 밖 값을 읽는다 | 창 0x17828 이 레벨 4 면 모든 칸을 막는다 | R7 → G |
| 시즌모드는 국가대항전 플래그 S+0x12c 를 안 내려 시즌이 막힌다 | 새 해 리그 초기화 memset(0xb7b34)이 지운다 | 588b201 → S6 1-5 |
| CPU 끼리 **정규** 경기는 진 팀이 이긴다 | 정규는 더 낸 팀 승, 뒤집힘은 포스트시즌만(B-04) | 0470ded → R1 |
| 홈런더비 마지막 공 홈런은 콤보가 안 붙는다 | 콤보·보너스 G 는 기회 검사 앞에서 올린다 | eace974 → H 3절 |
| 투수 실점 R+0x128 이 안 채워져 완투가 늘 완봉 | 정산 0xa8f56 이 채운다(실점 항 음수 비교만 남음 — B-39) | 9d039b6 → P1 |
| 시즌 상태 0xf4 는 나가는 길이 없다 | 키 표 0xcbf6c 칸 0x4a18 — OK → 0xdd · CLR → 0xf3 | eefce6e → R13 |
| 오토봇 배트가 열리는 해에는 리그 1위 G 를 못 받는다 | 해금 알림을 닫으면 0x87d2~0x87fc 가 G 를 준다 | a3cfe3a · 5a45956 → P4 4b |
| 크라이져 해금이 힌트("사이클링 트리플")와 달리 2번째 사이클링에 열린다 | 문턱은 지난 경기까지 누계를 본다 — 3번째에 열린다 | 웹 r29 → K 3-1 |

웹 코드 주석 중 `src/entities/career/model/equipment.ts`(오토봇 배트 G 건너뜀)·`playerCareer.ts` 1148행("옮길 코드가 없다")은 위 정정·B-27 보다 앞선 문구라 낡았다.
