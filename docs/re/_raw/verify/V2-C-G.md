# V2 검증 — C-create-palette.md · G-management-numbers.md

## 요약
(작업 중 — 마지막에 채움)

## C. 선수 등록 · 피부색 · 대체 팔레트

- C-4 시작 능력치 표: ✅ `re s8 0xcc3fa 8` = [10,10,10,10, 8,15,8,8] · `re s8 0xcc3f2 8` = [10,10,10,20, 12,12,12,10] — 문서와 같음.

### C-1 팀·피부별 선수 그림 색
- 팔레트 번호 = 피부×15+팀 (0x78be8): ✅ `re dis 0x78bda` — `lsls r3,r6,#4; subs r3,r3,r6; adds r3,r3,[sp+0x1c]` (r6 = 피부 = 인자 r3, [sp+0x1c] = 팀 = 인자 r1), 0xbbd0d 호출. 니블 ≤1 → 0xd3b78 "bat/batter_balancer", 2~3 → 0xd3b8c "bat/batter_sluger". 이미 뜬 경우 0x78c3c/0x78c4a 가 같은 식으로 0xb9c35 ("bat/batter_balancer.mpl"/"bat/batter_sluger.mpl") 호출.
- 헬멧 = 팀: ✅ 0x78c14 `r0=0xd3ba0 "bat/batter_helmet"`, r3=[sp+0x1c](팀), 피부 없음. 재적재 경로 0x78c5c 도 r2=팀.
- 0x10810 인자(팀 ldrsb [[this+0xb0]+1], r2=rec[0xb]>>4, r3=(rec[0xb]<<28)>>30, [sp]=u8 0xb63c0, [sp+4]=−1, vtable+8 → 0xcaa00 `bx r5`): ✅ `re dis 0x10810`, `re dis 0xcaa00`. vtable 0xd3a3c = [0x789a1,0x789b9,0x78ab1,0x78cf9,0x78cfd,0x78fd9] ✅. 0x78ab0 에서 [sp+0x34](=첫 스택 인자, 손) → strb [this+0x3c] ✅.
- 피부 문자열 0xd4b50/58/60 = 황인/백인/흑인 ✅.
- mpl 개수(balancer·sluger·pitcher 45, helmet·defender 15): ✅ 실제 파일 파싱 (아래 C-2).
- 피부 색 번호는 팀과 무관 / 팀 색 번호 목록 (balancer [15,18,19,23,40,56,60,70] · sluger [1,5,9,11,12,13,14,23,32,41,45,51,52] · pitcher [3~10,25]) / 피부 색 번호 개수 24·23·6: ✅ mpl 전 팔레트 비교 스크립트(verify/skinidx.py)로 같은 결과.
- event_char_0: 피부 1→팔레트 0 · 2→팔레트 1 · 0→−1(mpl 없음), 장타형 +8: ✅ `re dis 0x63a50` — 0x63a6a `[0x1552d10]==4`(타자 모드) 이고 `rec[0xb]>>4 > 1` 이면 r2=8, 0x63a7e 피부 분기 r5=0/1. 0x851a0 도 `r4 = 피부−1` ✅.
  - ❌ (1절 C-2 표 "event_char_0 … 팔레트 2 는 안 쓰임, 유력" · 3절 · 4절 5절) — **팔레트 2 를 쓰는 코드가 있다**: 0x63a04 의 인물 번호 r4(r1 인자)가 8·9 이면 `subs r3,#8; cmp r3,#1; bhi; movs r5,#2` (0x63a50~0x63a58) → 0xb998d(…, "event_char_0.mpl"(0xd2424), 팔레트 2). 인물 8·9 는 이름 규칙상 event_char_0.pzx (10~13 → event_char_1, 17~22 → event_char_2, 그 밖 → event_char_0) 이고 프레임 기준 = s16 표 0xd0ae6[8]=58, [9]=65. 즉 팔레트 2 = 주인공이 아닌 인물 8·9 전용.
- 적용 방식(0xc8c7c, 앞에서부터 덮어쓰기): ⚠️ 이번엔 0xc8c7c 본문을 읽지 않음 (포맷 쪽 0x91e58 만 확인).
- "지금 웹 스프라이트는 PZX 기본 팔레트로 뽑혀 **전부** 팀 2 유니폼·황인": 📝 — 4절(5절 표)은 pitcher 기본 팔레트 = mpl **0 (팀 0·황인)** 이라고 적었고, 바이트 대조(verify/pzxdef.py: mpl 팔레트 바이트열을 pzx 원문·zlib 풀린 블록에서 찾기) 결과도 balancer·sluger·helmet·defender = 2, **pitcher = 0**. 1절의 "전부 팀 2" 는 투수 몸통에선 틀림.
- 웹 주장: ✅ `CreatePlayerScreen.tsx:20` 주석 "피부는 기록만 하고 그림 팔레트는 아직 바꾸지 않는다" · `playerCareer.ts:97 readonly skinIndex` · `widgets/event-portraits` 에 피부/+8 처리 없음 (grep).

### C-2 MPL 파일 포맷
- 헤더/개수: ✅ `re dis 0x91d98` — h 1바이트, `(h>>4)−2 ≤1` 이면 u8 개수, 아니면 u16 개수 + u16×N 이미지번호 읽기.
- 색수 0=256, 0x30 → 색당 2바이트, 그 밖(0x20) 3바이트, 아래 니블 ≠0 이면 u32 하나 더: ✅ `re dis 0x91e58`~0x91eee (`cmp r1,#0 → 0x100`, `cmp r3,#0x30 → r1*2 else r1*3`, `tst h,#0xf → read 4`).
- 실제 파일 22개 전부 독자 파서(verify/mplcheck.py: 오프셋이 빈틈 없이 이어지고 끝이 파일 길이와 정확히 일치하는지 검사)로 파싱 성공: ✅
  - balancer·sluger 0x30 45×82 ✅ · helmet 15×26 ✅ · pitcher 45×41 ✅ · defender 15×48 ✅ · event_char_0 3×239 ✅ · img_text 5×3 ✅
  - game_ui 0x40 이미지 8·9 변형 8개 ✅ (색수는 이미지 8 = 4색, 9 = 3색. 4절의 "(8색)" 은 ❌ 사소 — 1절엔 없음)
  - mode_ui 0x40 이미지 0·1 변형 7, 31 변형 1 ✅ (색수 4·3·6)
  - 통팔레트 묶음 "2~8": ❌ 사소 — `ui/mode_icon.mpl` 은 팔레트 **1개**(50색). 나머지: mode_back 2 · attack 3 · defense 3 · attack_sky_cloud 8 · sky_effect_light 6 · item/* 3~6. 범위는 1~8.
  - 모든 파일 아래 니블 0 ✅ (h 가 전부 0x30/0x40).

### C-3 PZX 파트 효과
- 효과 k 분기(0xc4eb4: k−1 >0x63 건너뜀, k−5 ≤0x5f → 콜백 4): ✅ `re dis 0xc4eb0`. 콜백 = [this+0x18 + (k−1)*4] (0xc4ea6 `r5=this+0x18`, 0xc4ee4 `ldr r4,[r1,r5]`).
- 콜백 표: ✅ `re dis 0xc4d10` — +0x18 0xc5109 · +0x1c 0xc524d · +0x20 0xc4fa1 · +0x24 0xc5051 · +0x28 0xc5391. (16비트판 0xc4d54 의 +0x28=0xc8bb5 는 이번엔 따로 안 봄)
- 0xc8bb4 `subs r2,#5` → 0x91f0d(mpl, 이미지번호, k−5): ✅ `re dis 0xc8bb4`.
- 효과 3 = 좌우 · 4 = 상하 방향: ⚠️ 0xc4fa1/0xc5051 본문은 읽지 않음.
- "효과 5~0xC 는 mode_ui(0·1·31)·game_ui(8·9) 에만": ⚠️ PZX 전수 스캔은 이번에 하지 않음. mpl 이미지번호 목록(0·1·31 / 8·9)은 C-2 파싱으로 ✅.

### C-4 선수 등록 화면
- 흐름 0x65/0x66/0x67: ✅ 진입표 0xcc728 → [0x1c154, 0x10790, 0x17360, 0x10b18] (0x65 = 0x10790 · 0x66 = 0x17360 · 0x67 = 0x10b18), 갱신표 0xcc7e0 → 0x16f28 · 0x12410, 그리기표 0xcc884 → 0x15de4 · 0x15f34 · 0x162bc (`re u32`, `re dis 0x1d348`). StrMODE[2] 메시지 상자는 ⚠️ 미확인.
- 목록 크기: ✅ `re dis 0x174e4` — [0x74] vtable+0x10(1,5) · [0x78] (1,2) · [0x7c] (타자 모드==4 → 2, 아니면 3, 1) · [0x80] (2,1) · [0x84] (3,1).
- rec[0xb] 윗니블 = 2×[0x7c] + [0x80] 후 0x10810: ✅ 0x16f7c~0x16fae (`lsls r0,sel,#1`, 손 선택을 더해 `(rec&0xf)|(n<<4)`).
- 포지션 bit0-1, 투수가 1 고르면 2: ✅ 0x1705a `[this+0xcc]==3`(투수 모드) 이고 sel==1 → r1=2 (0x1707c).
- 피부 bit2-3 (0x171a0 `rec & ~0xC | sel<<2`) 후 0x10810 재호출: ✅.
- rec[0xa] 타자 0xa0 / 투수 0x80: ✅ 0x1762e/0x17632 → `strb [r1,#0xa]` 0x17634.
- 시작 능력치 0x16e2c: ✅ `re dis 0x16e2c` — 투수(타자?=0) 이고 P>1 이면 P=1; 투수 `ldrsb 0xcc3f2[P*4+i]*10`, 타자 `ldrsb 0xcc3fa[A*4+i]*10`. 타자 P≠0 → out[3](+0xc) +30, P==0 → out[2](+8) +30. 투수 A==0 → out[1] · A==1 → out[0] · 그 밖 → out[2]. 999 상한은 호출자 0x16f06 (리터럴 0x3e7) 후 `strh [rec+0xc+2i]` ✅. 표 값 ✅ (위 첫 줄).
- 웹 `playerCareer.ts:166 rookieAbilityOf`: ✅ 166행, balance.json rookieByBattingType [100,100,100,100]/[80,150,80,80] + 30 (0→수비, 그 밖→주루) — 원본 타자식과 같음.

### C-5 좌타/우타 → side
- 0xb63c0 이 등록 선수(rec[0xa]=0xa0)에서 `(rec[0xb]>>4)&1` 을 돌려준다: ✅ `re dis 0xb63c0`/`0xb6278`/`0xb63a0`. (세부: 게이트 0xb6278 은 "bit6 만" 보는 게 아니라 `(rec[0xa]&0x60)==0x60` · rec[0] 범위 · bit5/bit6 을 함께 본다. 0xa0 선수는 결국 0xb63a0 = −1 → 0xb6400 `nibble & 1` 경로라 결론은 같다.)
- 0x78ab0 이 그 값을 +0x3c 에 저장: ✅ (C-1). 0xab214 가 0xb63c0 을 직접 부름: ✅ `re xval 0xb63c1` → 0xab9f0·0xaba1e·0xabc50.
- 웹 `RALPH_PROGRESS.md:749` "side 를 1 로 둔다": ✅ 749행.

### C-6 등록 화면 배치
- 0x15f34 가 0x7f4ed 바탕 뒤 `bl 0x15e20`(기본정보 카드): ✅ `re dis 0x15f34`. 그리기표 0xcc884[1] = 0x15f34 ✅.
- 프레임 = [this+0xec] mode_ui 프레임, 타자 모드(==4) 2 / 그 밖 1: ✅ 0x15f5e~0x15f80.
- 상자 (21,176,196,83) · (30,184,25,15) · (60,184,81,15) · (147,184,25,15) · (176,184,32,15): ✅ mode_ui.pzx 프레임 2 (프레임 1 도 같음) 를 decode_pzx.read_section 으로 읽어 `i16×4` 박스 확인 (프레임 길이 검사 통과). 프레임 0 (11,53,93,117)·(122,48,107,84) ✅.
- 커서 계산: ✅ `re dis 0x15fae`~0x16062 — sel ≤1 → 상자 1·2, y += (h+2)*(sel+1); sel ≥2 → 상자 3·4, y += (h+2)*(sel−2); 사각형 = (x−1, y−1, w+2, h+2). 계산 결과 이름 (59,200,83,17) · 타입 (59,217,83,17) · 포지션 (175,183,34,17) · 손 (175,200,34,17) · 피부 (175,217,34,17) — 표와 같음.
- 깜빡임 `[this+0x2c] % 10 ≠ 0` 일 때만, 색 0x1400748(0xff,0xff,0): ✅ 0x16064~0x1607c (0xca911(timer,10) 결과 0 이면 건너뜀; 색 함수 인자 r0=0xff,r1=0xff,r2=0).
- 화살표 스프라이트 [mode_ui 프레임 목록 +0x60]: ✅ 0x160a6 `ldr r7,[r3,#0x60]` (세부는 문서대로 유력).
- 웹 `basicInfoLayout.ts` 같은 숫자: ✅ INFO_BOARD {21,176,196,83} (60행) · INFO_COLUMNS label/value x·width 30/25·60/81·147/25·176/32 (64-65행) · FIGURE_BOX {11,53,93,117} · RIGHT_PANEL {122,48,107,84}.
