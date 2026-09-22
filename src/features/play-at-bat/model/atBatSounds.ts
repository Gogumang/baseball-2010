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
 * **플레이가 끝난 뒤의 콜** — 홈런 함성과 아웃 콜.
 *
 * | 판정 | 번호 | 근거 |
 * |---|---|---|
 * | 홈런 (v8·v12) | **11** | 0x51c82 + 홈런 이벤트 0xa5fed |
 * | 아웃 (v13 기본) | **20** | 0x51b36 |
 * | 안타 (v6·v10) | 소리 없음 | 0x51d32·0x51d24 — 원본도 안 낸다 |
 *
 * ⚠️ **근사**: 원본 v13 의 기본 갈래는 문서가 "뜬공 포구 아웃" 으로만 적혀 있는데, 여기서는
 * 땅볼·직선타 아웃에도 같은 20 을 쓴다. 다른 아웃 콜 **62** 는 v11 과 v13 의 특수 모드 갈래
 * (전역 `[0x1552d0c]+0x1f`·`+0x87`)가 무엇인지 미해결이라 **잇지 않았다** —
 * 아웃을 v11 과 v13 으로 가르는 기준을 알게 되면 여기서 갈라 주면 된다.
 */
export function inPlayCallSoundIdOf(outcome: AtBatOutcome): number | null {
  if (outcome.kind === '홈런') return 11
  if (outcome.kind === '아웃') return 20
  return null
}
