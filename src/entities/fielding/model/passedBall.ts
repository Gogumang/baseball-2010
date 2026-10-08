import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * `state[0x19]` 0.1% 사건 — **포수 뒤로 빠진 공(폭투·포일)** (S8 5절).
 * 동작은 확정, 이름만 유력이다.
 *
 * 투구 판정 때 `0x35034` 가 굴린다: 모드 7(홈런더비)만 빼고 매 투구마다
 * `T(= d_level.dat 0x2a 의 32비트 값 = 10) > rand(0, 10000)` → 0.1%. 난이도·능력치와 무관하다.
 *
 * 굴림 차례 (상태 0x12 진입 0x3dfac): `rollPassedBall` → 투구 판정 v → 서고 v ≠ 3·4 면 `passedBallShot`
 * (rand 두 번) → v == 5 면 `passedBallStrikeoutOf` → 판 `features/defense-play/model/passedBallPlay`.
 * 어느 판을 여는지는 `stealStart.pitchPlayKindOf` 가 함께 가른다(0.1% 사건이 도루 판보다 먼저).
 */

/**
 * cfg+0x2e 32비트 값 = 10 (파일 0x2a = 10, 0x2c = 0).
 * 원본 `T > rand(0, 10000)`(위끝 제외) — 10/10000 = 0.1% (0x35058).
 */
export const PASSED_BALL_THRESHOLD = 10
const RANDOM_LIMIT = 10_000

/** 홈런더비(모드 7) 에서는 굴리지 않는다 */
export const HOME_RUN_DERBY_MODE = 7

export function rollPassedBall(gameMode: number, random: RandomPort): boolean {
  if (gameMode === HOME_RUN_DERBY_MODE) return false
  return PASSED_BALL_THRESHOLD > random.rand(0, RANDOM_LIMIT)
}

/** 굴림이 섰을 때 실제로 공이 튀는 값 (0x3507c) */
export interface PassedBallShot {
  /** 화면+0xfcc 각도. rand(60, 130)(0x35086, 위끝 제외 — 60~129) 을 **부호 없이 그대로** 넣는다 */
  readonly angle: number
  /** 화면+0xfce 세기. rand(160, 280)(0x35096 — 160~279) */
  readonly strength: number
  /** 화면+0xfd0 수직 속도 = −100 (아래로) */
  readonly verticalSpeed: number
}

/** 수직 속도는 상수다 */
export const PASSED_BALL_VERTICAL_SPEED = -100

/**
 * 타격 경로는 원시각 45…135 를 **부호를 뒤집어** −135…−45 로 넣는데, 이 사건은 60…129 를 그대로 넣는다.
 * `0x9d660` 의 정규화(a > 0 → a − 360)를 거치면 −300…−231 → 페어 쐐기 밖, 즉 **홈플레이트 뒤쪽**이다.
 */
export function passedBallShot(random: RandomPort): PassedBallShot {
  return {
    angle: random.rand(60, 130),
    strength: random.rand(160, 280),
    verticalSpeed: PASSED_BALL_VERTICAL_SPEED,
  }
}

/**
 * 사건이 섰을 때의 처리 (0x3e062~0x3e09c):
 * 볼넷(3)·사구(4) 로 끝난 투구는 제외하고, 공을 쏜 뒤 **플레이 종류 9**, 포수 동작 6(에러),
 * 장면 상태 0x17(수비 인플레이)로 넘어간다.
 *
 * - `state[0x1c]`(페어/파울)를 아예 재지 않아(0x511b0 게이트) 플레이 끝 결과는 0 — **타격 기록이 남지 않는다.**
 * - **주자 유무를 보지 않는다**(0x3e070 에 `state[0x24]` 검사가 없다). 주자가 없어도 이 판이 열린다 — 원본 그대로.
 */
export const PASSED_BALL_PLAY_KIND = 9
/** 포수에게 거는 동작 번호 6 = 에러/펌블 동작 */
export const PASSED_BALL_CATCHER_ACTION = 6

export function startsPassedBallPlay(pitchJudgement: number): boolean {
  return pitchJudgement !== 3 && pitchJudgement !== 4
}

/**
 * **폭투·포일 + 삼진 = 낫아웃** — 종류 9 를 연 바로 뒤 `0x3e09e~0x3e0e0` (직접 뜬 것).
 * ```
 * 3e0a2: v == 5(삼진) 일 때만:
 * 3e0a8:   state[0xc] = 5 ; 판정 칸 [scene+0x10ac] = 0          ; 삼진을 일단 지운다
 * 3e0b6:   0xa9878(주자관리, 1)(1루 주자) && state[6](아웃) ≤ 1 → 판정 칸 = 5 로 되돌린다   ; 삼진 그대로
 * 3e0d0:   아니면 0xa7c4c(기록, 삼진 이벤트) ; state[0x1a] = 1                         ; ★ 타자가 뛴다
 * ```
 * - `state[0x1a]` 가 서면 수비 화면 진입 0x46418 (0x464a8~0x464da: state[0x11] || 종류 2·3 || **state[0x1a]**,
 *   종류 ≠ 8) 이 **타자주자를 0xa93ac 로 맨 앞에** 만든다 — 1루가 비었거나 2아웃이면 삼진당한 타자가 1루로 뛴다.
 * - 삼진 기록(0xa7c4c)은 그대로 남고, 정산 0xa8ce8 이 `state[0x1a]` 를 보고 투수의 잡은 아웃 수(R+0x13c)를
 *   하나 빼며(P7 E3), 0xa8e60 은 그 판의 2아웃을 병살로 치지 않는다.
 * - **이 갈래는 0.1% 사건(종류 9) 안에만 있다.** 도루 판(종류 5, 0x3e0e4)에는 삼진 처리가 없다
 *   (P7 E3 이 이 자리를 "주자가 뛰는 중 갈래" 로 적은 것은 0x3e09e 로 이어지는 흐름을 잘못 읽은 것이다).
 *
 * 돌려주는 값: `'none'`(삼진 아님) · `'strikeoutStands'`(삼진 그대로, 타자 아웃) · `'batterRuns'`(낫아웃 — 타자주자).
 * `outs` 는 이 투구 전의 아웃 수(state[6])다.
 */
export type PassedBallStrikeout = 'none' | 'strikeoutStands' | 'batterRuns'

export function passedBallStrikeoutOf(input: {
  readonly pitchJudgement: number
  readonly firstBaseOccupied: boolean
  readonly outs: number
}): PassedBallStrikeout {
  if (input.pitchJudgement !== STRIKEOUT_JUDGEMENT) return 'none'
  if (input.firstBaseOccupied && input.outs <= 1) return 'strikeoutStands'
  return 'batterRuns'
}

/** 투구 판정 5 = 삼진 (R10) */
const STRIKEOUT_JUDGEMENT = 5
