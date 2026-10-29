/**
 * 시즌모드(구단 운영, 장면 0x105)의 시즌 레코드 SR.
 *
 * 근거: `docs/re/P4-season-flow.md` 0·1a·1c 절, `docs/re/R13-season-leftovers.md` 8·10 절,
 * `docs/re/S3-stadium-items.md` 2 절, `docs/re/S4-season-reputation.md` 2 절.
 * 원본 SR 은 `0x1f55c(저장)` = `[저장+0xb4] + 0x11c` 이고, 리그 레코드 L = **SR+0x80** 이다
 * (R13 8절 — P4·P5 가 따로 쓰던 두 오프셋이 같은 칸이었다).
 *
 * 각 칸 옆 주석의 `+0x..` 가 원본 오프셋이다. 리그(순위·일정·포스트시즌)는 여기 담지 않고
 * `entities/league` 를 그대로 쓴다 — 같은 값을 두 곳에 적어 두면 한쪽만 고쳐진다.
 *
 * **팀 사기는 SR 이 아니라 팀 레코드 +2 (s16, 0..100)** 다 (P4 1a: `0xa3a24` 가
 * `0x1f988(저장, SR[1])+2` 를 읽는다). 그래서 `SeasonState.teamMorale` 로 따로 뺐다.
 */
export interface SeasonRecord {
  /** SR[1] — 내 팀 번호 (0~9) */
  readonly teamId: number
  /** SR+0x17c — 구단 이름 (원본은 8바이트 + 끝 0) */
  readonly name: string
  /** SR+2 (s16) — 소지금, **100만 원 단위** 0~9999 */
  readonly money: number
  /** SR+4 — 이번 관리 메뉴에서 트레이닝·외출 중 하나를 썼는가. 경기마다 지운다(0x4f158) */
  readonly acted: boolean
  /** SR+5 — 팀 질병 종류 (0 건강, 1~4 = StrMODE[185+종류]) */
  readonly illness: number
  /** SR+6 — 입원 실패 여유 칸. 0 이면 다음 입원은 반드시 낫는다 */
  readonly illnessSlack: number
  /**
   * SR+8 ~ SR+0x47 — **본 이벤트** 비트 512칸(u64 × 8, 이벤트 id 64개씩). 읽기 `0xb6e80` · 켜기 `0xb6ec0`.
   * 웹은 켜진 id 목록으로 든다. 반복 이벤트(490)의 비트는 장면 0x105 를 만들 때마다(`0x3b14` → `0x8ce94` →
   * `0xacf60`) 지워진다 — 경기 뒤에도 장면이 새로 만들어지므로 경기마다 다시 뜰 수 있다.
   */
  readonly seenEvents: readonly number[]
  /** SR+7 — 직전 경기의 사기 변화 (0xa7442) */
  readonly lastMoraleChange: number
  /** SR+0x48 (s16) — 인기도 0~9999 */
  readonly popularity: number
  /**
   * SR+0x4a (s8) — **직전 경기 인기도 평가 d** (0xa68cc).
   * ⚠️ J 4-7 은 이 칸을 "연승" 으로 읽었지만 연승이 아니다 (P4 7절 정정).
   * 관중 수 계산의 "연승 보정" 이 읽는 칸이 바로 이것이다.
   */
  readonly lastPopularityChange: number
  /** SR+0x50 — 진행 단계(phase). 값 뜻은 `seasonStateMachine.ts` 의 `SEASON_PHASE` */
  readonly phase: number
  /**
   * **웹 전용** — 이 경기의 관중수입 창(0xe9) 정산(구내매점 −1)을 이미 했는가. 원본 버그 B-29(0xe9 에서 끄고 이어하면 정산을 다시
   * 탄다)의 고친 길만 쓴다: 0xe9 진입이 세우고 정규시즌 경기 끝(phase 2)이 내린다. 없으면 아직 안 한 것(옛 저장 · 원본 길)
   */
  readonly incomeSettled?: boolean
  /** SR+0x54 — 상대 투구 목표점 보기가 남은 경기 수 (99 상한, 경기마다 −1: 0x4f38c) */
  readonly aimVisionGames: number
  /** SR+0x55 — 구내매점이 남은 경기 수. 살 때 45, 경기마다 −1 (R13 10절) */
  readonly storeGames: number
  /** SR+0x56 — 이번 주기에 트레이드를 썼는가 (GP 아이템 칸 5 가 0 으로 되돌린다) */
  readonly tradeUsed: number
  /**
   * SR+0x185 (s8) — 채용한 코치 칸. **−1 = 없음**, 0~4 마투수 · 5~9 마타자 (J 4-2·4-3).
   * 경기 능력치에 정액 보너스가 붙는다 (`gameAbilities.coachBonusOf`).
   *
   * ⚠️ 원본이 이 칸을 **−1 로 두는 자리**는 문서에 없다(새 시즌 초기화 0x5758 은 안 건드리고
   * 0x204e0 의 초기화 값만 유력). J 4-2 가 "−1 = 없음" 이라 기본값을 −1 로 둔다 — **근사다**.
   */
  readonly coach: number
  /**
   * SR+0x58+칸 — **팀 트레이닝** 서브 아이템 4칸 (투구·타격·집중·근성, J 4-6 "해당 칸 상승 +2").
   *
   * 서브아이템 상점은 이 칸들을 `rec[0x58 + 줄×5 + 칸]` 2×5 격자로 다룬다 (R12 (나) 확정) —
   * 줄 0 이 0x58~0x5c(트레이닝 4칸 + 자동안마기), 줄 1 이 0x5d~0x61(외출 5칸)이다.
   */
  readonly trainingSubItems: readonly boolean[]
  /**
   * SR+0x5d+p — **외출** 서브 아이템 5칸 (장소 p 별로 하나, 점프표 0xcbe6c).
   * ⚠️ 예전에는 이 칸을 0x58 로 적어 트레이닝 칸·자동안마기와 겹쳐 있었다 (P4 3절·R12 로 정정).
   */
  readonly outingSubItems: readonly boolean[]
  /** SR+0x5c — 자동안마기 (팀 트레이닝 사기 감소 −1) */
  readonly massager: boolean
  /** SR+0x62 (s16) — 평판 0~999 */
  readonly reputation: number
  /** SR+0x64 — 직전 경기 평판 등급 g (−2~+6) */
  readonly lastReputationGrade: number
  /** SR+0x65 — 만원 판정 0·1·2 (관중 그림 단계로 보임, 유력) */
  readonly crowdLevel: number
  /** SR+0x66 — 직전 경기 수입 (100만 단위, 0~9999) */
  readonly lastIncome: number
  /** SR+0x78 — 시즌이 시작할 때 떠 둔 인기도. 목표 ⑤ "인기도 상승" 이 이것을 뺀다 */
  readonly popularityAtSeasonStart: number
  /**
   * SR+0x7a — **정규시즌 1위 횟수** (0xb82c6 에서만 +1).
   * ⚠️ J 4-8 은 "우승 횟수" 로 읽었지만 한국시리즈 우승은 세지 않는다 (P4 7절 정정).
   */
  readonly regularSeasonFirsts: number
  /** SR+0x7c — 질병 쿨다운. 치료하면 20, 경기마다 −1 (0x4f3a2) */
  readonly illnessCooldown: number
  /** SR+0xb2 = L+0x32 — 이번 시즌(또는 포스트시즌 시리즈)에서 치른 경기 수 */
  readonly games: number
  /** SR+0xb3 — **0-기준** 연차 (0 = 1년차, 9 = 10년차) */
  readonly yearIndex: number
  /** SR+0xb4 = L+0x34 — 포스트시즌 진행 중 */
  readonly inPostseason: boolean
  /** SR+0xb5 = L+0x35 — 포스트시즌 라운드 (2 준PO → 1 PO → 0 KS, −1 이면 끝) */
  readonly postseasonRound: number
  /** SR+0xb7 = L+0x37 — 우승팀 (0xf = 미정) */
  readonly postseasonChampion: number
  /**
   * SR+0x12c = L+0xac — **국가대항전 진행 중** 플래그.
   * ⚠️ P1 이 "포스트시즌 플래그" 로 적은 것은 틀렸다 (P5 확정).
   * 대회 시작(상태 242 `0xe600`)에 1, 새 해 `0x6e0c` 의 리그 초기화 memset 에서 0 이 된다 (`startNextYear` 참고).
   */
  readonly nationalCup: boolean
  /** SR+0x144 — 국가대항전 우승국 (10 = 대한민국) */
  readonly nationalCupChampion: number
  /** SR+0x1a0..0x1af — 이번 경기의 평판 기록 16칸 (u8). `seasonReputation.ts` 가 다룬다 */
  readonly gameRecord: readonly number[]
  /**
   * SR+0x187 — **올해의 목표 창을 봤는가**. 관리 메뉴에 들어올 때(0x4efc 끝 0x4ffc) SR+0x1bc 와 이 칸이 둘 다 0 이면
   * 연초 목표 0xd4 로 간다. 목표 창이 닫히면 `0x7fe90` 이 1 로 켜고 저장한다. 새 시즌 0x5758 · 새 해 0x6e0c 가 0 으로 되돌린다.
   */
  readonly yearGoalShown: boolean
  /** SR+0x1b0 / +0x1b4 — 직전 경기 관중 수 */
  readonly lastAttendance: number
  /**
   * SR+0x1bd / SR+0x1be (s8) — 직전 경기 내 팀 득점 · 실점. 경기 끝 0x4ea0c 의 4f15a~4f19a 가 모드 2 경기마다
   * `0xb69b0(경기, 내 칸)` · `0xb69b0(경기, 1 − 내 칸)` 를 바이트로 쓴다. 0xe9 의 기록 줄(`seasonGameEvaluationLineOf`)이 읽는다
   */
  readonly lastGameScore: number
  readonly lastGameConceded: number
  /**
   * SR+0x1c0 ~ +0x20f — **같은 날 리그 다섯 경기의 대진·점수** (s32 × 20 = A[5] · B[5] · scoreA[5] · scoreB[5]).
   * 경기 끝 CPU 경기 `0xc2a48` 이 끝에서(c2be0~c2c14) **모드 2 이고 국가대항전(L+0xac)·포스트시즌(L+0x34)이
   * 아닐 때만** 자기 표(경기 객체 +8, 0x50 바이트)를 통째로 복사한다 — 뜻은 `entities/league` 의 `LeagueDayBoard`.
   * 내 경기 줄은 점수가 −1 이다. 경기 뒤 마무리 판(0xf1 그림 0xb400)이 읽는다.
   */
  readonly dayBoard: SeasonDayBoard
  /**
   * SR+0x17a (s16) — **CPU 트레이드 요청이 온 횟수**. 경기 뒤 마무리 0xf1 진입 `0x953c` → `0x93c8` 이 10% 를 맞히면
   * 상대·선수를 고르기 **전에** +1 한다(940e) — 맞는 내 선수를 못 찾아 요청이 사라져도 센다. 자르기 없음.
   */
  readonly tradeRequestCount: number
  /** SR+0x188 + 7×종류 + 칸 — 구장 아이템 보유 플래그 21칸. `stadiumItems.ts` 참고 */
  readonly stadiumOwned: readonly boolean[]
  /** SR+0x1b8 / +0x1b9 / +0x1ba — 지금 장착한 관중석 · 전광판 · 잔디 칸 */
  readonly stadiumEquipped: readonly number[]
  /**
   * SR+0x1bc — **엔딩까지 본 다 끝난 시즌** 표시.
   * 10년차 엔딩 그리기 `0x8bd8` 의 8ccc~8d2c 가 보너스를 받고 키로 넘긴 단계 1 의 화면 전환이 끝날 때 켜고 저장한 뒤 관리 메뉴
   * 0xc9 로 간다(직접 떴다). 서 있으면 진입 분기(0xcb)가 phase 를 보기 전에 무조건 관리 메뉴로 보내고, 연초 목표 상태(0xd4)도 막는다.
   */
  readonly endingSeen: boolean
  /**
   * SR+0x7b — **엔딩 보너스를 받았다** (나리 S+0x7b 와 같은 뜻, 직접 떴다). 쓰는 곳 둘:
   * 엔딩 0xf5 진입 0x6be8 의 6c12~6c2e(판정 0 이면 1 · 저장 — 보너스 표 0xcbc2e[0] 이 0 이다)와 보너스 팝업 0x2b 를 닫는
   * 0x8bd8 의 8c54~8c5c(G += 0xcbc2e[e] × 1000 · 전역기록 저장 뒤 1 · 저장). 읽는 곳은 0xf5 의 키 0x6b3c 하나 — 서 있으면
   * 보너스 팝업 없이 단계 1 로 넘기고(6b52~6b6e), 아니면 팝업 0x2b(StrMODE[214]). 0 으로 쓰는 곳은 없다(바이너리 전체 `adds #0x7b ; strb` 훑기 — 2b77ae0).
   */
  readonly endingBonusReceived: boolean
}

/**
 * SR+0x1c0 하루 점수표 — `LeagueDayBoard`(entities/league) 와 같은 모양이다.
 * 시즌 레코드가 리그 모듈의 타입에 묶이지 않게 여기서 따로 적는다(값은 그대로 옮겨 담는다).
 */
export interface SeasonDayBoard {
  readonly teamsA: readonly number[]
  readonly teamsB: readonly number[]
  readonly scoresA: readonly number[]
  readonly scoresB: readonly number[]
}

/**
 * 시즌모드가 함께 들고 다니는 상태.
 * 원본에서는 SR·팀 레코드·리그 레코드가 서로 다른 구조체라 여기서도 나눠 두었다.
 */
export interface SeasonState {
  readonly record: SeasonRecord
  /** 팀 레코드 +2 (s16, 0..100) — 내 팀 사기 */
  readonly teamMorale: number
  /**
   * 팀 레코드 +4 · +6 · +8 · +0xa — 리그 10팀의 능력치 4칸.
   * 새 해마다 **CPU 9팀만** 각 칸 +30 (999 상한) 된다 (P4 1c, 0x6e0c).
   */
  readonly teamAbilities: readonly (readonly number[])[]
}
