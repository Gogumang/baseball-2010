# 웹 코드 주석 근거 감사 — 2026-10-16 (2026-10-24 마침)

> 대상: 웹 `src/` (브랜치 `round9-r144`, main 914d4ca0) 의 주석에 적힌 원본 근거(주소 · 명령 · 상수 · 표 값 · 분기 조건) 중 **2026-10-02 이후 커밋에 들어온 줄**.
> 방법: 최근 커밋 diff 의 더한 줄을 스크립트로 모아 주소별로 묶고, `binary.mod` 를 `docs/re/_raw/re.py`(capstone, 새 venv)로 여러 주소 한꺼번에 떠서 대조했다. `bl 0xca9f0~0xcaa04` 는 직전 `ldr rN,=…` 값으로 풀었다.
> 자동 대조 두 가지: ① 주석의 `주소 명령 #즉치` 를 그 주소의 실제 명령·즉치와 비교, ② `0x표 = [값…]` 을 u8~s32 로 읽어 비교. 나머지는 영역별로 판정·확률·정산·난수 차례·상태 전이 주장을 골라 손으로 떴다.
> 공 궤적 투영·곡선 수식은 대상에서 뺐다(규칙). 판정: ✅ 맞음 · ⚠️ 부분적/표시 어긋남 · ❌ 틀림 · ❓ 확인 불가.

## 통계

| | 건수 |
|---|---|
| 대조한 주장 | **209** (손 대조 131 · 표 값 자동 29 · 명령 자동 49 — 몇 건은 손·자동이 겹친다) |
| ✅ 맞음 | **202** |
| ⚠️ 부분적 | **7** |
| ❌ 틀림 | **0** |
| ❓ 확인 불가 | **0** (궤적 수식은 처음부터 표본에서 뺌) |

손 대조 영역별: 경기 판정 25 · 난수 2 · 파티클 9 · 수비 26 · 투수 19 · 시즌 10 · 나리 8 · 미션 7 · 타격 1 · 소리 7 · 경기 흐름 2 · 화면 배치 7 · 타석 화면 7 · 홈런더비 1

**총평**: 최근 2주 주석의 판정·확률·난수 차례·정산·상태 전이 근거(간이 타석 점프표·겨루기, 특수 타구 2%, 필살타법 p·10, 표시 구속 굴림, CPU 스윙 어긋남, 악송구·흔들림·원바운드, 리드 덧틱, 20% 홈 특수 송구, 0.1% 폭투, 하루 끝 +20% 회복과 모드별 갈래, 엔딩 보너스, 미션 실패 판정, 9회 자동진행 끝내기 판 등)는 **모두 원본과 맞았다**. 틀린 주장은 찾지 못했다. ⚠️ 는 주소가 명령 묶음 첫머리(또는 2바이트 앞)를 가리키는 표시 어긋남 6건과, 원본 조건 하나를 빼고 옮겼지만 결과가 같은 1건이다.

지난 노트 감사(AUDIT-2026-10-16)가 웹 주석 영향으로 적은 두 가지 — `teamGameFlow.ts`·`simulateHalfInning.ts` 의 "마선수" 표현, `runDefensePlay.ts`·`defensePlayView.ts` 의 `0xd3f10` — 는 이미 고쳐져 있다(지금 `src` 에 `0xd3f10` 없음, 두 주석은 "내 육성 선수 · 0xb6388 비트7").

## ❌ 목록

없음. 따라서 웹 동작 수정·시험 추가·난수 차례 변화도 없다.

## ⚠️ 목록

| 파일 | 주장 | 무엇이 갈리나 | 증거 |
|---|---|---|---|
| `src/entities/pitching/model/displaySpeed.ts` | 마구 칸 = +0x18 − 1, 0xb633d 거짓 · r==3 · 폼/2 1→9 · 2→10 | 결과 같음 | 34a4a subs r6,r3,#1 · 34a6e #9 · 34a96 #0xa. 웹 magicSpeedRowOf 는 0xb633d 검사를 빼지만 마선수 번호는 5~9 라 결과 같다 |
| `src/features/defense-play/model/judgeCall.ts` | `6e852 strb #1,[obj,#5]` | 여러 명령을 한 줄로 줄여 적음(주소가 묶음 첫머리 또는 2바이트 앞) — 뜻은 맞다 | 실제 `6e852: strb r3, [r2, #5]` |
| `src/pages/general-mode/model/setupRecord.ts` | `64654 ldrb [skin+0xc8]` | 여러 명령을 한 줄로 줄여 적음(주소가 묶음 첫머리 또는 2바이트 앞) — 뜻은 맞다 | 실제 `64654: ldr r3, [sp, #0xe8]` |
| `src/app/model/usePitcherLeagueSession.ts` | `11bda ldrb r3,[S+0xb2]` | 여러 명령을 한 줄로 줄여 적음(주소가 묶음 첫머리 또는 2바이트 앞) — 뜻은 맞다 | 실제 `11bda: adds r3, r0, #0` |
| `src/app/model/usePitcherLeagueSession.ts` | `11be8 ldrb r2,[S+0xb3]` | 여러 명령을 한 줄로 줄여 적음(주소가 묶음 첫머리 또는 2바이트 앞) — 뜻은 맞다 | 실제 `11be8: adds r3, r0, #0` |
| `src/entities/pitcher-career/model/magicPitch.ts` | `3b554 cmp r3,#7 / ble` | 여러 명령을 한 줄로 줄여 적음(주소가 묶음 첫머리 또는 2바이트 앞) — 뜻은 맞다 | 실제 `3b554: ldr r3, [r0]` |
| `src/entities/pitcher-career/model/magicPitch.ts` | `3b55a ldr r0,[sp,#0x24] / movs r3,#1 / str r3,[r0]` | 여러 명령을 한 줄로 줄여 적음(주소가 묶음 첫머리 또는 2바이트 앞) — 뜻은 맞다 | 실제 `3b55a: ldr r0, [sp, #0x24]` |

## 손 대조 표

| 영역 | 파일 (`src/` 아래) | 주장 | 판정 | 증거 |
|---|---|---|---|---|
| 경기 판정 | entities/game/model/quickAtBat.ts | 0xbfaa0 = rand(0, 2) | ✅ | bfaa2 movs r0,#0 · bfaa4 movs r1,#2 · bfaa6 bl 0xbfa54 |
| 경기 판정 | entities/game/model/quickAtBat.ts | c144c 이 0xbfaa0 을 부른다(부호 굴림) | ✅ | c144c ldr r3,=0xbfaa1 → bl 0xca9f8 |
| 경기 판정 | entities/game/model/quickAtBat.ts | 점프표 0xd9000[0] = c161c | ✅ | u32 0xd9000[0] = 0xc161c |
| 경기 판정 | entities/game/model/quickAtBat.ts | b67f0 state[0x10] = 0 | ✅ | b67f0 strb r3(0),[r0,#0x10] |
| 경기 판정 | entities/game/model/quickAtBat.ts | 0xb633c = +0xa 비트6(마선수) | ✅ | b633c ldrb [r0,#0xa]; lsls #0x19; lsrs #0x1f |
| 경기 판정 | entities/game/model/quickAtBat.ts | 0xb6389 = +0xa 비트7(육성·명전) | ✅ | b6388 ldrb [r0,#0xa]; lsls #0x18; asrs; lsrs #0x1f |
| 경기 판정 | entities/game/model/quickAtBat.ts | 0xb6394 = +0xa & 0x1f | ✅ | b639a movs r3,#0x1f; ands |
| 경기 판정 | entities/game/model/quickAtBat.ts | c182a 0xb6389(투수) 면 존 기준 ×10 낮춤(c1880 movs r3,#0xa) | ✅ | c182a ldr =0xb6389 · c1880 movs r3,#0xa; muls · c1896 subs |
| 경기 판정 | entities/game/model/quickAtBat.ts | c1852·c1878 0xb570c 를 체력% 0xaebb0 로 부른다 | ✅ | c183c ldr r2,=0xaebb1 · c1852/c1878 ldr r4,=0xb570d |
| 경기 판정 | entities/game/model/quickAtBat.ts | c174e st[4]++ ; ≤2 면 끝 | ✅ | c174c adds #1; strb [r2,#4] · c1758 cmp r3,#2; ble |
| 경기 판정 | entities/game/model/quickAtBat.ts | c1764 p = rand(0, 0xb570c(…,1 구속,…,90,1)) | ✅ | c1764 movs r6,#0x5a · c1766 movs r1,#1 · c1776 =0xbfa55 |
| 경기 판정 | entities/game/model/quickAtBat.ts | c1784 b = rand(0, 0xb570c(공격, 0 히트, …, 90, 1)) | ✅ | c1790 movs r1,#0 · c1792 str r6(90) |
| 경기 판정 | features/play-at-bat/model/resolvePitch.ts | 스트라이크 상자 0xcfb7c = (226,310,33,33)·(221,310,33,33) | ✅ | s16 0xcfb7c 8 |
| 경기 판정 | features/play-at-bat/model/resolvePitch.ts | 사구 상자 0xcfd50 = (171,240,38,130) | ✅ | s16 0xcfd50 4 |
| 경기 판정 | features/play-at-bat/model/resolvePitch.ts | 타자 앵커 x 184 (0xcfb2c) | ✅ | s16 0xcfb2c = [184,0,351,0] |
| 경기 판정 | entities/batting/model/battedBallOutcome.ts | 0x514f2 코드 25·26 (subs #0x19; cmp #1; bhi) | ✅ | 514f4 subs r3,#0x19 · 514f6 cmp r3,#1 · 514f8 bhi |
| 경기 판정 | entities/batting/model/battedBallOutcome.ts | 0x51502 rand(0,1000) ≤ 19 | ✅ | 514fa movs r1,#0xfa; lsls #2 · 51506 cmp r0,#0x13; bgt |
| 경기 판정 | entities/batting/model/battedBallOutcome.ts | 특수 타구 표 0xcfb3c 네 줄, rand(0,4) | ✅ | s16 0xcfb3c 12 · 5150c movs r1,#4 · 51512 movs r3,#6 |
| 경기 판정 | entities/batting/model/battedBallOutcome.ts | 5152e b==0 이면 a=rand(−140,−40) · b,c=rand(300,1300) | ✅ | 51538 #0x8c · 5153a #0x28 rsbs · 51548 =0x514 · 5154c #0x96 lsls #1 |
| 경기 판정 | entities/batting/model/battedBallOutcome.ts | 마스크 0x71c0 이면 a=rand(−110,−70)·b=rand(100,480)·c=rand(200,500) | ✅ | 5156e =0x71c0 · 51576 #0x46/#0x6e rsbs(lo>hi 라 [−110,−70)) · 51584 #0xf0 lsls#1 · 51592 #0xfa lsls#1 · 51598 #0xc8 |
| 경기 판정 | features/play-at-bat/model/resolvePitch.ts | 0x517e6 필살타법 p·10 > rand(0,1000) | ✅ | 517e6 bl 0x34c74 · 517ea #0xa muls · 517ec #0xfa lsls #2 · 517fc cmp r4,r0; ble |
| 난수 | entities/batting/model/battedBallOutcome.ts | rand 0xbfa54 는 범위와 무관하게 LCG 한 번 | ✅ | bfa5a =0x343fd · bfa62 =0x269ec3 · bfa66 lsrs #1 · 범위 비교는 갱신 뒤 |
| 파티클 | entities/batting/model/battedBallOutcome.ts | 8fe8c 종류 0: rand(1,3) · rand(−3,4), 칸 수 200(8fe6c) | ✅ | 8fe8e #3 · 8fe92 #1 · 8fe9a #3 rsbs/#4 · 8fe6c movs r0,#0xc8 |
| 파티클 | entities/batting/model/battedBallOutcome.ts | 8f65e 칸마다 rand 여섯 번 → 1202 번 | ✅ | 8f6e0·8f6ec·8f6fc·8f728·8f734·8f740 모두 =0xbfa55 다리, 8f70c·8f71c 는 화면 vt |
| 수비 | features/defense-play/model/judgeCall.ts | 51a94 v−1 ≤ 12 면 점프표 0xd0488 | ✅ | 51a92 subs #1 · 51a94 cmp #0xc; bls · 51a9a =0xd0488 |
| 수비 | features/defense-play/model/judgeCall.ts | 표 0xd0488 열세 칸(1 51aa2 … 13 51b36) | ✅ | u32 0xd0488 13 |
| 수비 | features/defense-play/model/judgeCall.ts | 51c26 [0x1400058]+5 ≠ 0 → 51c38 17 | ✅ | 51c2c ldrb [r0,#5] · 51c3a movs r1,#0x11 |
| 수비 | features/defense-play/model/judgeCall.ts | 6e852 strb #1,[obj,#5] | ✅ | 6e850 movs r3,#1 · 6e852 strb r3,[r2,#5] |
| 수비 | entities/fielding/model/coverAssignment.ts | 표 0xd8774 = [1,2,3,4] | ✅ | bytes 0xd8774 = 01 02 03 04 |
| 수비 | entities/fielding/model/runnerLead.ts | 0xcffa8=[0,15,14,14] · 0xcffac=[0,5,5,5] · 0xcffb0=[0,6,13,7] | ✅ | s8 0xcffa8 12 |
| 수비 | entities/fielding/model/runnerLead.ts | 견제 rand(0,100) ≤ 0 이면 +5 | ✅ | 3d822 cmp r3,#4 · 3d828 #0x64 · 3d830 cmp r0,#0; bgt · 3d834 movs r2,#5 |
| 수비 | entities/fielding/model/runnerLead.ts | 도루 덧틱 rand(0,9), 2 이하면 3 | ✅ | 3d888 #9 · 3d892 cmp r0,#2; bgt · 3d896 movs r4,#3 |
| 수비 | features/defense-play/model/runnerPlayEngine.ts | CPU 홈 송구 20% (afad2) | ✅ | afad2 cmp r0,#0 · afad8 #0x64 · afae0 cmp r0,#0x13; bgt |
| 수비 | features/defense-play/model/pickoffPlay.ts | b4224 펌블표[등급] > rand(0,10000) | ✅ | b4226 =0x2710 · b4230 cmp r7,r0 |
| 투수 | entities/pitching/model/displaySpeed.ts | 66dc8 구질−1 > 20 → 0 | ✅ | 66dc2 subs #1 · 66dc8 cmp #0x14; bls |
| 투수 | entities/pitching/model/displaySpeed.ts | 표 0xd2568 s8 21칸 | ✅ | s8 0xd2568 21 = 웹 SPEED_BASE_OFFSETS |
| 투수 | entities/pitching/model/displaySpeed.ts | lo = b+134 · hi = b+139 | ✅ | 66de0 #0x86 · 66de2 #0x8b |
| 투수 | entities/pitching/model/displaySpeed.ts | 구질 21 거꾸로, hi−=1, (홀수 ? +3/+4 : +2/+5) | ✅ | 66de4 cmp #0x15 · 66de8 subs r1,#1 · 66dea #6 · 66dfe adds r1,r0,#4 |
| 투수 | entities/pitching/model/displaySpeed.ts | 그 밖 1..rank (홀수 ? +3/+5 : +2/+4) · rand(lo, hi+1) | ✅ | 66e16 #3 · 66e20 adds r1,r0,#5 · 66e2c adds r1,#1 |
| 투수 | entities/pitching/model/displaySpeed.ts | 마구 칸 = +0x18 − 1, 0xb633d 거짓 · r==3 · 폼/2 1→9 · 2→10 | ⚠️ | 34a4a subs r6,r3,#1 · 34a6e #9 · 34a96 #0xa. 웹 magicSpeedRowOf 는 0xb633d 검사를 빼지만 마선수 번호는 5~9 라 결과 같다 |
| 투수 | entities/pitcher-career/model/magicPitch.ts | MAGIC_SPEED_RANGES = 0xcfda8 열한 쌍 | ✅ | u8 0xcfda8 22 |
| 투수 | entities/pitching/model/selectPitch.ts | 0x4dbac 구질 22 면 5 | ✅ | 4dbb8 cmp r3,#0x16 · 4dbbc movs r0,#5 |
| 투수 | entities/pitching/model/simulateBatter.ts | 0x340f8 K = h/4 + 2900, 실투면 10000 | ✅ | 34142~3414c (h+3)>>2 + 0xb54 · 34162 =0x2710 |
| 투수 | entities/pitching/model/simulateBatter.ts | K×19/10, 표 [0,0]·[0,1]·[0,1,−1] 굴림 2·3·3번 | ✅ | 34186 #0x13 · 3418a #0xa · 34174/3419c #2 · 341a8 #3 · 341b0 ldrsb |
| 투수 | entities/pitching/model/simulateBatter.ts | F = N − 2 + d | ✅ | 341b4 adds · 341b6 subs r0,r3,#2 |
| 투수 | entities/pitcher-career/model/pitcherCareer.ts | 사기 ≤50 −10% · ≤30 −20% · ≤10 −50% | ✅ | b57ca #0x5a · b57d0 #0x46 · b57d6 #0x32 · b57e2 #0xa · b57ec #5 · b57fa v−v/2 |
| 투수 | entities/pitcher-career/model/pitcherCareer.ts | 질병 v += (−30·v)/100 | ✅ | b5784 lsls #4 · subs · lsls #1 · #0x64 |
| 투수 | entities/pitcher-career/model/pitcherCareer.ts | 냉정 22: v += v/10 | ✅ | b64f4 #0x16 · b6502 cmp r1,#0 · b6508 #0xa |
| 투수 | entities/pitcher-career/model/pitcherCareer.ts | 표 0xcc690 → "승리 "·"패배 "·"세이브" | ✅ | u32 0xcc690 3 · str |
| 투수 | entities/pitcher-career/model/magicPitch.ts | 갈래표 0xcff20 1→3b546 · 4→3b528 | ✅ | 3b4ea cmp #8; bls · u32 0xcff20 |
| 투수 | entities/pitcher-career/model/magicPitch.ts | 0x3b554 cmp r3,#7 / ble | ✅ | 3b556 cmp r3,#7 · 3b558 ble (2바이트 어긋남) |
| 시즌 | app/model/useSeasonSession.ts | MVP 종류 표 0xd4f34 = [9,11,12,1,6,4,3], rand(0,7), 빈 순위면 다시 굴림 | ✅ | 8dd9c =0xd4f34 · 8ddaa #7 · 8ddc8 #7 재굴림 |
| 시즌 | app/model/useSeasonSession.ts | 엔딩 보너스 0xcbc2e[e] × 1000, 99999 상한 | ✅ | s8 0xcbc2e = [0,3,6,9,12] · 8c1a #0xfa lsls #2 · 8c3a =0x1869f |
| 시즌 | entities/league/model/leagueDay.ts | c2464 rand(0,4) → state+0x30 · c2470/c247a rand(0,5) | ✅ | c245e #4 · c2468 adds #0x30 strb · c246c/c2474 #5 |
| 시즌 | app/model/useSeasonSession.ts | 하루 끝 4f2bc 모드 2 열 팀 0xb617c | ✅ | 4f2b0 cmp #2 → 4f2bc · 0x1f571 · 0xb617d · 4f2d2 cmp #9 |
| 나리 | entities/career/model/playerCareer.ts | 하루 끝 4f2e8 열 팀(모드 4) | ✅ | 4f2b6 cmp #4 → 4f2e8 · =0x1f989 |
| 나리 | entities/pitcher-career/model/pitcherCareer.ts | 하루 끝 4f304 열 팀(모드 3) | ✅ | 4f2a8 cmp #3 → 4f304 · =0x1f989 |
| 시즌 | entities/pitcher-career/model/pitcherStamina.ts | 회복 0x66ed0: 모드 3·내 선수만 선발 40 · 그 밖 80, 나머지 20 | ✅ | b60f6 cmp #3 · 66ee0 #0x28 · 66ee4 #0x50 · 66ee8 #0x14 · b6704 +0xb & 3 |
| 시즌 | entities/pitcher-career/model/pitcherStamina.ts | 0xb60e0 회복 +%×100 · 0..10000 자름 | ✅ | b612a #0x64 muls · b613c =0x2710 · b6148 bge 0 |
| 시즌 | app/model/useSeasonSession.ts | 질병 −30% 는 SR+6 > 0 (0xb5824) | ✅ | b5824 movs r3,#6 · ldrsb · cmp #0; bgt |
| 나리 | entities/career/model/playerCareer.ts | 표 0xcc378[커서] = [1,2,3,4] | ✅ | u32 0xcc378 4 |
| 시즌 | app/model/useSeasonSession.ts | 0x9d789 cmp 종류,#7; ble (9d83e·9d85c) | ✅ | 9d83e cmp r1,#7 · 9d85c cmp r2,#7 |
| 시즌 | entities/game/model/aceOpponent.ts | 0x66968 rand(0,5), 같으면 하나 내림(0 이면 4) | ✅ | 6696e #5 · 6697c cmp · 66984 subs #1 · 66988 #4 (웹 rollOpponentAceIndex 같음) |
| 시즌 | app/model/useSeasonSession.ts | 팁 rand(0, 73) (53dde) | ✅ | 53dd8 =0xbfa55 · 53dde bl, 상한은 앞 호출 값(줄 수) |
| 나리 | app/model/usePitcherLeagueSession.ts | 12b98 경기 수 짝수면 105 관리 · 홀수면 109 순위표 | ✅ | 12b9c lsls #0x1f; bmi · 12ba0 movs r1,#1 · 12bac #0x69 · 12bb0 #0x6d |
| 미션 | app/model/useMissionSession.ts | 34516·34524 마구>0·남은>0·볼카운트 조건이면 22 를 적고, 아니면 34566 rand(0,6) | ✅ | 3451c ldrb [+0x18] · 34524 =0xaea11 · 34558 movs #0x16 · 3456a movs r1,#6 |
| 미션 | app/model/useMissionSession.ts | GP 통계는 0x292f8 k = 3·4·7 → 293dc movs r2,#6 | ✅ | 293cc cmp r7,#3 · 293d0 #4 · 293d4 #7 → 293dc movs r2,#6 |
| 나리 | pages/pitcher-league/model/usePitcherManagementMenu.ts | 충전 값 표 0xd1f0c = 100·500·1000·3000원 → 0xd1f1c × 100 = 300·1500·3300·12000 G | ✅ | u32 0xd1f0c · u32 0xd1f1c = [3,15,33,120] |
| 나리 | entities/pitcher-career/model/pitcherSeasonFlow.ts | 엔딩 보너스 0xcc40c[e] × 1000, 0..99999 | ✅ | s8 0xcc40c 10 = [0,0,4,8,10,12,14,16,18,20] · 1bc0e #0xfa lsls #2 · 1bc2c =0x1869f |
| 미션 | app/model/useMissionSession.ts | 명예 타자 등록 1f682 movs r3,#0x20 · 1f684 strb [r1,#0xa] | ✅ | 같은 줄 |
| 나리 | pages/management/lib/nariMatchPrepare.ts | 표 0xd7638[0] = −1 | ✅ | s8 0xd7638 |
| 나리 | pages/management/lib/nariMatchPrepare.ts | 0x78664 cmp r1,#9, 넘으면 rand(0,10) | ✅ | 7866a cmp r1,#9 · 78674 #0xa |
| 미션 | app/model/useMissionSession.ts | 하늘 줄 0x783b0 모드 5·6 은 rand(0,6) | ✅ | 783ba bhi · mask 0x302/bit2/0x18 밖 → 783fa #6 → 0xca911(mod 6) |
| 미션 | app/model/useMissionSession.ts | 모드 표 0xd0428[5·6] = 0x4ef18 | ✅ | u32 0xd0428[5]=[6]=0x4ef18 |
| 미션 | app/model/useMissionSession.ts | 0xa5368 [obj+0xbd] ≤ 15 면 클리어 횟수 칸(+0x150 + 편×16 + idx) | ✅ | a5392 adds #0xbd · a5398 cmp #0xf; bgt · a53b8 lsls #4 · a53be #0xa8 lsls #1 |
| 미션 | entities/mission/model/missionRun.ts | aaa20 필요>0 칸마다 (필요−달성) > 남은 기회면 상태 2, 9칸 | ✅ | aaa22 ble · aaa30 subs · aaa38 cmp; bgt → aaa58 movs #2 str [+0x1c] · aaa40 cmp r0,#8 |
| 타격 | entities/batting/model/specialSwing.ts | 0x34c74 마타자(+0x24 ≥ 0)면 30, 아니면 0xcfdbe[번호−1] = 15·20·25·25·30 | ✅ | 34ca2 cmp; blt · 34cac #0x1e · 34cb2 subs #1 · s8 0xcfdbe 5 |
| 소리 | shared/config/original/sounds.ts 외 | 51fc4 movs r1,#0x3c(60) · 51fce cmp r3,#0; bne 51fe0 | ✅ | 같은 줄 |
| 소리 | app/model/screenBgm.ts | 12328 cmp e,#1; bgt 12332 → 0x34 | ✅ | 12328 cmp r5,#1 · 1232a bgt · 1232e movs r1,#0x34 |
| 소리 | features/play-at-bat/lib/atBatSounds.ts | "Foul!" 51c5c movs r1,#0x19 → 0x6ea6d | ✅ | 51c6a movs r1,#0x19 · 51c70 =0x6ea6d |
| 소리 | features/play-at-bat/lib/atBatSounds.ts | 사구 v4 0x51b14 movs r1,#0x17 | ✅ | 51b14 movs r1,#0x17 |
| 소리 | features/play-at-bat/lib/atBatSounds.ts | 51aa8 ldrsb [st,#4] == 2 면 0x27, 아니면 0x12 | ✅ | 51aa8 ldrsb · 51aac cmp #2 · 51ab2 #0x12 · 51ab8 #0x27 |
| 소리 | widgets/batting-stage/lib/pitchReleaseSound.ts | 3f46a 구질 22 → 28 · 공+0x10 ≠ 0 → 28, 아니면 12 | ✅ | 3f470 cmp #0x16 · 3f48c ldr [r3,#0x10] · 3f49c movs #0x1c · 3f4a4 movs #0xc |
| 소리 | app/model/screenBgm.ts | 진입 표 0xcc728[상태−100]: 130 → 0x19824 · 131 → 0x19774 | ✅ | u32 0xcc728[30] = 0x1cf56 → bl 0x19824 · 0x1cf5e → bl 0x19774 (토막 다리) |
| 경기 판정 | features/play-game/model/gameFlow.ts | 0xc22b4 모드 4 · 9회 · 말 · d=점수0−점수1 (u32) ≤ 3 · t=아웃+주자 ≥ d · n = rand(d, t+1) | ✅ | c22c0 cmp #4 · c22d4 blt · c22dc cmp #1 · c230c cmp #3; bhi · c2312 blt · c2316 adds r1,r4,#1 · r0 = c230a 의 d |
| 경기 판정 | features/play-game/model/gameFlow.ts | 아웃 = max(0, t−n) · 루마다 n == 3−i 거나 rand(0, n+1) == 0 이면 세움 | ✅ | c2320 subs · c2326 ble 0 · c232e strb [+6] · c2342~c235c |
| 투수 | entities/game/model/simulateHalfInning.ts | ac4f2 마투수면 특수 문턱 A>2 · B>3 · s≤39 로 교체 | ✅ | ac4fc cmp r7,#2; bgt · ac502 cmp #3; bgt · ac508 cmp #0x27; ble → ac5c0 |
| 투수 | features/play-team-game/model/teamGameFlow.ts | 0xa5f30 movs r1,#0x12 — 스킬 18 | ✅ | a5f30 movs r1,#0x12 → 0xcaa04 다리 · a5f3c 소모 ×2 |
| 경기 흐름 | features/play-team-game/model/teamGameFlow.ts | 3107a 0xb8c94(AI팀, 0, rand(0,4)) → 31090 사람팀 rand(0,4) | ✅ | 3107a =0xbfa55 · 3107c #4 · 3108a =0xb8c95 · 31090 #4 |
| 경기 흐름 | features/play-team-game/model/teamGameFlow.ts | 48e94 cmp r3,#0x16; beq 48eb8 (이전 상태 0x16 이면 타석 초기화 건너뜀) | ✅ | 48e94 ldr [r7,#0x28] · 48e96 cmp #0x16 · 48e98 beq |
| 난수 | features/play-team-game/model/teamGameFlow.ts | 시뮬 초기화 c0df6 rand(0, 2) | ✅ | c0df6 movs r1,#2 · c0df8 =0xbfa55 |
| 수비 | features/defense-play/model/runDefensePlay.ts | 0xa1e60 필살타법 맞은 야수 소리 movs r1,#0x35 · 잠금 +0xb4 = 15(a1e70) | ✅ | a1e70 movs r3,#0xf · a1e7a movs r1,#0x35 · a1e80 =0x6ea6d |
| 수비 | features/defense-play/model/runDefensePlay.ts | 홈 점 표 0xd7be8 = (20000, 0, 29445) | ✅ | s32 0xd7be8 3 |
| 수비 | entities/fielding/model/fieldingState.ts | 선수 없는 칸 g = 2 (b106a movs r0,#2) | ✅ | b106a movs r0,#2 |
| 수비 | entities/fielding/model/throwTargetBase.ts | 고르기 시작값 500 (b0164) · 끝 비교 500 (b02ae) | ✅ | b0164 #0xfa lsls #1 · b02ae #0xfa · b02b4 cmp |
| 수비 | entities/fielding/model/throwTargetBase.ts | 가장 빠른 수비 루 시작값 1000 (afc7e) | ✅ | afc7e movs r6,#0xfa · afc82 lsls #2 |
| 수비 | entities/fielding/model/passedBall.ts | 0x35034 모드 ≠ 7 && T > rand(0,10000) | ✅ | 3503c cmp #7 · 3504a =0x2710 · 3505c cmp r4,r0; ble |
| 수비 | entities/fielding/model/passedBall.ts | 각도 rand(60,130) · 세기 rand(160,280) | ✅ | 35082 #0x82 · 35084 #0x3c · 3508c #0x8c lsls #1 · 35094 #0xa0 |
| 수비 | entities/fielding/model/throwPlan.ts | 악송구 rand(0,10000) < 기준 + 특수×100 + 100 | ✅ | a1828 =0x2710 · a1834 #0x64 muls · a183c +0xe4 · a1842 adds #0x64 · a1844 cmp; blt |
| 수비 | entities/fielding/model/throwPlan.ts | a1868 h += rand(−50, 특수?0:51) ; h ≤ 99 → 100 | ✅ | a185c #0x33 · a185e #0x32 rsbs · a186e cmp #0x63; bgt · a1872 #0x64 |
| 수비 | entities/fielding/model/throwPlan.ts | a1876 w += rand(−49, 특수?0:50) | ✅ | a1880 #0x32 · a1882 #0x31 rsbs |
| 수비 | entities/fielding/model/throwPlan.ts | a1908 m = rand(0, 22 − h/150) · 부호 rand(0,2) 표 0xd7aec=[1,−1] | ✅ | a190c #0x96 · a1912 #0x16 subs · a191e #2 · a184a =0xd7aec |
| 수비 | entities/fielding/model/throwPlan.ts | a198c 거리 > 0x2008 이면 rand(0,10000) 흔들림 · h·w 85% | ✅ | a198c =0x2008 · a1996 =0x2710 · a19a8 movs r4,#0x55 · a19b0 #0x64 |
| 수비 | entities/fielding/model/throwPlan.ts | a17fc 원바운드면 0xbfaa0 으로 φ ± 1 | ✅ | a1802 =0xbfaa1 · a180e adds #1 |
| 수비 | entities/fielding/model/playGate.ts | b0e54 cmp r1,#0x32 ; ble | ✅ | 같은 줄 |
| 수비 | features/defense-play/model/runDefensePlay.ts | 0xae5f8 은 빈 함수(movs r0,#0) | ✅ | ae5f8 sub sp · movs r0,#0 · add sp · bx lr |
| 수비 | features/defense-play/model/runDefensePlay.ts | 폴 충돌 0xa2c64 rand(−25, 25) | ✅ | a2c58 #0x19 · a2c5e #0x19 · a2c62 rsbs r0 · a2c64 bl |
| 파티클 | widgets/game-scene/lib/sceneParticles.ts | 0x52c50 53048 공용 창 [0x140005c]+9 == 0 일 때만 틱 0x6de85 · 그리기 0x6dd69 | ✅ | 52c58 =0x140005c · 52c5a ldr r6 · 53048 ldrb [r6,#9] · 5304c bne · 53050 =0x6de85 · 5305e =0x6dd69 |
| 파티클 | shared/lib/particle/particleEmitter.ts | 그리기 A >> 8 을 효과 인자로 (0x6dd26 asrs #8) | ✅ | 6dd26 asrs r4,r4,#8 · 6dd2a str [sp] |
| 파티클 | widgets/batting-stage/lib/acePitcherEffect.ts | 391a2 0xb633d(마운드 투수) 검사 · 구질 22 면 391c4 | ✅ | 3919e cmp #0x16; beq 391c4 · 391a4 =0xb633d |
| 파티클 | widgets/batting-stage/lib/acePitcherEffect.ts | 47028 +0x18 − 5 > 4 → 끝, 점프표 0xd00c8: 5 0x472ba · 6 0x4703a · 7·8 0x47250 · 9 0x47368 | ✅ | 4702a subs #5 · 4702c cmp #4; bls · u32 0xd00c8 5 |
| 파티클 | widgets/batting-stage/lib/acePitcherEffect.ts | 섞기 b = 0x10 (0x473c0) · a = s·10 | ✅ | 473ba #0xa muls · 473c0 movs r3,#0x10 |
| 파티클 | widgets/game-scene/lib/sceneParticles.ts | 0x3de64 0x11 진입 파티클 0x6dee5 | ✅ | 3de60 =0x1400068 · 3de64 =0x6dee5 |
| 파티클 | widgets/game-scene/lib/sceneParticles.ts | 0x48f02 이전 상태 ≠ 0x16 일 때만(48ef8) | ✅ | 48ef8 ldr [r7,#0x28] · 48efa cmp #0x16; beq · 48f02 =0x6dee5 |
| 화면 배치 | pages/record/lib/recordAnnalsLayout.ts | 0xbb28d(W/2, y0 + 0x91, 0xad, 0x3c, 정렬 2) | ✅ | 2f35e #2 · 2f364 asrs #1 · 2f366 adds #0x91 · 2f368 #0xad · 2f36a #0x3c |
| 화면 배치 | pages/season/lib/postseasonBracketLayout.ts | 덮는 칸 h + 1 (0x85840 adds r5,r3,#1) | ✅ | 같은 줄 |
| 화면 배치 | pages/loading/lib/loadingTipLayout.ts | 막대 (BX, BY, 150, 10) · BX = X + ((w−150) >> 1) | ✅ | 53f30 #0x96 · 53f32 #0xa0 lsls #0xc(높이 10) · 53f48 subs · 53f4a asrs #1 |
| 화면 배치 | widgets/batting-stage/lib/derbyHudLayout.ts | 상자.y = 14 를 덮는다(36da0) | ✅ | 36da4 movs r3,#0xe · 36da8 strh [sp+0x22] |
| 화면 배치 | pages/mission-select/lib/missionSelectLayout.ts | 설명 상자 0xbb28d(120, 193, 173, 65, 2) | ✅ | 1dfd6 adds #0x21 · 1dfd8 #0xad · 1dfde #0x41 · 1dfd2 #2 |
| 화면 배치 | pages/special/lib/specialLayout.ts | 칸 가로·세로틈 0 (0x651be~0x651d6) | ✅ | 651c6 movs r5,#0 · 651d4/651d6 str r5,[sp,#0x10/#0x14] → 0x79ed5 |
| 화면 배치 | pages/shop/lib/shopLayout.ts | 0x6bead 꼴 0x10 가로 감기 | ✅ | 6bebe lsls r2,r6,#0x1b(비트 4) · 6becc bl 0x6bdc4 |
| 타석 화면 | widgets/batting-stage/lib/batterLayers.ts | 번트 v = rec[0xb] >> 4 (356b6~356bc) · cmp v,#3; bgt | ✅ | 356b6 ldrb [r0,#0xb] · 356ba lsrs #4 · 356bc str [+0x28] · b9090 cmp r1,#3 |
| 타석 화면 | widgets/batting-stage/lib/batterLayers.ts | 0xb905c 마타자 순번 cmp u,#4; bhi | ✅ | b9078 · b90aa · b90fa cmp r4,#4 |
| 타석 화면 | widgets/batting-stage/ui/BattingStage.tsx | 투수 스킬 31(0xabcd8) 타자 0xb6394 가 2·3·4 면 | ✅ | abcd8 =0xb6395 · abcde cmp #2 · abce8 #3 · abcf2 #4 |
| 타석 화면 | widgets/batting-stage/lib/renderBattingStage.ts | 체력% 0xaebb1 이 34 이하면 player_effect 애니 | ✅ | 38f68 =0xaebb1 · 38fce cmp r0,#0x22 |
| 타석 화면 | widgets/batting-stage/lib/renderScenery.ts | 하늘 조명 0x78490 784b8 cmp r1,#0 | ✅ | 784b8 cmp r1,#0 · 784ba bne |
| 타석 화면 | widgets/batting-stage/lib/renderScenery.ts | 구장 8 은 단색 하늘·조명 없음 (0x78046 · 0x784c6 cmp #8) | ✅ | 78046 cmp r3,#8 · 784c6 cmp r3,#8 |
| 타석 화면 | widgets/batting-stage/lib/batterLayers.ts | 0x78dc6 cmp r3,#0; beq 슬롯 0 만 | ✅ | 78dc6 cmp r3,#0 · 78dc8 beq |
| 경기 판정 | entities/game/model/quickAtBat.ts | 점프표 0xd9000 나머지 코드 1·2·4·5·10·11·13·14·16·17·19·20·22·23 → c170c | ✅ | u32 0xd9000 25 풀이 |
| 경기 판정 | entities/game/model/quickAtBat.ts | 코드 3 rand(0,10000) vs rand(0, 주력) · 15·18 rand(0,666) vs rand(0, 주력) | ✅ | c150c =0x2710 · c1528 movs r1,#3(주력) · c153e cmp r6,r0 · c1680 =0x29a |
| 홈런더비 | pages/home-run-derby/model/useHomeRunDerby.ts | 상대 팀 0x39fdc 모드 7 rand(0, 9) | ✅ | 3a44a movs r1,#9 · 3a450 =0xbfa55 |

## 표 값 자동 대조

| 파일 | 표 | 주장 값 | 판정 |
|---|---|---|---|
| pages/create-player/lib/teamSelectLayout.ts | `u32 0xd1df8` | [40, 40, 40, 40, 40] | ✅ |
| entities/pitcher-career/model/pitchSelection.ts | `u32 0xcc378` | [1, 2, 3, 4] | ✅ |
| pages/special/lib/specialLayout.ts | `s8 9바이트 줄[1] 0xceaf2` | [-1, 6, 7, 8, 1, 2, 3, 4, 5] | ✅ |
| pages/create-player/lib/abilityRadarPanel.ts | `u16 0xd1b0c` | [225, 315, 45, 135] | ✅ |
| pages/pitcher-league/lib/pitchTrainingWindow.ts | `u8 0xd469e` | [2, 4, 5] | ✅ |
| pages/mission-select/lib/missionSelectLayout.ts | `u32 0xcd68c` | [30, 30, 30, 30, 30] | ✅ |
| shared/lib/commonPanel/commonPanel.ts | `u8 0xd1c44` | [255, 255, 222, 222] | ✅ |
| pages/general-mode/lib/prepareLayout.ts | `u8 0xd40b8` | [3, 3, 3, 13, 13] | ✅ |
| widgets/field-walk/lib/halfInningWalk.ts | `u32 0xd044c` | [0, 7, 8, 6, 2, 3, 5, 4, 0] | ✅ |
| widgets/batting-stage/lib/batterLayers.ts | `u8 0xd8ac5` | [8, 9, 7, 7, 7] | ✅ |
| widgets/batting-stage/lib/batterLayers.ts | `u8 0xd8ad3` | [5, 4, 4, 4, 4] | ✅ |
| entities/pitcher-career/model/pitchTraining.ts | `u32 0xd4e40` | [18, 19, 20, 21] | ✅ |
| widgets/season/lib/seasonTrainingResult.ts | `u32 0xcbe58` | [999, 999, 999, 999, 100] | ✅ |
| entities/story/model/skillCondition.ts | `u32 0xd7e10` | [2, 3, 4, 5, 17, 18, 19, 20] | ✅ |
| entities/collection/model/collectionRewards.ts | `u8 0xcebd4` | [3, 10, 20, 30, 40, 50, 60, 90] | ✅ |
| entities/fielding/model/coverAssignment.ts | `u8 0xd8774` | [1, 2, 3, 4] | ✅ |
| entities/fielding/model/throwPlan.ts | `s32 0xd7aec` | [1, -1] | ✅ |
| pages/ending/lib/endingLayout.ts | `s8 0xd41c7` | [45, -28, -69, -42, -108, 6, -56, -80, 13, -29] | ✅ |
| pages/story/lib/awardWindows.ts | `u32 0xd4e30` | [76, 77, 78, 0] | ✅ |
| entities/pitching/model/pitcherChange.ts | `u32 0xd833c` | [0, 1, 2] | ✅ |
| entities/fielding/model/runnerLead.ts | `u8 0xcffa8` | [0, 15, 14, 14] | ✅ |
| entities/fielding/model/runnerLead.ts | `u8 0xcffac` | [0, 5, 5, 5] | ✅ |
| entities/fielding/model/runnerLead.ts | `u8 0xcffb0` | [0, 6, 13, 7] | ✅ |
| widgets/game-scene/lib/endBoardLayout.ts | `u32 0xd0470` | [388, 389, 329] | ✅ |
| features/play-team-game/model/teamGameRoster.ts | `u8 0xd88aa` | [60, 70, 80, 90, 100] | ✅ |
| entities/mission/model/aceLevel.ts | `u32 0xd1724` | [3, 6, 9, 12] | ✅ |
| entities/mission/model/aceLevel.ts | `u8 0xd1739` | [2, 2, 3, 4, 5] | ✅ |
| entities/mission/model/aceLevel.ts | `u8 0xd173e` | [3, 4, 5, 6, 7] | ✅ |
| entities/career/model/skillEquip.ts | `u8 0xcc4f7` | [5, 10] | ✅ |

## 명령 자동 대조 (✅)

| 파일 | 주석의 명령 | 실제 |
|---|---|---|
| features/defense-play/model/judgeCall.ts | `51c3a movs r1,#0x11` | `movs r1, #0x11` |
| features/defense-play/model/judgeCall.ts | `51c50 movs r1,#0x11` | `movs r1, #0x11` |
| widgets/batting-stage/model/sceneResultCodeStore.ts | `3deea str r4` | `str r4, [r3]` |
| features/play-team-game/model/teamGameFlow.ts | `8e404 strh [r0, #2]` | `strh r3, [r0, #2]` |
| entities/career/model/nariMorale.ts | `a3a64 strh [레코드, #2]` | `strh r3, [r0, #2]` |
| entities/career/model/training.ts | `1816c strb ` | `strb r3, [r0, #0x18]` |
| pages/create-player/lib/abilityRadarPanel.ts | `5b42a adds r4,#0x12` | `adds r4, #0x12` |
| entities/game/model/quickAtBat.ts | `bfaa2 movs r0,#0` | `movs r0, #0` |
| app/model/usePitcherLeagueSession.ts | `12b98 ldrb r3,[r2]` | `ldrb r3, [r2]` |
| app/model/usePitcherLeagueSession.ts | `12b9a movs r1,#0` | `movs r1, #0` |
| app/model/usePitcherLeagueSession.ts | `12b9c lsls r5,r3,#0x1f` | `lsls r5, r3, #0x1f` |
| app/model/usePitcherLeagueSession.ts | `12ba0 movs r1,#1` | `movs r1, #1` |
| app/model/usePitcherLeagueSession.ts | `12ba8 cmp r1,#0` | `cmp r1, #0` |
| app/model/usePitcherLeagueSession.ts | `12bac movs r1,#0x69` | `movs r1, #0x69` |
| app/model/usePitcherLeagueSession.ts | `12bb0 movs r1,#0x6d` | `movs r1, #0x6d` |
| pages/create-player/lib/teamSelectLayout.ts | `761fc muls ` | `muls r0, r3, r0` |
| pages/create-player/lib/teamSelectLayout.ts | `76208 strb ` | `strb r0, [r2, #3]` |
| entities/fielding/model/fieldingState.ts | `b1032 cmp r4,#0` | `cmp r4, #0` |
| entities/pitching/model/displaySpeed.ts | `66de4 cmp #0x15` | `cmp r2, #0x15` |
| pages/general-mode/model/setupRecord.ts | `23f36 ldrb [rec+0xc]` | `ldrb r3, [r6, #0xc]` |
| pages/title/model/useTitleIntro.ts | `24612 ldrb [r3+2]` | `ldrb r3, [r3, #2]` |
| shared/api/audio/soundPort.ts | `6e424 ldrb [미디어+0x11]` | `ldrb r3, [r1, #0x11]` |
| shared/api/random/seededRandom.ts | `bfa78 subs r1, r5` | `subs r1, r4, r5` |
| app/model/screenBgm.ts | `12328 cmp e, #1` | `cmp r5, #1` |
| entities/fielding/model/playGate.ts | `b0e54 cmp r1, #0x32` | `cmp r1, #0x32` |
| entities/settings/model/modeReset.ts | `2c950 movs r1,#0xd5` | `movs r1, #0xd5` |
| entities/mode-save/model/modeSave.ts | `9f334 str r5` | `str r5, [r7, #0x3c]` |
| entities/mode-save/model/modeSave.ts | `327e8 str r1, [기록, #0x3c]` | `str r1, [r0, #0x3c]` |
| entities/game/model/simulatorInit.ts | `c0e14 str r0, [r7, #4]` | `str r0, [r7, #4]` |
| entities/collection/model/collectionRewards.ts | `9f708 ldr r3,=0x145` | `ldr r3, [pc, #0xc]` |
| features/defense-play/model/runDefensePlay.ts | `afad2 cmp r0,#0` | `cmp r0, #0` |
| widgets/batting-stage/lib/pitchReleaseSound.ts | `3f46a ldr r3,[게임+0xfc8]` | `ldr r2, [pc, #0x88]` |
| widgets/batting-stage/lib/pitchReleaseSound.ts | `3f488 ldr r3,[[게임+0xf98]]` | `ldr r1, [sp]` |
| features/defense-play/model/runnerFates.ts | `51ffc cmp /bge` | `cmp r1, r0` |
| entities/fielding/model/outJudgement.ts | `b2e92 str ` | `str r3, [r5]` |
| entities/fielding/model/outJudgement.ts | `b2e94 str ` | `str r4, [r5, #4]` |
| entities/fielding/model/outJudgement.ts | `b3932 ldr [주자+0x8c]` | `ldr r3, [r3, #0x14]` |
| entities/mission/model/pitcherRun.ts | `aacca ldrsb ` | `ldrsb r2, [r4, r2]` |
| entities/mission/model/pitcherRun.ts | `aacc6 ldrb [r6,#0xc]` | `ldrb r1, [r6, #0xc]` |
| entities/pitching/model/selectPitch.ts | `4dbb8 cmp #0x16` | `cmp r3, #0x16` |
| entities/pitching/model/selectPitch.ts | `4dbbc movs r0,#5` | `movs r0, #5` |
| entities/game/model/benchClearing.ts | `3ab74 movs r1,#0xfa` | `movs r1, #0xfa` |
| widgets/batting-stage/lib/batterLayers.ts | `78dc6 cmp r3,#0` | `cmp r3, #0` |
