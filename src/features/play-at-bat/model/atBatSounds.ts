import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { AtBatState, PitchResolution } from '@/entities/at-bat/model/atBatState'
import { battedBallTrajectory, carryDistanceOf, FENCE_DISTANCE } from '@/entities/batting/model/battedBallFlight'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'

/**
 * 타석 하나에서 울리는 **효과음·음성 번호**를 고른다 (`shared/config/original/sounds` 의 표).
 *
 * 원본은 경기 진행 `0x51408` 안에서 두 자리에 나눠 튼다:
 *   1. **타구 순간** (0x515de~0x5164a) — 배트 소리·헛스윙 바람 소리. 볼카운트를 안 본다.
 *   2. **판정 스위치** (0x51a94, 점프표 0xd0488, v = 1~13) — 심판 콜. 플레이가 끝나고 난다.
 * 그래서 여기서도 `contactSoundIdOf`(1) 와 `pitchCallSoundIdOf`·`inPlayCallSoundIdOf`(2) 로 나눴다.
 *
 * ⚠️ **웹은 두 자리의 시각이 거의 붙어 있다.** 타석 화면은 맞은 공을 상태 0x13 만큼 붙잡아 둔 뒤
 * `onPitchResolved` 를 한 번 부르므로, 타구음과 판정음이 같은 순간에 도착한다. 소리 통로가 하나뿐이라
 * (`shared/api/audio/soundPort` 머리 주석) 뒤에 튼 판정음이 타구음을 끊는다 — 원본도 두 소리가
 * 붙으면 같은 일이 벌어지지만, 원본은 사이가 벌어져 있어 둘 다 들린다. **이 어긋남은 근사다.**
 * (인플레이 타구는 수비 화면이 끝난 뒤에야 아웃 콜이 나므로 타구음이 온전히 들린다.)
 *
 * 근거: docs/re/L-sound-effects.md 1-F·1-G · docs/re/R2-game-effects.md 8절.
 */

/**
 * **투구 순간 소리 (보통)** — 0x3f378 이 투수 단계가 공을 놓는 칸에 닿을 때 낸다.
 *
 * ⚠️ 마구는 **28** 이다 (상태 0x16 이거나 마투수의 마구, R2 8절). 웹은 구질 표
 * (`shared/config/original/pitchTypes`)에 마구 칸이 없어 가를 수 없다.
 * ⚠️ 원본은 모드 7(홈런더비)·상태 0x19·0x1a·경기 멈춤에서는 안 낸다.
 */
export const PITCH_RELEASE_SOUND = 12

/** 0x392ac 이 보는 결과 코드 — 홈런성(가운데·좌·우). 방향 0·1·2 가 붙어 24·25·26 이 된다 */
const BIG_HIT_CODES: ReadonlySet<number> = new Set([24, 25, 26])
/** 0x392ac 의 `공+0xac0 > 111` */
const CARRY_THRESHOLD = 111
/** 원본 `공+0xac0` 눈금의 상한 (E 2-1b) */
const CARRY_SCALE_MAX = 160

/**
 * 낙구 거리 → 원본 `공+0xac0` 눈금 (0~160). **근사다** — 곱하는 상수를 문서가 안 적어
 * 담장 거리를 눈금 160 으로 본다.
 *
 * ⚠️ 같은 식이 `widgets/batting-stage/lib/hitPause.ts` 에도 있다 (화면을 붙잡아 두는 틱을 고를 때).
 * 그 파일은 이 작업의 담당 폴더 밖이라 합치지 않고 같은 식을 여기 다시 적었다 —
 * 한쪽을 고치면 다른 쪽도 같이 고쳐야 한다.
 */
function carryScaleOf(distance: number): number {
  if (distance <= 0) return 0
  return Math.min(CARRY_SCALE_MAX, Math.trunc((distance * CARRY_SCALE_MAX) / FENCE_DISTANCE))
}

/**
 * 0x392ac — 큰 타구(감상 플래그 `+0x199a`) 판정. 타구음 7 과 상태 19 연출을 같이 고른다.
 * 원본이 보는 칸은 결과 코드 · 폴 틱 `+0xab0` · 거리 눈금 `+0xac0` 셋이다 (R15 9-1).
 */
function isBigHit(resultCode: number, pattern: BattedBallPattern): boolean {
  if (!BIG_HIT_CODES.has(resultCode)) return false
  const trajectory = battedBallTrajectory(pattern)
  if (trajectory.poleTick >= 0) return false
  return carryScaleOf(carryDistanceOf(trajectory)) > CARRY_THRESHOLD
}

/**
 * 원본 패턴 세 값을 판정 칸 이름으로 옮긴다.
 * 원본은 수평각을 **부호 뒤집어** `+0xfcc` 에 넣으므로 `a = −(웹 각)` 이다 (R15 9-1·hitPause 주석).
 * 높이 `c` 는 플래그 비트0 이 서면 부호가 뒤집힌다 (0xb0614).
 */
function hitValuesOf(pattern: BattedBallPattern): { a: number; b: number; c: number } {
  const [angle, speed, height, flags] = pattern
  return { a: -angle, b: speed, c: (flags & 1) === 1 ? -height : height }
}

/** 0x35988 — **강한 타구** (R2 3-3 의 식 그대로) */
function isStrongHit(pattern: BattedBallPattern): boolean {
  const { a, b, c } = hitValuesOf(pattern)
  if (!(a > -145 && a < -35)) return false
  if (b > 1200) return true
  if (b > 1000 && b <= 1200 && c > 600) return true
  return b > 800 && b + Math.abs(c) > 1599
}

/** 0x39304 — **약한 타구(빗맞음)** (R2 3-3 의 식 그대로) */
function isWeakHit(pattern: BattedBallPattern): boolean {
  const { a, b, c } = hitValuesOf(pattern)
  const height = Math.abs(c)
  if (a > -165 && a < -75) return b <= 449 && height <= 449
  return (b <= 349 && height <= 899) || (b <= 549 && height <= 549)
}

export interface ContactSoundInput {
  /** 배트를 냈는가 — 안 냈으면 타구음 갈래 자체를 지나지 않는다 (0x51350 은 스윙 처리 안이다) */
  readonly hasSwung: boolean
  /** 배트에 맞았는가 (원본 `게임+0xfd2`) */
  readonly hasHit: boolean
  /** 스윙 객체 `+8` — 웹은 번트 종류가 그 자리다 (0 이면 보통 스윙) */
  readonly buntKind: number
  /** 방향까지 붙인 결과 코드 (원본 `게임+0xfd4`). 맞지 않았으면 null */
  readonly resultCode: number | null
  /** 이 타구에 쓰인 원본 패턴. 맞지 않았으면 null */
  readonly pattern: BattedBallPattern | null
}

/**
 * **타구 순간 소리** — 원본 0x515de~0x5164a 의 분기 순서 그대로다 (R2 3-3 표).
 *
 * | 조건 | 번호 |
 * |---|---|
 * | 맞지 않음 · 스윙 `+8` == 0 (0x51350) | **8** 헛스윙 바람 소리 |
 * | 0x392ac 참 (큰 타구) | **7** |
 * | 스윙 `+8` ≠ 0 (0x51606) | **9** |
 * | 0x35988 참 (강한 타구) | **5** |
 * | 0x39304 참 (약한 타구) | **59** |
 * | 그 밖 | **6** |
 *
 * ⚠️ **못 옮긴 갈래**: 필살 스윙·마선수 타자의 헛스윙은 8 대신 **27** 이다 (스윙 객체 `+0x10` ≠ 0,
 * 또는 0x4e24a 의 "현재 타자가 마선수"). 웹은 그 두 값을 타석 화면(`widgets/batting-stage`)만 알고
 * `resolvePitch` 로 넘겨 주지 않아 여기서는 늘 8 이 된다.
 */
export function contactSoundIdOf(input: ContactSoundInput): number | null {
  if (!input.hasSwung) return null
  if (!input.hasHit) return input.buntKind === 0 ? 8 : null
  if (input.resultCode !== null && input.pattern !== null && isBigHit(input.resultCode, input.pattern)) return 7
  if (input.buntKind !== 0) return 9
  if (input.pattern === null) return 6
  if (isStrongHit(input.pattern)) return 5
  if (isWeakHit(input.pattern)) return 59
  return 6
}

/**
 * **판정 스위치의 심판 콜** — 볼·스트라이크·삼진·볼넷·파울처럼 수비를 기다리지 않는 판정만 고른다.
 * 인플레이 타구(안타·아웃)는 플레이가 끝난 뒤 `inPlayCallSoundIdOf` 가 고른다.
 *
 * `atBat` 은 **이 공을 먹인 뒤**의 볼카운트다 (원본도 카운트를 올린 뒤 판정에 들어간다).
 *
 * | 판정 | 번호 | 근거 |
 * |---|---|---|
 * | 볼 (v2) | **16** "Ball!" | 0x51ac2 |
 * | 볼넷 (v3) | **24** "Base on balls!" | 0x51aca |
 * | 스트라이크 (v1 기본) | **18** "Strike!" | 0x51aa2 |
 * | 스트라이크 카운트 2 (v1) | **39** "Strike two!" | `[sp+0xa4]+4 == 2` |
 * | 삼진 (v5) | **21** "Strike out!" | 0x51bf6 |
 * | 파울 (v7) | **25** "Foul!" | 0x51c5c · R2 8절 확정 |
 *
 * ⚠️ **추정**: 39 의 조건 `[sp+0xa4]+4 == 2` 가 **올린 뒤**의 스트라이크 수인지 올리기 전인지는
 * 문서에 없다. 여기서는 올린 뒤로 읽어 두 번째 스트라이크에 39 를 낸다.
 * ⚠️ 볼넷 뒤에 조건부로 예약되는 함성 **29** (`game[0x31+game[9]] == 1`)는 그 칸의 뜻이 미해결이라
 * 잇지 않았다.
 */
export function pitchCallSoundIdOf(resolution: PitchResolution, atBat: AtBatState): number | null {
  switch (resolution.kind) {
    case '볼':
      return atBat.outcome?.kind === '볼넷' ? 24 : 16
    case '스트라이크':
      if (atBat.outcome?.kind === '삼진') return 21
      return atBat.strikes === 2 ? 39 : 18
    case '파울':
      return 25
    case '타구':
      return null
  }
}

/**
 * 플레이가 끝난 뒤의 콜을 고를 때 **수비 진행기(`features/defense-play`)가 돌린 결과**를 함께
 * 넘기면 원본이 보는 칸에 더 가깝게 가른다. 안 넘기면 타석 결과만 보고 근사한다.
 *
 * 구조만 받는다 — `DefensePlayResult` 를 그대로 import 하면 타석 쪽이 수비 쪽에 묶인다.
 */
export interface DefenseCallContext {
  /** 뜬 채로 잡았는가 (원본 `state[0x1f]`, 0xb2774 가 `vt90()==1` 일 때 1) */
  readonly caughtOnTheFly?: boolean
  /** CPU 가 고른 송구 목표 루. −1 이면 안 던졌다 */
  readonly throwBase?: number
  /** 송구 도착 틱. 송구가 없으면 −1 */
  readonly throwArrivalTick?: number
}

/** 아웃 콜 두 가지 — 62 는 "잡아서/태그해서 낸 아웃", 20 은 "루에서 잡은 포스 아웃" */
const CAUGHT_OUT_CALL = 62
const FORCE_OUT_CALL = 20
/** "Safe!" — 아웃 될 뻔했는데 살았을 때만 난다 (판정 v9) */
const SAFE_CALL = 17

/**
 * **플레이가 끝난 뒤의 콜** — 홈런 함성 · 아웃 콜 · 세이프 콜.
 *
 * | 판정 | 번호 | 근거 |
 * |---|---|---|
 * | 홈런 (v8·v12) | **11** | 0x51c82 + 홈런 이벤트 0xa5fed |
 * | 세이프 (v9) | **17** | 0x51c14 → `movs r1,#0x11` |
 * | 아웃 (v11) | **62** | 0x51b20 → `movs r1,#0x3e` (조건 없음) |
 * | 아웃 (v13) | **62** 또는 **20** | 0x51b36 (아래) |
 * | 안타 (v6·v10) | 소리 없음 | 0x51d32·0x51d24 — 원본도 안 낸다 |
 *
 * **62 / 20 을 가르는 자리 (0x51b36~0x51b48, 디스어셈 재확인 — 확정):**
 * ```
 * 00051b36: ldr r3,[pc,#0x9c]  ; [0x51bd4] = 0x1552d0c
 * 00051b38: ldr r2,[r3]        ; 경기 상태 구조체 포인터
 * 00051b3a: ldrb r3,[r2,#0x1f] ; state[0x1f]
 * 00051b3e: bne 0x51b4a        ; ≠ 0 → 62
 * 00051b42: adds r3,#0x87      ; state[0x87]
 * 00051b48: beq 0x51bd8        ; == 0 → 20
 * 00051b4a: movs r1,#0x3e      ; 62
 * 00051bd8: movs r1,#0x14      ; 20
 * ```
 * 두 칸의 뜻:
 * - `state[0x1f]` = **뜬공·직선타를 바운드 없이 잡은 아웃** (0xb2774 가 `vt90()==1` 일 때 1 로 쓴다,
 *   0xb67fe 초기화, 0xb323c·0xb33b6 이 튕길 때 0).
 * - `state[0x87]` = 아웃 판정 0xb36d0 의 결과가 **3**(태그성, 0xb394e) 이거나
 *   **2 이면서 야수 +0x3b**(루에 닿아 있음, 0xb4312) 일 때 선다.
 *
 * → **62 = 잡아서·태그해서 낸 아웃**, **20 = 루에서 잡은 포스 아웃**.
 * (v11 = 2스트라이크 번트 파울 아웃도 62 다 — `battedBallOutcome.buntFoulOut` 참고.)
 *
 * ⚠️ `docs/re/L-sound-effects.md` 가 적던 "특수 모드" 는 오독이다. `0x1552d0c` 는 모드 플래그가
 * 아니라 **경기 상태 구조체 포인터**고, 두 칸은 이번 플레이의 아웃 종류다. 그 문서도 같이 고쳤다.
 *
 * ⚠️ **근사인 곳**: 수비 결과를 안 넘기면 타석 결과 detail 로만 가른다 —
 * 뜬공·직선타 아웃은 잡은 아웃(62), 땅볼 아웃은 포스 아웃(20) 으로 본다.
 *
 * ⚠️ **`state[0x87]`(태그 몫)은 아직 못 잇는다.** 태그 아웃 갈래 자체는 이제 있다 —
 * `entities/fielding/model/outJudgement.ts` 의 `OUT_KIND.TAG`(3, 0xb380e) 가 그것이고
 * 진행기 `runDefensePlay` 의 `runOutJudgement` 가 매 틱 그 값을 받는다. 그런데 그 값은
 * **기록(`log`) 문자열로만 남고** `DefensePlayResult` 에 칸이 없어 여기까지 오지 않는다
 * (`rundownOuts` 는 협살로 잡은 태그 아웃만 세는 다른 칸이다). 그래서 태그 아웃은 지금도
 * `caughtOnTheFly` 가 거짓이라 **20 으로 샌다**. 진행기 쪽에 칸이 생기면 그때 잇는다 —
 * 뜻을 모르는 채로 다른 칸에 갖다 붙이지 않는다.
 * ⚠️ **17 은 근사다.** 원본(0xb442a~0xb444a)은 야수가 그 루에서 **공을 쥔 채**(`+0xe0`) 있는데
 * 아웃 판정(0xb36d0)이 서지 않고 주자가 들어오는 **틱**에 v = 9 를 낸다. 즉 "아웃 될 뻔했는데
 * 살았다" 만이고 외야로 나간 안타는 이 길이 아니다. 웹 타석 모델에는 틱이 없어
 * **"안타인데 어느 루로 송구가 도착했다"** 로 근사했다.
 */
export function inPlayCallSoundIdOf(outcome: AtBatOutcome, play?: DefenseCallContext | null): number | null {
  if (outcome.kind === '홈런') return 11
  if (outcome.kind === '아웃') {
    // 수비 결과를 받았으면 원본과 같은 칸(state[0x1f])을 본다. 없으면 타석 결과로 근사한다
    const caught = play?.caughtOnTheFly ?? (outcome.detail === '뜬공아웃' || outcome.detail === '직선타아웃')
    return caught ? CAUGHT_OUT_CALL : FORCE_OUT_CALL
  }
  if (outcome.kind === '안타' && play != null) {
    const thrown = (play.throwBase ?? -1) >= 0 && (play.throwArrivalTick ?? -1) >= 0
    if (thrown) return SAFE_CALL
  }
  return null
}

/** 관중 함성 — 깊은 페어 타구가 아무도 못 잡고 떨어지는 틱 (0x52bb2) */
export const DEEP_HIT_CHEER_SOUND = 60

/**
 * 원본 `공+0xac4` 가 서는 문턱 — 낙구점이 홈 (20000,0,29445) 에서 **10274 넘게** 떨어지고
 * 각이 페어 범위일 때 1 (P2 2절, 표 0xd7be8). 웹 월드도 같은 눈금이라 값을 그대로 쓴다.
 */
const DEEP_HIT_DISTANCE = 10_274

export interface DeepHitCheerInput {
  readonly outcome: AtBatOutcome
  /** 낙구 지점까지의 거리 (`battedBallFlight.carryDistanceOf`) */
  readonly carryDistance: number
  /** 뜬 채로 잡혔는가 — 잡혔으면 원본 `플레이+0x113` 이 서지 않는다 */
  readonly caughtOnTheFly?: boolean
}

/**
 * **깊은 타구가 아무도 못 잡고 떨어질 때의 함성 60** (0x52b62~0x52ba4, 수비 화면 0x528b0 안).
 *
 * ```
 * 00052b70: ldr r1,[r2+0xaa0]  ; 낙구 틱
 * 00052b74: beq  ...           ; −1 이면 안 낸다
 * 00052b76: ldr r3,[r2,#0x68]  ; 지금 틱 == 낙구 틱 이어야 한다
 * 00052b80: ldrb r3,[r2+0xac4] ; 깊은 페어 타구 표시
 * 00052b88: bl 0x357e0         ; [경기+0xfd4] − 0x18 ≤ 2 = 결과 코드 24~26(홈런성)이면 **안 낸다**
 * 00052b9e: ldrb r3,[..+0x113] ; 낙구 틱에 아무도 안 잡았다 (P2 2절 0xb4492)
 * 00052baa: movs r1,#0x3c      ; 60
 * ```
 *
 * ⚠️ 앞서 "홈런더비 함성"·"경기 상태 0x18·0x19·0x1a" 로 읽던 것은 **틀렸다**. 0x528b0 은
 * 홈런더비가 아니라 **인플레이 수비 화면(상태 0x17)** 이고(R10 2-1), `0x357e0` 이 보는
 * `경기+0xfd4` 는 경기 상태가 아니라 **타구 결과 코드**다(E 2-1a · R15 9-1 · R2 3-3).
 * 홈런에는 60 이 아니라 11 이 따로 있다.
 *
 * ⚠️ **근사**: 웹에는 틱 단위 낙구가 없어 "떨어지는 그 틱" 을 잡을 수 없다. 수비 플레이가 끝나는
 * 자리에서 한 번 낸다. 결과 코드도 그 자리까지 오지 않아 **홈런 결과**로 대신 걸렀다 —
 * 세기가 모자라 홈런이 되지 못한 24~26 타구는 원본이라면 안 낼 함성을 내게 된다.
 */
export function deepHitCheerSoundIdOf(input: DeepHitCheerInput): number | null {
  if (input.outcome.kind === '홈런') return null
  if (input.caughtOnTheFly === true) return null
  if (input.outcome.kind === '아웃' && (input.outcome.detail === '뜬공아웃' || input.outcome.detail === '직선타아웃')) {
    return null
  }
  return input.carryDistance > DEEP_HIT_DISTANCE ? DEEP_HIT_CHEER_SOUND : null
}
