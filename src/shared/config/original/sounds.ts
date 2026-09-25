/**
 * 원본 소리 52개 (`sound/%03d.mmf`) 의 번호 → 쓰임 표.
 *
 * 원본은 `0x6ea6c play(obj, n, vol, loop)` 로 즉시 틀거나 `0x6e498 request(obj, n, loop)`
 * 로 예약한다. 경로는 `0x6e9d4` 의 `sprintf("%s/%03d.mmf", "sound", n)` 이다.
 * 아래 표에서 "예약" 은 **큐가 아니다** — 한 칸짜리 자리를 덮어쓰고 울리던 소리를 끊은 뒤
 * 다음 틱에 트는 것이라 즉시와 들리는 결과가 같다 (`shared/api/audio/soundPort` 머리 주석).
 * 웹판은 SMAF 를 브라우저가 못 읽어서 `tools/extract_sounds.py` 로 미리 구워 두고
 * `public/sounds/%03d.mp3` 를 튼다 — **파일 이름의 번호는 원본 번호 그대로**다.
 *
 * 음성·효과음 26개는 파일 안의 야마하 4비트 ADPCM 을 그대로 푼 것이라 원본 소리다.
 * 나머지 26개는 커스텀 FM 음색 악보라 WildMIDI 의 MA FM 합성으로 구웠다 —
 * **음색은 근사다** (원본 칩과 귀로 대조하지 못했다). 자세한 것은 그 스크립트 머리에 적어 두었다.
 *
 * 파일이 있는 번호는 52개: 0~18 · 20~40 · 42 · 44 · 46 · 48 · 50~53 · 59~62.
 * (19 · 41 · 43 · 45 · 47 · 49 · 54~58 은 원본에 파일이 없다 — 47 은 배경음 목록에만 이름이 있다.)
 *
 * 근거: docs/re/L-sound-effects.md 1-A~1-G · docs/re/R2-game-effects.md 8절 ·
 *       docs/re/R3-field-view.md 2-1 · docs/re/R10-game-states.md · docs/re/K-bursts-special.md ·
 *       docs/re/H-modes.md · docs/re/R14-game-side-screens.md.
 * 한 번호를 여러 장면이 나눠 쓰는 곳이 많다(22 = 교체 화면 겸 대타 연출, 31/32 = 승패 겸 신기록/실패,
 * 36/37 = 경기 평가 겸 돌발미션 결과). 원본 그대로 한 줄로 묶어 두었다.
 */

/** 소리의 쓰임새. 원본이 loop=1 로 트는 것만 `bgm` 이다. */
export type SoundRole = 'bgm' | 'jingle' | 'voice' | 'effect'

export interface OriginalSound {
  /** 원본 파일 번호 (`sound/%03d.mmf`) */
  readonly id: number
  readonly role: SoundRole
  /** 무슨 소리인지 */
  readonly name: string
  /** 원본이 어디서 트는지 */
  readonly scene: string
  /** 원본에 파일은 있으나 아무 데서도 안 트는 번호 */
  readonly unused?: true
}

/**
 * 원본이 **배경음으로 취급하는 번호 전체**.
 * 이벤트 스크립트 명령 6(0x8d470)의 loop 판정 목록 {1,3,4,40,33,46,47,52,44} 그대로다.
 * 47 은 파일이 없다. 앱 재개 0x2ddc 는 이 중 1~4 만 다시 튼다.
 */
export const LOOPING_SOUND_IDS: readonly number[] = [1, 3, 4, 33, 40, 44, 46, 47, 52]

export const ORIGINAL_SOUNDS: readonly OriginalSound[] = [
  { id: 0, role: 'voice', name: '로고 "GAMEVIL"', scene: '장면 0x103 상태 2 시작 인증·로고 화면 (0x69400)' },
  { id: 1, role: 'bgm', name: '메인메뉴 배경음', scene: '장면 0x103 상태 3~5 (타이틀 뒤 메뉴)' },
  { id: 2, role: 'bgm', name: '쓰이지 않는 배경음', scene: '부르는 곳이 없다 — 앱 재개 0x2ddc 의 "1~4 다시 틀기" 범위에만 든다', unused: true },
  { id: 3, role: 'bgm', name: '모드 준비·설정 화면 배경음', scene: '0x105 상태 202 · 0x106 상태 101 · 0x107 로비' },
  { id: 4, role: 'bgm', name: '관리 화면 배경음', scene: '시즌(0x105)·나만의리그(0x106) 관리 화면' },
  { id: 5, role: 'effect', name: '강한 타구 타격음', scene: '0x51620 (0x35988 참). 환경설정에서 소리 크기를 바꿀 때 미리듣기로도 쓴다' },
  { id: 6, role: 'effect', name: '보통 타구 타격음', scene: '0x51640 (강·약 둘 다 아닐 때)' },
  { id: 7, role: 'effect', name: '특수 타구 타격음', scene: '0x515ec (0x392ac 참 — 결과 24~26, 상태 19 연출)' },
  { id: 8, role: 'effect', name: '헛스윙 바람 소리 (보통)', scene: '0x51350 · 0x4e24a — 맞지 않고 필살 기술 번호가 0' },
  { id: 9, role: 'effect', name: '맞음(연출 없음, 번트로 보임)', scene: '0x51606 — 스윙 객체 +8 ≠ 0' },
  /**
   * ⚠️ 앞서 적혀 있던 "득점(홈인) 알림" 은 틀렸다 — 디스어셈으로 다시 보고 고쳤다.
   * 부르는 곳이 세 군데인데 셋 다 주루 슬라이딩 자리다 (입력은 모두 `request(소리, 10, loop=0)` = 0x6e498):
   *   - 0x5199c — 사람 키 슬라이딩 0x518da: `0xa96ec`(71~94% 온 주자 수) > 0 · 소리 안 나는 중(0x6e574) ·
   *     주자관리 +0x31c 이 0 일 때만. 바로 앞 0x51980 이 `movs r6,#0xc7; lsls r6,r6,#2`(= 0x31c)로
   *     그 칸을 읽고 1 로 쓴다 — **한 플레이 한 번 잠금**이다.
   *   - 0x519c4 · 0x5268c — 자동 슬라이딩: 제어기 `0xaf8fc`(송구가 향하는 루로 6틱 안에 닿는
   *     주자를 슬라이딩시킨 수) > 0 이면 바로.
   * 세 자리 어디에도 득점·홈인과 엮인 칸이 없다. 근거: docs/re/R3-field-view.md 3-1·3-2·3-3.
   * 웹은 슬라이딩 키 자체가 아직 없어 **배선하지 않았다**.
   */
  { id: 10, role: 'effect', name: '주자 슬라이딩', scene: '주루 슬라이딩 0x518da(예약 0x5199c) · 자동 슬라이딩 0x519c4·0x5268c — 한 플레이 한 번(주자관리 +0x31c 잠금)' },
  { id: 11, role: 'effect', name: '홈런 함성', scene: '판정 v8·v12 (0x51c82) + 홈런 이벤트 0xa5fed · 0x527ce 예약' },
  { id: 12, role: 'effect', name: '투구 순간 소리 (보통)', scene: '0x3f378 — 투수 단계가 공을 놓는 칸에 닿을 때' },
  { id: 13, role: 'jingle', name: '공수 교대 징글', scene: '경기 상태 0x18 갱신 0x4f7ac — 상태 틱 2 에 한 번' },
  { id: 14, role: 'effect', name: '투수 등판음 (보통)', scene: '0x38b64, 경기 상태 0xe 투수 첫 등장' },
  { id: 15, role: 'effect', name: '투수 등판음 (득점권 위기)', scene: '같은 자리에서 2·3루에 주자가 있을 때' },
  { id: 16, role: 'voice', name: '"Ball!" 볼', scene: '경기 판정 스위치 v2 (0x51ac2)' },
  /**
   * v9 가 서는 자리는 **하나뿐**이다 (0xb442a~0xb444a, 디스어셈 확인): 그 루의 야수가 `+0x3b`(루에
   * 닿아 있음) 이고 `+0xe0`(공을 쥠) 인데 아웃 판정 `0xb36d0` 이 서지 않고 주자가 들어오면 v = 9.
   * 즉 **"아웃 될 뻔했는데 살았다"** 만이고, 외야로 나간 안타는 이 길이 아니다.
   */
  { id: 17, role: 'voice', name: '"Safe!" 세이프', scene: '판정 v9 (0x51c14) — 야수가 루에서 공을 쥐었는데 아웃이 안 선 플레이 (0xb442a)' },
  /*
   * 17 을 내는 자리는 **원본에 하나뿐**이다 — 위 v9 갈래다. `0x6ea6d`(즉시)·`0x6e499`(예약)를
   * 부르는 65곳을 전수로 떠서 `movs r1,#0x11` 을 찾으면 **0x51c3a·0x51c50** 둘뿐이고 둘 다
   * 그 갈래의 두 가지다. (0x515bc·0x38e14·0xa1ebe 의 `#0x11` 은 소리가 아니라 다른 호출의 인자다.)
   * 도루도 **같은 길**이다: 도루 키(0x583)는 플레이 종류 9(0x3e07e)로 상태 0x17(수비 화면)에
   * 들어가고, 거기서 v9 가 서야 17 이 난다. 웹 도루는 주력 표 굴림 하나라 그 칸이 없어 안 이었다
   * (`features/play-at-bat/model/atBatSounds.inPlayCallSoundIdOf` 끝 주석).
   */
  { id: 18, role: 'voice', name: '"Strike!" 스트라이크', scene: '판정 v1 의 기본 갈래 (0x51aa2)' },
  { id: 20, role: 'voice', name: '아웃 콜 (루에서 잡은 포스 아웃)', scene: '판정 v13 (0x51b36) 기본 갈래 — state[0x1f]·state[0x87] 이 **둘 다 0** 일 때' },
  { id: 21, role: 'voice', name: '"Strike out!" 삼진', scene: '판정 v5 (0x51bf6) + 삼진 기록 0xa7c4d' },
  /**
   * 경기 안에서 22 를 트는 자리는 **둘뿐**이고 둘 다 교체 계열이다 (디스어셈 확인):
   *   - 0x3af06 — 상태 0xb(투수 교체 화면) 진입 0x3ae08 의 **맨 끝**, 조건 없이 `play(소리, 0x16, -1, 0)`.
   *   - 0x3da88 — 상태 0xf(타석 준비) 진입 0x3d954 에서 CPU 대타 `0xac228` 이 참이라 교체 연출
   *     상태 0x16 으로 넘어갈 때 (R10 8절 "0x3da92, 소리 0x16").
   * 경기 중 메뉴('*', 0x3c158)는 22 를 안 튼다 — 거기서 나는 것은 소리 크기 미리듣기 5 뿐이다.
   * 웹은 `#` 교체 화면(`pages/team-game`)에만 이었다.
   */
  { id: 22, role: 'voice', name: '"Time!" 타임 (투수 교체·대타)', scene: '상태 0xb 교체 화면 진입 0x3af06 · 상태 0xf 에서 CPU 대타로 교체 연출 0x16 에 들어갈 때 0x3da88 · 라인업 화면' },
  { id: 23, role: 'voice', name: '"Hit by pitch" 몸에 맞는 공', scene: '판정 v4 (0x51b08) — 진동 200ms 와 함께' },
  { id: 24, role: 'voice', name: '"Base on balls!" 볼넷', scene: '판정 v3 (0x51aca) — 이어서 조건부로 29(함성) 예약' },
  { id: 25, role: 'voice', name: '"Foul!" 파울', scene: '판정 v7 (0x51c5c) — game_judge 글자 애니 4 · 0x5284a 예약' },
  { id: 26, role: 'effect', name: '투수 등판음 (마투수)', scene: '0x38b64 에서 등판 투수가 마선수일 때' },
  { id: 27, role: 'effect', name: '헛스윙 바람 소리 (필살 스윙)', scene: '0x51350 에서 스윙 객체 +0x10 ≠ 0, 또는 마선수 타자' },
  { id: 28, role: 'effect', name: '투구 순간 소리 (마구)', scene: '0x3f378 에서 상태 0x16 이거나 마투수의 마구' },
  /**
   * **29 를 예약하는 자리는 셋이다** (리터럴 `0x6e499` 를 부르는 18곳 전수 + `movs r1,#0x1d` 대조):
   *   - `0x51b02` — 판정 v3(볼넷) 의 뒤꼬리. `state[0x31 + state[9]] == 1`, 곧 **공격 팀이 CPU 조작**
   *     일 때만 (0x51adc~0x51af8). 웹은 투수편에 이었다 (`atBatSounds.walkCheerSoundIdOf`).
   *     ⚠️ 앞서 "0x51b0e 예약(+진동 200ms)" 로 적던 것은 오독이다 — 0x51b0e 의 진동 200ms 는
   *     **판정 v4(사구 23)** 쪽이고 볼넷과 다른 갈래다.
   *   - `0x43870` — 수비 화면 선수 그리기(0x43618) 안, 선수 `+0xb8 == 6` 인 틱. `+0xb8 = 6` 은
   *     **도루 송구**가 시작될 때 포수에게 달린다 (0x3e08c~0x3e092, I-controls 3절 플레이 종류 9).
   *     같은 자리에서 `+0xec` 객체의 `+0x2e` 카운터를 1 올리고(0x270f = 9999 로 자름)
   *     `0xa755d([[sp+0x60]+0x230], 3)` 을 부른다.
   *     웹에는 도루 송구를 그리는 수비 화면이 없어 안 이었다.
   *   - `0x4c39a` — 함수 이름을 못 밝힌 자리(0x4bbb0 부근, 호출이 포인터뿐이라 진입점 미확인).
   *     번호는 `movs r6,#0x1d` (0x4c2f6·0x4c32e) 로 r6 에 실려 온다. 두 갈래 모두
   *     `[0x1552cfc] + 팀*2 + 0x44c` halfword 의 한 비트를 XOR 로 뒤집은 뒤 예약한다 —
   *     **그 비트의 뜻이 미확인**이라 웹에 안 이었다.
   */
  { id: 29, role: 'effect', name: '관중 함성 (CPU 타자의 볼넷 뒤 · 도루 송구)', scene: '볼넷 0x51b02(공격팀이 CPU) · 도루 송구 0x43870(선수 +0xb8 == 6) · 0x4c39a(조건 미확인)' },
  /**
   * **30 을 예약하는 자리는 둘이고, 둘 다 웹에 안 이었다.**
   *   - `0x4657a` — 수비 화면(상태 0x17) 진입 0x46418 안. 조건은
   *     `state[0x11] != 0` (0x46544) **그리고** 2루·3루에 주자(`0xa97a1(필드, 2|3)`, 0x46550·0x4655c)
   *     **그리고** `0x357e0`(타구 결과 코드 24~26 = 홈런성)이 거짓.
   *     ⚠️ 그런데 `state[0x11]` 을 **1 로 만드는 코드를 못 찾았다** — 짝수 정렬 전수 검색으로
   *     `strb r_,[r_,#0x11]` 은 세 곳뿐이고(0xb67f4·0xb683a 는 플레이 초기화의 **0 쓰기**,
   *     0xa88c0 은 다른 구조체), 레지스터 오프셋 쓰기(`movs rX,#0x11` → `strb rd,[rn,rX]`)도 0곳이다.
   *     읽는 곳도 0x46544·0x464a8(둘 다 같은 함수) 뿐이다 → **원본에서 이 갈래는 서지 않는 것으로 보인다**(유력).
   *   - `0x51fd2` — 경기 장면 메시지 핸들러(0x509a0)의 **메시지 0x13** 갈래(0x50a7a → 0x51fb8).
   *     인자 p1(`[sp+0xec]`)은 주자 번호이고 그 갈래는 주자에게 `+0x78+0x1d`(득점/세이프)·`+0x1e`(끝남)
   *     을 세운다 → **주자 한 명이 들어오는 알림**으로 보인다. 소리는 `0x357e0` 이 참이면 **60**,
   *     아니면 **p1 == 0 일 때만 30** 이다. **p1 == 0 이 어느 주자인지 미확인**이라 안 이었다.
   */
  { id: 30, role: 'effect', name: '관중 함성 (주자가 들어올 때 · 수비 화면 진입)', scene: '0x51fd2 예약 — 주자 알림 메시지 0x13 에서 홈런성이 아니고 주자 번호 0 일 때 · 0x4657a 예약 — state[0x11] 조건이 서지 않아 실제로는 안 우는 것으로 보임' },
  { id: 31, role: 'jingle', name: '승리 징글 · 신기록(0x1f)', scene: '경기 결과 승리 · 홈런더비 최고 비거리 갱신(0x4f574) · 최고 기록 저장 +0x5c 갱신' },
  { id: 32, role: 'jingle', name: '패배 징글 · 기록 실패(0x20)', scene: '경기 결과 패배 · 신기록이 아닐 때 · 돌발미션 결과 1(실패)' },
  { id: 33, role: 'bgm', name: '경기 배경음', scene: '경기 장면 0x104 상태 0x21 자동진행 중계 (0x3abf0) · 0x48480 · 0x4258c' },
  { id: 34, role: 'effect', name: '용도 미해결', scene: '경기 장면 0x52392 갈래 — 장면을 못 밝혔다' },
  { id: 35, role: 'effect', name: '돌발 결과 보상 (등급 3·4)', scene: '돌발 결과 대사 394·395' },
  /**
   * 평가 창이 보는 값은 레코드 `+0x4a` = **직전 경기 인기도 변화 p** 로 확정돼 있다
   * (A 0절 "지난 경기 인기도 변화 (0xa68ca 가 쓴다) 확정" · P1 5-2 정정). 앞서 L 노트가 적던
   * "값의 뜻 미해결" 은 낡았다. 웹 값은 `useCareerSession` 의 `evaluation.popularityChange` 다.
   * 문턱은 시즌모드(0xdece) 3 · 나만의리그(0x12cb6) 1.
   */
  { id: 36, role: 'jingle', name: '경기 평가 "좋음" · 돌발미션 성공(0x24)', scene: '경기 뒤 평가 창(시즌 0xdea0 = 0x105 상태 233 · 나리 0x12c96 = 0x106 상태 116) 인기도 변화 p 가 문턱 초과 · 돌발 결과 2 · 돌발 결과 대사 393' },
  { id: 37, role: 'jingle', name: '경기 평가 "보통" · 돌발미션 무효(0x25)', scene: '평가 창 p 가 0~문턱(시즌 3 · 나리 1) · 돌발 결과 3 (보상·페널티 없음)' },
  /**
   * 36·37·38 을 예약하는 자리는 **두 화면**이고 문턱만 다르다. 이제 둘 다 이었다:
   *   - 나만의리그 상태 116 `0x12c96`(문턱 1) → `app/model/useCareerSession.evaluationJingleIdOf`
   *   - **시즌 상태 0xe9** `0xdeae~0xdede`(문턱 3, `0xdece cmp r3,#3`)
   *     → `app/model/useSeasonSession.seasonEvaluationJingleIdOf` (관중수입 창이 뜨는 자리)
   */
  { id: 38, role: 'jingle', name: '경기 평가 "나쁨"', scene: '평가 창 p 가 음수 (나리 0x12ca4 · 시즌 0xdebc)' },
  { id: 39, role: 'voice', name: '"Strike two!" 스트라이크(카운트 2)', scene: '판정 v1 에서 [sp+0xa4]+4 == 2' },
  { id: 40, role: 'bgm', name: '이벤트(스토리 대화) 배경음', scene: '0x106 상태 114 · 0x105 상태 211' },
  { id: 42, role: 'effect', name: '돌발미션 시작 (0x2a)', scene: '후보 추첨 뒤 대사 로드 0x8eba0 · 0x8e2dc' },
  { id: 44, role: 'bgm', name: '용도 미해결 (loop 목록에 든다)', scene: '0x3a8e0 끝에서 예약 — 무엇을 기록하는 함수인지 못 밝혔다' },
  { id: 46, role: 'bgm', name: '엔딩 배경음', scene: '0x106 상태 141 엔딩 화면 · 0x105 상태 245 예약' },
  { id: 48, role: 'effect', name: '용도 미해결', scene: '부르는 곳을 못 찾았다' },
  { id: 50, role: 'effect', name: '용도 미해결', scene: '부르는 곳을 못 찾았다' },
  { id: 51, role: 'effect', name: '돌발 결과 페널티', scene: '돌발 결과 대사 396 (인기도 −5 · 평판 −4)' },
  { id: 52, role: 'bgm', name: '용도 미해결 (loop 목록에 든다)', scene: '이벤트 스크립트 명령 6 의 loop 목록에만 있다' },
  { id: 53, role: 'effect', name: '선수 넘어짐 / 공 놓침(펌블)', scene: '야수 동작 0xd (0xa1e60) — +0xb4 = 15 동안 먼지·고리 애니' },
  { id: 59, role: 'effect', name: '약한 타구(빗맞음) 타격음', scene: '0x5163a (0x39304 참)' },
  /**
   * ⚠️ 앞서 적혀 있던 "홈런더비 쪽"·"모드 7"·"경기 상태 0x18·0x19·0x1a" 는 **둘 다 틀렸다** —
   * 디스어셈으로 다시 떠서 고쳤다.
   *   - `0x528b0` 은 홈런더비가 아니라 **인플레이 수비 화면(경기 상태 0x17)** 이다 (R10 2-1).
   *   - `0x357e0` 이 보는 `[경기+0xfd4]` 는 경기 상태가 아니라 **타구 결과 코드**다
   *     (E 2-1a · R15 9-1 · R2 3-3 — 24~26 = 홈런성 가운데·좌·우). 같은 줄이 0x392c2 에도 있다.
   * 실제 두 자리는 이렇다:
   *   - 0x51fc4 — 결과 코드가 홈런성이면 **60**, 아니면(그리고 [sp+0xec] 가 0 일 때) **30**.
   *   - 0x52bb2 — 공+0xaa0(낙구 틱) == 공+0x68(지금 틱) · 공+0xac4(낙구점이 홈에서 10274 넘게
   *     떨어진 페어 타구, P2 2절) · 결과 코드가 홈런성이 **아님** · 플레이+0x113(낙구 틱에 아무도
   *     못 잡음, P2 2절 0xb4492) 일 때 즉시 재생.
   * 웹은 뒤쪽(0x52bb2)만 이었다 — `features/play-at-bat/model/atBatSounds.deepHitCheerSoundIdOf`.
   * 틱 단위 낙구가 없어 **우는 때는 근사**다 (수비 플레이가 끝나는 자리).
   */
  { id: 60, role: 'effect', name: '관중 함성 (깊은 타구가 떨어질 때)', scene: '0x52bb2 즉시 — 깊은 페어 타구를 아무도 못 잡고 떨어지는 틱 · 0x51fc4 예약 — 결과 코드가 홈런성일 때' },
  { id: 61, role: 'effect', name: '타석 시작', scene: '경기 시작 인트로 상태 0xc · 상태 12 진입 0x3b084 에서 예약' },
  /**
   * ⚠️ 앞서 적혀 있던 "v13 의 **특수 모드** 갈래" 는 오독이다 — `0x1552d0c` 는 모드 플래그가 아니라
   * **경기 상태 구조체 포인터**고, 0x51b36 이 보는 두 칸은 **이번 플레이의 아웃 종류**다:
   *   - `state[0x1f]` = 바운드 없이 잡은 아웃 (0xb2774 가 `vt90()==1` 일 때 1, 0xb67fe 초기화,
   *     0xb323c·0xb33b6 이 튕길 때 0)
   *   - `state[0x87]` = 아웃 판정 0xb36d0 결과가 3(태그성, 0xb394e) 이거나 2 + 야수 `+0x3b`(0xb4312)
   * v11 은 조건 없이 62 이고, 그 v11 은 **2스트라이크 번트 파울 아웃**(0x9d5e2~0x9d600)이다.
   * 그래서 62 = 잡아서·태그해서 낸 아웃 + 번트 파울 아웃, 20 = 루에서 잡은 포스 아웃.
   *
   * **v11 몫도 이제 이었다.** 웹은 그 아웃을 `직선타아웃` 으로 옮겨 수비 화면을 한 번 거치는데,
   * 그대로 두면 수비 진행기 결과(`caughtOnTheFly`)에 끌려 20 으로 샐 수 있었다.
   * `battedBallOutcome.isBuntFoulOut` → `PitchOutcomeDetail.isBuntFoulOut` →
   * `DefensePlayInput.buntFoulOut` → `DefenseCallContext.buntFoulOut` 으로 실어 보내
   * **조건 없이 62** 를 내게 했다 (나만의리그 타자편 `useCareerSession`).
   * ⚠️ 팀경기 쪽(`features/play-team-game`)은 아직 그 표를 안 싣는다.
   */
  { id: 62, role: 'voice', name: '아웃 콜 (잡아서·태그해서 낸 아웃)', scene: '판정 v11 (0x51b20, 2스트라이크 번트 파울 아웃) · v13 에서 state[0x1f] 나 state[0x87] 이 선 갈래' },
]

/** 번호로 찾기. 표에 없는 번호(= 원본에 파일이 없다)는 undefined. */
export function findOriginalSound(id: number): OriginalSound | undefined {
  return ORIGINAL_SOUNDS.find((sound) => sound.id === id)
}

/** 원본이 loop=1 로 트는 번호인가 (= 배경음인가). */
export function isLoopingSound(id: number): boolean {
  return LOOPING_SOUND_IDS.includes(id)
}

/** `sounds/%03d.mp3` — 원본 `sprintf("%s/%03d.mmf", dir, n)` 를 그대로 옮긴 것. */
export function soundFileUrl(id: number, baseUrl = 'sounds'): string {
  return `${baseUrl}/${String(id).padStart(3, '0')}.mp3`
}
