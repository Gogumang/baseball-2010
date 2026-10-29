import type { WorldPoint } from '@/entities/fielding/model/fieldGeometry'

/**
 * 수비 시뮬레이션이 읽는 상태 묶음.
 *
 * 원본은 경기 장면 +0x200 의 "플레이" 객체(vtable 0xd8618) 하나에 야수 9명(+0x18)·주자관리(+0x20)·
 * 공(+0x24)·경기 상태(+0x28)를 달아 두고 매 틱 돌린다. 여기서는 그 칸들을 읽기 전용 구조체로 옮긴다.
 * 칸 이름 옆의 `+0x..` 는 원본 오프셋이다 (P2 0·2b·4절 · S7 5절 · S8 0절).
 */

/** AI 상태 분기표 0xd8808 (16칸) 의 번호 — P2 1c · S8 1·2·3절 */
export const AI_STATE = {
  /** 대기 — 시작 위치 0xd86ec[칸] 으로 돌아간다 */
  IDLE: 0,
  /** 공 쫓기 */
  CHASE: 1,
  /** 루 커버 (상태 − 2 = 루 번호) */
  COVER_HOME: 2,
  COVER_FIRST: 3,
  COVER_SECOND: 4,
  COVER_THIRD: 5,
  /** 공을 직접 들고 루로 뛰기 (0xb2c90 이 커버가 없을 때 세운다) */
  CARRY: 6,
  /** 협살 (0xb48b6) */
  RUNDOWN: 8,
  /** 송구 받기 대기 — 도착 틱이 송구 도착 틱 이하가 될 때까지 송구를 미루는 게이트 (0xb4838) */
  RECEIVE: 9,
  /** 동작 중 — 분기표가 아무것도 안 하는 칸 (6·7·0xa·0xd 가 0xb4c60 으로 간다) */
  BUSY: 0xa,
  /** 목표 +0x90 으로 (0xb4b5c) — 0xb3b38 담장 갈래가 세운다: 공이 담장선을 먼저 넘으면 담장 앞 공점(aa4 − 2)으로 */
  PICK_UP: 0xb,
  /** 외야 백업 (0xb4b78) */
  BACKUP: 0xc,
  /** 비필살 다이빙 (0xb46e2) */
  DIVE: 0xd,
  /** 견제 송구 — 플레이.vt58(state[0x27]) (0xb47da) */
  PICKOFF: 0xe,
  /** 시작 위치로 돌아가기 (0xb4c2a) */
  RETURN: 0xf,
} as const

/** 없음을 뜻하는 −1 (루·야수 번호 칸 모두 이 값을 쓴다) */
export const NONE = -1

export interface FielderState {
  /** 수비 칸 0~8 (+0x88). 0 투수 · 1 포수 · 2 1루수 · 3 2루수 · 4 3루수 · 5 유격수 · 6~8 외야 */
  readonly slot: number
  /** 현재 위치 (+0x20) */
  readonly position: WorldPoint
  /** 목표점 (+0x2c) */
  readonly target: WorldPoint
  /** 달리기 속도 (+0x3c). 원본은 9명 모두 220 이다 */
  readonly speed: number
  /** 목표 루 (vt68 = 0xa0b4c). 없으면 −1 */
  readonly targetBase: number
  /** 공을 쥐고 있는가 (+0xe0) */
  readonly holdingBall: boolean
  /** AI 상태 (+0x84) */
  readonly aiState: number
  /**
   * **+0x90 — AI 0xb 의 목표점** (r214, 직접 뜸). 고르기 0xb3b38 의 담장 갈래(b3e96~b3eba)가 담장 앞 공점(aa4 − 2)의 (x, 0, z) 를
   * 여기에만 적고 목표 +0x2c 는 안 건드린다. AI 고리 b4b5c 가 매 틱 이 점을 [sp+0x40] 에 베껴 b482e vt14(관문 — 잠금 +0xb4 · vtc8)로
   * 목표에 적는다. 없으면 아직 안 적힌 칸이다
   */
  readonly pickUpPoint?: WorldPoint
  /** 진행 중인 동작의 남은 틱 (+0xc8) */
  readonly actionRemainingTicks: number
  /** 도착 틱에 더해지는 여유 (+0xcc). vtc0 = 남은 이동 틱 + 이 값 */
  readonly arrivalSlackTicks: number
  /** 동작 잠금 카운트 (+0xb4). 0 보다 크면 다른 동작을 못 받는다 */
  readonly actionLockTicks: number
  /** 동작 번호 (+0xa8) — vt44 0xa1234 만 바꾼다 (`fielderPose`) */
  readonly action: number
  /** 동작 프레임 (+0xac) — 야수 틱 머리가 하나씩 올리고 vt44 가 번호를 바꿀 때 0 (`fielderPose`) */
  readonly actionFrame: number
  /** 자세 워드 +0xb0 의 네 바이트 (`fielderPose.POSE` 비트). 0 이 아니면 vtC4 · vtcc 가 거짓이다 */
  readonly pose: number
  /** 경기용 수비 능력치 등급 0~7 (0xbbe98). 칸 0(투수)은 선수가 없어 g = 2 에 맞춘 1 이다(`UNSEARCHED_FIELDER_SLOT`) */
  readonly defenseGrade: number
  /**
   * **지난 송구의 속도 +0xdc** — 송구 틱 0xa1adc(야수 vtbc)가 읽는 v 다.
   * 판 시작(플레이 vt20 = 0xb0fb4 → 0xa0fc4)이 +0xd4 로 되돌리고, 던질 때마다 0xa1620(a16dc~a16ec)이
   * 특수 ? +0xd8(130%) : +0xd4 로 덮어쓴다 — 곧 특수 송구 뒤에는 그 판이 끝날 때까지 130% 로 잰다(원본 그대로).
   */
  readonly throwSpeed: number
  /** 송구 공 속도 +0xd4 (0xa0fc4: cfg+0x1a 940 + cfg+0x2a 8 × (등급+1) + 팀 보너스). +0xd8 = 이 값 × 130 / 100 */
  readonly baseThrowSpeed: number
}

export interface RunnerState {
  /** 주자 번호. 0 = 타자주자 */
  readonly index: number
  /** 현재 위치 (+0x20) */
  readonly position: WorldPoint
  /** 이번 구간의 출발점 (+0x14). 진행률·전체 틱(0xbf01c)의 분모가 된다 */
  readonly legStart: WorldPoint
  /**
   * **마지막으로 닿은 루 = 지금 발을 붙이고 있는(있었던) 루 — 원본 `+0x8c`**.
   *
   * 정정: 예전 주석은 이 칸을 `+0x7c`, 아래 `targetBase` 를 `+0x8c` 라고 **거꾸로** 적고 있었다.
   * 원본 세 자리가 한목소리로 반대를 가리킨다 (전부 직접 뜬 것):
   * - `0xa04e8`(vt90, 구간 진행률): `100 − 100 × 거리(루[+0x7c], 지금) / 거리(루[+0x8c], 루[+0x7c])`
   *   — 곧 **+0x8c 에서 +0x7c 로 가는 중**이고 +0x7c 에 닿으면 100 이다.
   * - `0x9ff40`(달리는 방향 그림): `(g,s) = ([+0x8c],[+0x7c])` 짝이 (0,1)(1,2)(2,3)(3,4) 일 때
   *   앞으로 가는 그림이고, `s==0 && g==3 → s=4` · `s==3 && g==0 → g=4` 로 홈을 4 로 고쳐 쓴다.
   * - `0xaa12a`(득점): `주자+0x3b(도착) && [+0x8c] == 4` 를 홈 밟음으로 센다.
   * 그래서 "루 b 의 주자"(`0xa97a0`)도 `+0x8c == b` 로 찾고, `0xa9e98` 은 `+0x88 = +0x90 = +0x8c`
   * 로 주자를 제자리에 앉힌다.
   *
   * 이 모델은 `startLeg` 가 구간을 시작할 때, 그리고 **도착할 때**(0xa040c 의 `+0x8c = +0x7c`)
   * 이 칸을 갱신한다.
   */
  readonly startBase: number
  /** 반드시 밟아야 할 루 (+0x88). 없으면 −1 */
  readonly requiredBase: number
  /** **지금 달려가는 루 — 원본 `+0x7c`** (`0xa0a18` 이 이 루의 좌표를 이동 목표 +0x2c 로 세운다) */
  readonly targetBase: number
  /** 투구 때 있던 루 (+0x90) */
  readonly pitchBase: number
  /** 판정끝 표시 (+0x94) — 요구 루를 아직 안 밟았다 */
  readonly settled: boolean
  /** 득점 표시 (+0x95) */
  readonly scored: boolean
  /** 아웃 (+0x96) */
  readonly isOut: boolean
  /** 이번 타석의 타자주자인가 (+0x98) */
  readonly isBatterRunner: boolean
  /** 슬라이딩 중 (+0xb8) */
  readonly sliding: boolean
  /** 이동 속도 (+0x3c) */
  readonly speed: number
}

/** 수비 플레이 객체(경기 장면 +0x200) 의 읽기 전용 그림자 */
export interface PlayView {
  /** 플레이 종류 (+0x118). 1 타구 · 2 볼넷 밀어내기 · 4 견제 · 5 주자만 · 8 홈런더비 · 9 폭투/도루 송구 */
  readonly kind: number
  /** 루 0~3 을 커버하는 야수 번호 (+0xf0, 4칸). 없으면 −1 */
  readonly coverOfBase: readonly number[]
  /** 공을 쥔(쫓는) 야수 **번호** (+0x130). 포인터가 아니다 — S8 정정 1 */
  readonly ballHolderSlot: number
  /** 포구할 야수 번호 (+0x170) */
  readonly catchFielderSlot: number
  /** 포구 종류 (+0x16c) */
  readonly catchKind: number
  /** 포구 틱 (+0x174) */
  readonly catchTick: number
  /** 포구 동작 시작 틱 (+0x176) */
  readonly actionStartTick: number
  /** 가장 이른 포구 가능 틱 (+0x11c) */
  readonly earliestCatchTick: number
  /** 이번 플레이에서 공이 한 번이라도 쥐어졌는가 (+0x112) */
  readonly everHeld: boolean
  /** 지금 누군가 쥐고 있는가 (+0x12c) */
  readonly held: boolean
  /**
   * 원본 +0x111 = **사건 코드 8(홈런)** 표시다 — 0xb2bc4 b2bd8 이 세운다(`playGate.eventCodeEffectOf`).
   * ⚠️ 진행기들은 이 칸을 "판이 끝났다" 표시로도 쓴다(판 진행 관문 0xb0d28 이 닫으면 참). 타구 진행기는 홈런 칸을
   * `DefensePlayState.homeRunFlag` 로 따로 들고 자동 진루(`autoAdvanceDecisions`)에 넘길 때만 이 칸에 넣는다.
   */
  readonly finished: boolean
  /**
   * 자동 주루의 **또 하나의 무조건 진루 갈래** (+0x129).
   *
   * 정정: 예전 주석의 `+0x12a` 는 오프셋 오독이었다 — 0xaf918 이 직접 뜨는 자리는
   * `af964: subs r2,#7`(0x118 − 7 = **0x111**) · `af970: adds r2,#0x18`(0x111 + 0x18 = **0x129**) 다.
   * `R3-field-view.md` 도 같은 두 칸을 `+0x111`·`+0x129` 로 적고 있다.
   * 이름이 "막는 칸" 이었던 것도 거꾸로였다 — 이 칸이 서면 자동 진루가 **꺼지는 것이 아니라
   * 틱 비교 없이 무조건 한 루 간다** (`autoAdvance.ts` 참고).
   */
  readonly suppressed: boolean
  /** 송구를 해야 한다는 표시 (+0x128) */
  readonly wantsThrow: boolean
  /** 사람이 고른 송구 목표 루 (+0x160). −1 이면 자동 규칙(0xb1c90) */
  readonly manualThrowBase: number
}

/** 수비 판단 함수들이 함께 받는 한 틱 분량의 문맥 */
export interface DefenseContext {
  readonly play: PlayView
  readonly fielders: readonly FielderState[]
  readonly runners: readonly RunnerState[]
  /** 공 객체 +0x68 = 재생 중인 현재 틱 (제어기 +0x14 의 +0x68 으로도 읽힌다 — S7 정정 3) */
  readonly currentTick: number
  /** 타구 궤적의 낙구 틱 (공 +0xaa0). 높이가 처음 0 이하가 된 점 번호 */
  readonly landingTick: number
}
