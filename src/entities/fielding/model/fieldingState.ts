import { balanceNumber } from '@/shared/config/balance'
import {
  FIELDER_COUNT,
  FIELDER_SPEED,
  FIELDER_START_POSITIONS,
  abilityGradeOf,
  basePosition,
  manhattanDistance,
  ticksToReach,
  type WorldPoint,
} from '@/entities/fielding/model/fieldGeometry'

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

/** 송구 공 속도 (0xa0fc4). g = 등급 + 1, 선수가 없으면 g = 2. 940 · 8 은 숨은 판정값 표 `fielding.throwSpeedBase` · `fielding.throwSpeedPerGrade` */
export function throwSpeedOf(defenseGrade: number, teamBonus = 0): number {
  return balanceNumber('fielding.throwSpeedBase') + balanceNumber('fielding.throwSpeedPerGrade') * (defenseGrade + 1) + teamBonus
}

/** 악송구 보정 +0xe4 = cfg+0x2c(2) − 등급 + 8 = 10 − 등급 (0xb0fb4) */
export function throwErrorBiasOf(defenseGrade: number): number {
  return 10 - defenseGrade
}

/**
 * **판 시작 0xb0fb4 가 선수를 찾지 않는 칸 — 투수(칸 0).** 직접 재역어셈:
 * ```
 * b1018  칸 i = 0..8:
 * b1032    cmp r4,#0 ; beq b1062          ; i == 0 → 선수 찾기(b103e 고리)를 건너뛴다 — r5(선수) = 0
 * b106a    r0 = 2 ; 선수 있으면 r0 = 0xbbe98(0xb570d(ctx, 2, 선수, 90, 1)) + 1     ; g
 * b108c    사거리 +0x8c = g × cfg+0x28 · 송구 속도 v = cfg+0x1a(940) + cfg+0x2a(8) × g  → 0xa0fc4(야수, v)
 * b10a2    r0 = 2 ; 선수 있으면 r0 = 0xbbe98(...)                                    ; **+1 이 없다**
 * b10c4    악송구 보정 +0xe4 = cfg+0x2c(2) − r0 + 8
 * b1184    선수를 찾은 칸만 야수+0xec = 선수                                         ; 칸 0 은 안 쓴다
 * ```
 * 그래서 칸 0 은 **어느 모드든** 송구 속도 g = 2(= 940 + 16), 악송구 보정 8 이다(둘 다 r5 로 세고 +0xec 는 안 본다).
 * 능력치 하나로는 이 둘을 나타낼 수 없다(g = 2 는 등급 1, 보정 8 은 등급 2 의 값) — 송구 쪽은 이 칸의 능력치를 **읽지 않는다**.
 *
 * 그러나 야수+0xec 는 이 함수가 칸 0 에 쓰지 않을 뿐 비우지도 않는다 — **공수 교대 판 0x3fac4** 가 3fe0a~3fe4c 에서 야수 아홉
 * ([장면+0x111c+4i])마다 수비 팀(팀[st[0xa]], 3fd3c~3fd4e) 레코드 차례로 자리 니블 == i + 1 인 첫 선수를 +0xec 에 넣는다 —
 * 칸 0 은 니블 1 = **지명타자**다. +0xec 를 읽는 펌블(b41e4 → 표 0xd87d4[등급]) · 레이저(66a94 → 66aba 등급) 굴림은 그래서
 * 투수 칸이면 그 지명타자의 수비로 돈다(`recordPlayerAbilityOf`).
 * 0x3fac4 는 공수 교대 판이 서서 OK 를 기다릴 때만 불려(4fb20 — 가드 3fad0 · 3fade · 3fae8) 판이 안 선 반 이닝 뒤에는 앞 판의 값이 남고,
 * 장면을 만든 뒤 첫 판 앞에는 0(new 의 memset)이다 — 진행기가 그 칸을 장면 동안 들고(`entities/fielding/model/fielderRecords`)
 * 능력치 배열의 칸 0 에 그 레코드의 수비를, 비었으면 null 을 넣는다.
 */
export const UNSEARCHED_FIELDER_SLOT = 0

/** 선수 없는 칸의 g (b106a `movs r0,#2`) — 송구 속도 940 + 8 × 2 */
const NO_PLAYER_THROW_G = 2

/** 선수 없는 칸의 악송구 보정 — b10a2 r0 = 2 → cfg+0x2c(2) − 2 + 8 */
export const NO_PLAYER_THROW_ERROR_BIAS = 8

/**
 * 판 시작 0xb0fb4 가 찾은 **선수 수비 능력치** — 칸 0(투수)은 선수가 없어 `null` 이다(`UNSEARCHED_FIELDER_SLOT`).
 * 악송구(`rollThrowError` — 보정 +0xe4 는 b10a2 의 r5)가 `null` 을 "선수 없음"(보정 8)으로 읽는다.
 * 펌블 · 레이저는 +0xec 를 보므로 `recordPlayerAbilityOf` 를 쓴다.
 */
export function fielderAbilityOf(
  defenseAbilities: readonly (number | null)[],
  slot: number,
  fallback: number,
): number | null {
  if (slot === UNSEARCHED_FIELDER_SLOT) return null
  return defenseAbilities[slot] ?? fallback
}

/**
 * 야수 **+0xec 선수**의 수비 능력치 — 펌블(b41e4) · 레이저(66a94)가 읽는 칸. 칸 1~8 은 판 시작 b1184 가, 칸 0 은 공수 교대 판
 * 0x3fac4 가 넣은 지명타자다(`UNSEARCHED_FIELDER_SLOT` 머리말). 능력치 배열의 칸 0 은 진행기가 든 그 레코드의 값이고
 * **null 은 +0xec 가 0** 인 칸이다 — 펌블은 표 대신 0(b41e4 beq b4224), 레이저는 굴리지 않는다(66aa6). 칸이 아예 없으면 `fallback`.
 */
export function recordPlayerAbilityOf(
  defenseAbilities: readonly (number | null)[],
  slot: number,
  fallback: number,
): number | null {
  const ability = defenseAbilities[slot]
  return ability === undefined ? fallback : ability
}

/**
 * **수비 팀 보너스** — 판 시작 0xb0fb4 의 b10d0~b10f2 (직접 재역어셈):
 * ```
 * b0fd0    팀레코드 = 0xb8680(팀[st[0xa]])      ; [sp+0x24] — 수비 팀의 레코드(명부). 0xb570c 에도 같은 값을 넘긴다
 * b0ff4    [sp+0x14] = 전역 모드 0x1552d10 ∈ {1, 2, 8, 9}
 * b10d0    [sp+0x14] 면:  b = 0xbbe98(s16 팀레코드+8)          ; 팀 능력치 셋째 칸 '집중'의 등급 0~7
 * b10e6      사거리 +0x8c 값 += b      ; (+0x8c 는 읽는 곳이 없다 — P2 1c, 웹에 칸이 없다)
 * b10f2      송구 속도 v += b          ; 940 + 8·g 를 다 센 **뒤** — 0xa0fc4(야수, v) 가 +0xd4 · +0xdc = v, +0xd8 = v·130/100
 * ```
 * 악송구 보정 +0xe4(b10c4)는 이 갈래 **앞**에 이미 sp+8 에 적혀 보너스를 안 받는다. 칸 0(투수)도 고리 안이라 같이 받는다 —
 * g = 2 고정(b106a)으로 센 940 + 16 에 b 를 더한다. 팀레코드 +4·+6·+8·+0xa = 투구·타격·집중·근성(구단정보 0x7bf9c 표 0xd48b8).
 */
export const DEFENSE_TEAM_BONUS_MODES: readonly number[] = [1, 2, 8, 9]

/** b10d0 — 모드가 1·2·8·9 면 `0xbbe98(팀 집중)`, 아니면 0 */
export function defenseTeamBonusOf(mode: number, teamConcentration: number): number {
  if (!DEFENSE_TEAM_BONUS_MODES.includes(mode)) return 0
  return abilityGradeOf(teamConcentration)
}

/**
 * **주자 속도의 팀 등급** — 주자 만들기 0xa93ac 의 a9482~a94a4 (직접 재역어셈):
 * ```
 * a946c    v = 0xb570c(팀레코드, 3, 선수, 90) × cfg[+0x16](=7) / 100     ; 주루 능력치
 * a9482    m = 전역 모드 0x1552d10
 * a9488    m == 2 || m == 1 || m == 8 이면:  v += 0xbbe98(s16 팀레코드+0xa)   ; 팀 능력치 넷째 칸 '근성'의 등급 0~7
 * a94a4    주자+0xa4 = v                ; 달리기 속도 vt64 0xa092c = cfg[+0x14](300) + 주자+0xa4
 * ```
 * 팀레코드(셋째 인자)는 **주자의 팀**이다 — 루 위 주자 0xa9a10(a9a3e `0xb8680(팀)`, 주자 = `0xae8b8(팀, 루)`) ·
 * 타자주자 0x46418(4650e, 타자 = `0xae89c(팀)`) 모두 공격 팀을 넘긴다. 수비 보너스(b10d0, 1·2·8·9)와 달리 **모드 9 가 빠진다**.
 */
export const RUNNER_TEAM_GRADE_MODES: readonly number[] = [1, 2, 8]

/** a9488 — 모드가 1·2·8 이면 `0xbbe98(공격 팀 근성)`, 아니면 0 */
export function runnerTeamGradeOf(mode: number, teamGrit: number): number {
  if (!RUNNER_TEAM_GRADE_MODES.includes(mode)) return 0
  return abilityGradeOf(teamGrit)
}

/**
 * 플레이 시작 때의 야수 9명 (판 시작 vt20 0xb0fb4 — 0xb0f88 은 부르는 BL · 리터럴이 없는 죽은 함수다, r190 · 감사 r220).
 * 능력치는 송구 속도·악송구·펌블·필살수비 확률에만 쓰이고 **이동 속도에는 전혀 안 들어간다** (P2 1c).
 * `teamBonus` 는 `defenseTeamBonusOf` — 아홉 칸(칸 0 포함) 모두의 송구 속도에 더한다(등급 · 악송구 보정은 그대로).
 */
export function createFielders(defenseAbilities: readonly (number | null)[], teamBonus = 0): readonly FielderState[] {
  return Array.from({ length: FIELDER_COUNT }, (_unused, slot) => {
    // 칸 0(투수)은 b1032 가 선수를 찾지 않아 g = 2 고정 — 등급으로는 g − 1 = 1 (입력 능력치를 안 읽는다)
    const grade =
      slot === UNSEARCHED_FIELDER_SLOT ? NO_PLAYER_THROW_G - 1 : abilityGradeOf(defenseAbilities[slot] ?? 0)
    const start = FIELDER_START_POSITIONS[slot]
    // 0xa0fc4(야수, v): +0xdc = +0xd4 = v · +0xd8 = v × 130 / 100
    const throwSpeed = throwSpeedOf(grade, teamBonus)
    return {
      slot,
      position: start,
      target: start,
      speed: FIELDER_SPEED,
      targetBase: NONE,
      holdingBall: false,
      aiState: AI_STATE.IDLE,
      actionRemainingTicks: 0,
      arrivalSlackTicks: 0,
      actionLockTicks: 0,
      // 판 시작 0xb0fb4 의 b112e 가 야수마다 vt10 — 동작 0 · 워드 0
      action: 0,
      actionFrame: 0,
      pose: 0,
      defenseGrade: grade,
      throwSpeed,
      baseThrowSpeed: throwSpeed,
    }
  })
}

/**
 * 플레이 초기화 0xb67d0 — 타석/플레이가 시작될 때의 빈 상태.
 * 커버·야수 번호 칸은 −1, 담장/폴 틱과 득점 보류 칸도 여기서 지워진다.
 */
export function initialPlayView(kind = 1): PlayView {
  return {
    kind,
    coverOfBase: [NONE, NONE, NONE, NONE],
    ballHolderSlot: 0,
    catchFielderSlot: 0,
    catchKind: 0,
    catchTick: 0,
    actionStartTick: 0,
    earliestCatchTick: 0xffff,
    everHeld: false,
    held: false,
    finished: false,
    suppressed: false,
    wantsThrow: false,
    manualThrowBase: NONE,
  }
}

/**
 * 주자 하나. 타자주자는 0xa93ac 이 만들고, 루에 있던 주자는 0xa9374 가 한 칸씩 민다.
 * 루 위에 있는 주자는 **루 좌표에 비트까지 정확히** 선다 (리드 폭이라는 값은 없다 — S8 6절).
 * 다만 수비 판이 열릴 때 `0x3d7b8` 이 주자 틱을 몇 번 몰아서 돌린다 — `runnerLead` (지금은 도루 판만 붙였다).
 */
export function createRunner(
  index: number,
  fromBase: number,
  speed: number,
  overrides: Partial<RunnerState> = {},
): RunnerState {
  const start = basePosition(fromBase)
  return {
    index,
    position: start,
    legStart: start,
    startBase: fromBase,
    requiredBase: NONE,
    targetBase: fromBase,
    pitchBase: fromBase,
    settled: false,
    scored: false,
    isOut: false,
    isBatterRunner: index === 0,
    sliding: false,
    speed,
    ...overrides,
  }
}

/** 목표점까지 남은 틱 — 0xbefec = self.vt1c(self+0x2c) */
export function remainingTicksOf(mover: { position: WorldPoint; target: WorldPoint; speed: number }): number {
  return ticksToReach(mover.position, mover.target, mover.speed)
}

/** 이번 구간 전체 틱 — 0xbf01c = 거리(+0x14, +0x2c) ÷ 속도 */
export function legTotalTicksOf(runner: RunnerState): number {
  return ticksToReach(runner.legStart, basePosition(runner.targetBase), runner.speed)
}

/** 주자가 목표 루까지 남은 틱 — 0xbefec(주자) */
export function runnerRemainingTicks(runner: RunnerState): number {
  return ticksToReach(runner.position, basePosition(runner.targetBase), runner.speed)
}

/**
 * 주자 vt0xa0 = 0xa06ec = **한 루 더 갈 때의 총 틱**
 * = 거리(루[(목표루+1)%4], 루[목표루]) ÷ 속도 + 지금 목표까지 남은 틱 (S7 5절, 확정).
 * 거리는 **맨해튼 0xbfa2c**(a0740)다.
 */
export function runnerOneMoreBaseTicks(runner: RunnerState): number {
  const next = basePosition(runner.targetBase + 1)
  const current = basePosition(runner.targetBase)
  const legs = runner.speed === 0 ? 0 : Math.trunc(manhattanDistance(next, current) / runner.speed)
  return legs + runnerRemainingTicks(runner)
}

/** 주자가 목표점에 도착해 멈췄는가 — vt18 = 0xbf3a0 = (위치 == 목표점) (S8 정정 5) */
export function isRunnerStopped(runner: RunnerState): boolean {
  const target = basePosition(runner.targetBase)
  return runner.position.x === target.x && runner.position.z === target.z
}

/** 야수 vtc0 = 0xa1c3c = 목표점까지 남은 틱 + +0xcc */
export function fielderArrivalTicks(fielder: FielderState): number {
  return remainingTicksOf(fielder) + fielder.arrivalSlackTicks
}
