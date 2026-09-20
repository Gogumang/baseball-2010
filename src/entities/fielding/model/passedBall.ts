import type { RandomPort } from '@/shared/api/random/randomPort'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'

/**
 * `state[0x19]` 0.1% 사건 — **포수 뒤로 빠진 공(폭투·포일)** (S8 5절).
 * 동작은 확정, 이름만 유력이다.
 *
 * 투구 판정 때 `0x35034` 가 굴린다: 모드 7(홈런더비)만 빼고 매 투구마다
 * `T(= d_level.dat 0x2a 의 32비트 값 = 10) > rand(0, 10000)` → 0.1%. 난이도·능력치와 무관하다.
 */

/**
 * cfg+0x2e 32비트 값 = 10 (파일 0x2a = 10, 0x2c = 0).
 * 원본 `rand(a, b)` 는 양끝을 포함해 10/10001 이지만, 이 저장소는 `randomIntegerBelow`(위끝 제외) 로
 * 통일돼 있어 10/10000 으로 옮긴다 — 0.1% 라는 값은 그대로다.
 */
export const PASSED_BALL_THRESHOLD = 10
const RANDOM_LIMIT = 10_000

/** 홈런더비(모드 7) 에서는 굴리지 않는다 */
export const HOME_RUN_DERBY_MODE = 7

export function rollPassedBall(gameMode: number, random: RandomPort): boolean {
  if (gameMode === HOME_RUN_DERBY_MODE) return false
  return PASSED_BALL_THRESHOLD > randomIntegerBelow(random, 0, RANDOM_LIMIT)
}

/** 굴림이 섰을 때 실제로 공이 튀는 값 (0x3507c) */
export interface PassedBallShot {
  /** 화면+0xfcc 각도. rand(60, 130) 을 **부호 없이 그대로** 넣는다 */
  readonly angle: number
  /** 화면+0xfce 세기. rand(160, 280) */
  readonly strength: number
  /** 화면+0xfd0 수직 속도 = −100 (아래로) */
  readonly verticalSpeed: number
}

/** 수직 속도는 상수다 */
export const PASSED_BALL_VERTICAL_SPEED = -100

/**
 * 타격 경로는 원시각 45…135 를 **부호를 뒤집어** −135…−45 로 넣는데, 이 사건은 60…130 을 그대로 넣는다.
 * `0x9d660` 의 정규화(a > 0 → a − 360)를 거치면 −300…−230 → 페어 쐐기 밖, 즉 **홈플레이트 뒤쪽**이다.
 */
export function passedBallShot(random: RandomPort): PassedBallShot {
  return {
    angle: randomIntegerBelow(random, 60, 131),
    strength: randomIntegerBelow(random, 160, 281),
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
