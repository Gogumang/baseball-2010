import {
  battedBallTrajectory,
  landingPointOf,
  trajectoryWithRandom,
} from '@/entities/batting/model/battedBallFlight'
import { isFairAngle } from '@/entities/batting/model/battedBallOutcome'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'
import type { BattedBallTrajectory } from '@/entities/fielding/model/catchPrediction'
import type { WorldPoint } from '@/entities/fielding/model/fieldGeometry'
import { derbyDistanceOf } from '@/entities/home-run-derby/model/derbyRules'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * 홈런더비가 쓰는 타구 한 장 — **홈런더비 판(플레이 종류 8)** 하나를 원본대로 돌린 결과.
 *
 * 원본은 타구 순간(0x51408) 덱에서 뽑은 패턴의 각·속도·높이로 공 객체에 궤적 점을 깔아 두고(메시지 0x11 → 51188 · 세계
 * 0xbfed0), 상태 0x17 로 판을 돈다. 이식판 타석(`features/play-at-bat/resolvePitch`)이 그 한 장을 `detail.pattern` 으로
 * 실어 보내므로 여기서는 **그 패턴 그대로** 궤적을 만든다 — 다시 뽑지 않는다. 궤적은
 * `entities/batting/model/battedBallFlight`(원본 세계 0xbfed0)를 그대로 쓴다.
 *
 * ## 종류 8 판 (2026-10-07 직접 뜸)
 * ```
 * 46418  상태 0x17 진입: [장면+0x1104] == 7 → 0xb0cb8(플레이, 8)(+0x118 · state[0x26] = 8) · 0xa9250(주자관리 +0x31c · +0xc = 0)
 * 464d8    종류 8 이면 타자주자 만들기(0xa93ad)를 건너뛴다 → 주자가 하나도 없다(0x3d7b8 리드 굴림 고리도 0번)
 * b29f2  플레이 vt18 종류 8: vt1c(0xb0edc 지우기 — +0x130 = −1 등) · vt20(1) · 공+0x68 = 0 · +0x125 = 1
 *        종류 1 과 달리 예보 vt24(0xb12d0) · 고르기 vt34(0xb3b38) · 커버 vt30 을 안 부른다
 * 52512  슬롯 2: r5 = 0xae600(state[0x26] ≠ 8) · [sp+0x14] = 0xae61c(종류 ∉ 마스크 0x58c = 2·3·7·8·10)
 * 52546    → 종류 8 이면 공 틱 vt48(0xb401c) · 플레이 틱 vt4c(0xb45dc) · 주자 틱 · 자동 진루 · CPU 송구를 **하나도 안 돈다**
 * ```
 * 그래서 이 판에는 포구 · 쥐기(b2766) · 펌블 굴림(0xb41d0) · 판 끝 결과 코드(b44f6 의 0x9d5bc) · 사건 메시지 0xbba 가 없다 —
 * 포구 틱 +0x174 는 장면 new(0x1238 → 0x2ac4 가 0 으로 채움)의 0 이 남아 공 틱(≥ 1)과 만나지도 않는다. 야수는 쫓지 않는다.
 * 레이저 창 0xb2648 도 `+0x174 − 공 틱 == 10` 이 안 서 굴림 0x523bc 가 안 돈다. 필살수비 굴림은 0x50fba 가 모드 7 이면 없다.
 * **난수는 쏘기 · 세계(51172~511a4) 안의 폴 충돌 rand(−25, 25)(0xa2c64) 하나뿐**이다(`trajectoryWithRandom`).
 *
 * ## 슬롯 2 의 모드 7 갈래 0x526ca (공 틱 t, 관문이 열린 동안)
 * ```
 * 526d0  aa0 ≥ t → state[0x36] = min(|지금 점 − (20000,1000,30000)| / 265, 160)                 ; 표시 비거리
 * 52720  (aa4 == t && aa0 ≥ t) || (ab0 == t && aa0 ≥ ab0) → 0xb68dc(파울 각)가 거짓이면:
 * 52766    state[0x3b](이번 공 홈런) = state[0xf] = state[0x1d] = 1 · 0xa600c(낙구 점 aa0) · +0x1960 = 1(HOMERUN 글자) ·
 *          0x90191(…, 2, 1) · 소리 11(0x527c4 `movs r1,#0xb` → 0x6ea6d)
 * 527f0  aa0 == t && state[0x1d] == 0 && [장면+0xfe7] == 0 → 0xa600c(지금 점) ; 0xb68dc 면 소리 25 "Foul!"(0x5284a)
 * a600c  state[0x26] == 8 && !0xb68dc → 누적 +0x34 += min(|점 − (20000,1000,30000)| / 265, 160)
 * ```
 * - 홈런은 공이 땅에 닿기 전(같은 틱 포함)에 담장선(aa4)을 넘거나 폴(ab0)에 맞은 페어 각 공이다. 결과 코드 8 · 12 와 거의 같지만
 *   폴 뒤 굴림으로 다시 깐 궤적 · 폴 뒤 바운드로 담장을 넘는 공(코드 10)까지 이 갈래가 정한다.
 * - ⚠️ **원본 그대로**: a600c 의 `state[0x26] == 8` 은 결과 코드가 아니라 **판 종류**다(0xb0cb8 이 +0x118 과 함께 적는 칸). 종류 8 판은
 *   사건 코드 처리(0xb2bc4)가 안 돌아 종류가 끝까지 8 이라 늘 참이다 — 그래서 **홈런이 아닌 페어 타구도 낙구 지점 비거리가
 *   누적에 더해진다**(527f0). 파울 각 공은 더하지 않고 낙구 틱에 "Foul!" 25 를 낸다.
 * - ⚠️ **원본 그대로**: 52720 은 state[0x1d] 를 안 봐서 폴에 맞고(ab0) 땅에 닿기 전에 담장선(aa4)도 넘는 공은 두 번 홈런 갈래를
 *   지나 비거리를 두 번 더하고 11 도 두 번 낸다.
 * - [장면+0xfe7] 은 0x17 진입 0x46460 이 0 으로 지우고 세우는 곳은 메시지 0xbba 갈래(0x51a0c)뿐이라 더비 판에서는 늘 0 이다.
 * - 관문 0xb0d28: 파울 표시 +0x110 · 사건 코드 11 · 주자 · 아웃 갈래는 사건이 없어 안 서고, +0x125 갈래가 공.vt18(멈춤)에서 닫는다.
 *   공 틱은 0x3f060 이 관문이 열려 있을 때만 올리므로(0x3f3b2 → 0xa2594) 위 갈래는 t = 1 … (처음 멈춘 틱 − 1)에서 돈다.
 *   닫힌 뒤 529f0 이 +0x1094 10틱 → 0xbb9 → 52a52 0xae3e8 모드 7 갈래(`applyDerbyPitch`).
 */

/** 판 진행 관문 0xb0d28 이 닫힌 뒤 장면이 판을 마무리하기까지의 틱 — 슬롯 2 의 529f0 `+0x1094` 10틱 → 메시지 0xbb9 */
export const DERBY_PLAY_CLOSE_TICKS = 10

/** 홈런 함성 — 슬롯 2 모드 7 갈래 0x527c4 `movs r1,#0xb` → 0x6ea6d (즉시) */
export const DERBY_HOME_RUN_SOUND = 11

export interface DerbyBattedBall {
  readonly pattern: BattedBallPattern
  /** 판이 쏜 궤적 — 폴에 맞는 공은 판 시작의 rand(−25, 25)로 다시 깐 것 */
  readonly trajectory: BattedBallTrajectory
  readonly landing: WorldPoint
  /** 슬롯 2 모드 7 갈래가 홈런으로 본 공인가 — state[0x3b] (0xae3e8 의 "이번 공 홈런") */
  readonly isHomeRun: boolean
  /** 이 공으로 누적(+0x34)에 더한 비거리 (0xa600c — 홈런 · 홈런 아닌 페어 공의 낙구, 파울은 0) */
  readonly distance: number
  /** 홈런 갈래를 지난 공 틱들 — 그 틱에 소리 11 (`DERBY_HOME_RUN_SOUND`) */
  readonly homeRunTicks: readonly number[]
  /** 파울 각 공이 땅에 닿은 틱 — 그 틱에 소리 25 "Foul!"(0x5284a). 없으면 null */
  readonly foulCallTick: number | null
  /**
   * 이 공의 판이 끝나는 틱 — 홈런더비 판(종류 8)은 판 시작 b2a10 이 +0x125 를 세워 관문 0xb0d28 이
   * **공.vt18(0xa27f0) 멈춤**에서만 닫는다(주자·포구를 안 본다). 재생 0x3f3c6 은 매 틱 공+0x68 을 올리므로 처음 멈춘 점의 틱에
   * 닫히고, 그 뒤 10틱(`DERBY_PLAY_CLOSE_TICKS`)에 장면이 0xbb9 로 넘긴다.
   */
  readonly endTicks: number
}

/** 공+0x68 이 처음으로 멈춘 점(vt18)에 닿는 틱. 끝까지 안 멈추면 마지막 점의 틱 */
export function derbyBallStopTickOf(trajectory: BattedBallTrajectory): number {
  for (let tick = 0; tick < trajectory.length; tick += 1) {
    if (trajectory.isStoppedAt?.(tick) === true) return tick
  }
  return trajectory.length - 1
}

/**
 * 이번 타구(타석이 뽑은 패턴)로 홈런더비 판 하나를 돌린다 (머리말).
 *
 * `random` 을 주면 폴 충돌 굴림(0xa2c64)이 돈다 — 폴에 맞는 궤적만 하나를 쓰고, 그 밖의 궤적은 난수를 안 쓴다.
 * 안 주면 굴림 없는 궤적 그대로다(시험 · 판 길이 미리 보기).
 */
export function derbyBattedBallOf(pattern: BattedBallPattern, random?: RandomPort): DerbyBattedBall {
  const trajectory = trajectoryWithRandom(battedBallTrajectory(pattern), random)
  const landingTick = trajectory.landingTick
  const stopTick = derbyBallStopTickOf(trajectory)
  // 0xb68dc — 더비는 state[0x19] = 0(0x35034 가 모드 7 이면 굴리지 않음) · state[0x1f] = 0(쥐는 이가 없음)이라 쏜 각 state[0x1c] 그대로
  const isFoul = !isFairAngle(pattern[0])

  let isHomeRun = false
  let distance = 0
  const homeRunTicks: number[] = []
  let foulCallTick: number | null = null
  for (let tick = 1; tick < stopTick; tick += 1) {
    // 52720 — 담장선 틱(aa4)이 낙구 이전이거나, 폴 틱(ab0)이 낙구 이전
    const reachesHomeRun =
      (trajectory.fenceTick === tick && landingTick >= tick) ||
      (trajectory.poleTick === tick && landingTick >= trajectory.poleTick)
    if (reachesHomeRun && !isFoul) {
      isHomeRun = true
      // 52780 — 낙구 틱의 점으로 0xa600c
      distance += derbyDistanceOf(trajectory.pointAt(landingTick))
      homeRunTicks.push(tick)
    }
    // 527f0 — 낙구 틱, 아직 홈런이 아니면(state[0x1d] == 0) 지금 점으로 0xa600c · 파울이면 25
    if (landingTick === tick && !isHomeRun) {
      if (isFoul) foulCallTick = tick
      else distance += derbyDistanceOf(trajectory.pointAt(tick))
    }
  }

  return {
    pattern,
    trajectory,
    landing: landingPointOf(trajectory),
    isHomeRun,
    distance,
    homeRunTicks,
    foulCallTick,
    endTicks: stopTick + DERBY_PLAY_CLOSE_TICKS,
  }
}
