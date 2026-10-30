import { derbyNoContactWaitFramesOf, derbyPitchCallOf } from '@/pages/home-run-derby/lib/derbyPitchCall'
import { derbyBattedBallOf } from '@/entities/home-run-derby/model/derbyBattedBall'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import { BATTER_PITCH_RESULT_ENTRY_TICKS } from '@/features/play-game/model/sceneTickSounds'
import { millisecondsPerFrame } from '@/shared/config/frameRate'

/**
 * 결과 연출로 붙잡는 시간 — 맞은 공(패턴이 실려 온 공)은 원본 판 끝(공.vt18 멈춤 + 10틱, `derbyBattedBallOf` 의 endTicks)까지,
 * 안 맞은 공은 0x12 진입 틀(넘긴 틀 + 1)부터 상태 0x12 의 대기(`derbyNoContactWaitFramesOf` — 15틱, 볼넷 · 사구면 31틱, 0x4e6de~0x4e730).
 * `balls` = 이 공 앞의 볼 수 st[5] (볼넷 판정에 쓴다). 난수를 안 쓰는 미리 보기다 — 폴에 맞는 공은 판 시작 굴림으로
 * 다시 깐 궤적의 끝을 쓴다(`onPitchResolved`).
 */
export function resultHoldMillisecondsOf(detail: PitchOutcomeDetail, balls = 0): number {
  if (detail.pattern === undefined) {
    const waitTicks = derbyNoContactWaitFramesOf(derbyPitchCallOf(detail.resolution, balls).judgment)
    return (BATTER_PITCH_RESULT_ENTRY_TICKS + waitTicks) * millisecondsPerFrame()
  }
  return derbyBattedBallOf(detail.pattern).endTicks * millisecondsPerFrame()
}

/**
 * 상태 0xe 에 들어선 뒤 OK 를 안 받는 갱신 수 — 키 처리 0x498d4 끝(0x49a26~0x49a30)이
 * `[장면+0x1c] == 0xe && [장면+0x2c](이 상태의 틱) ≤ 2` 이면 사람 조작 객체에 키를 넘기지 않는다.
 * 진입 틱이 0 이라 틱 0·1·2 셋을 거른다 (확정: 상태 기계 0xbc9c8 이 상태를 바꾸는 그림에서 +0x14(= 장면+0x2c) = 0,
 * 그대로면 +0x14++ — 매 그림 0x52c50 이 0xbc9c8 → 진입 → 키 0x498d4 → 갱신 → 그리기 차례로 부른다).
 */
export const CONFIRM_LOCK_FRAMES = 3

/**
 * 상태 0xd 가 머무는 갱신 수 — 갱신 0x39e14 는 `[점수판 +0xf10]+0x6c ≠ 1 && 틱 > 0` 이면 0xe 를 예약한다.
 * 점수판 +0x6c 는 1 이 되는 일이 없다: 쓰는 곳이 만들기 0x76b16(0) · 0xd 진입 0x48f42(2, +0x61 == 0 일 때) ·
 * 점수판 갱신 0x785a8(1 → 2 0x785c8 · 2·3 → 0 0x78626 · 4·5 → 0 0x78650) 뿐이다(전체 디스어셈 `str …, #0x6c]` 전수,
 * 0x785a8 이 받는 객체는 0x41230 의 [장면+0xf10]). 그래서 늘 **틱 0(진입)·틱 1(예약)** 두 그림 뒤 0xe 다.
 */
export const SCENE_D_FRAMES = 2

/** 0xd 진입의 타석 등장음 — 메시지 0xbc1 → 0x522d2 의 "그 밖" 14 (더비 타자는 마선수가 아니고 주자가 없다) */
export const DERBY_AT_BAT_ENTRY_SOUND = 14

/** 52a08 `cmp r2, 0x7cf; ble` — 판 끝 누적 비거리가 1999 를 넘으면 히든 39 를 연다(52a00~52a16, `onOpenHidden`) */
export const DERBY_DISTANCE_HIDDEN_THRESHOLD = 1999
export const DERBY_DISTANCE_HIDDEN_ID = 39
