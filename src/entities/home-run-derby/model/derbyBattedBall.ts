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
 * - (재검증 2026-10-07 — 0xa600c · 0xb0cb8 · 0xae600 · 0xae61c · 0x524c0 직접 뜸) state[0x26] 에 쓰는 곳은 **0xb0cb8 하나뿐**이다
 *   (`adds rX,#0x26 ; strb` 전수 — 0x3db6c · 0x9f802 · 0xb884c~0xb8992 는 다른 구조체). 0xb0cb8 을 부르는 곳과 값:
 *   0x3de10(1, 공 준비) · 0x3dfac(9 · 5 · 2) · 0x46418(8, 모드 7 의 0x17 진입) · 0x4e6d4(5) · 0x50d34(4, 견제) · 사건 0xb2bc4(6 · 7 · 0xa).
 *   0x17 동안 사건 0xb2bc4 를 부르는 공 틱 vt48(0x525e8)은 0xae61c 가 거짓이면(종류 8) 안 돈다 → 더비 판 내내 8 이다.
 *   0xa600c 를 부르는 곳은 이 갈래의 0x52794 · 0x52828 둘뿐이라 그 `== 8` 은 "더비 판인가" 문지기다. 읽는 쪽(0xa8024 의 4·5 ·
 *   0xae576 · 0xae600 · 0xae61c)도 모두 판 종류로 읽는다. 해독 문서 H-modes "결과 코드(+0x26)가 8(홈런)" 은 틀린 풀이다.
 *   [this+8] 은 0xa5fac(+0x13 번트) · 0xa8024(+0x26) 와 같은 경기 상태이고, +0x34 를 HUD 0x45a54 · 단계 0xae4b6 · 정산 0x4f644 가 읽는다.
 * - [장면+0xfe7] (재검증): 0x17 진입 0x46460 이 0 으로 지우고, 세우는 곳은 **키 메시지 0x587 처리 0x519cc** 하나다 — 0x17 키 처리
 *   0x53420 이 키마다 끝에 0x587(0)을 보내고(0x53452), 0x509a0 분기(0x50afe)가 0x519cc 로 간다. 0x519cc 는
 *   `state[0x1d] || 플레이+0x129 || state[0xb] ∈ {3, 4}` 일 때만 +0xfe7 = 1 · HOMERUN 글자 +0x1960 = 0 · +0x1100 = 0(0x51a04~0x51a18).
 *   더비는 사건이 없어 홈런 갈래가 state[0x1d] 를 세운 뒤에만 선다 → 527f0 은 이미 state[0x1d] 로 막혀 있어 비거리 셈과 무관하다.
 *   +0xfe7 이 서면 5284e 가 틱마다 0xbf01c(공) → 0xa25ac(공+0x68 = 그 값)으로 공 틱을 끝으로 넘긴다 — 홈런 뒤 키로 건너뛰기
 *   (`skipDerbyBattedBall`, 화면은 `useHomeRunDerby` 의 `skipHomeRun`).
 * - 표시 비거리 +0x36 (526d0): aa0 ≥ t 인 틱마다 지금 점으로 다시 쓴다 — 홈런 · 파울 가리지 않고 **낙구 틱 점의 비거리**가 남는다
 *   (`displayDistance`). 더하는 값(`distance`)과 달리 두 번 더한 공도 한 번 값이다. 쓰는 곳은 이 526d0 · 일반 갈래 0x5297a ·
 *   초기화 0xb687e 뿐이라 안 맞은 공은 앞 값을 그대로 둔다. 읽는 곳은 비거리 판 그리기 0x36cd4(플레이+0x118 == 8 이거나 +0x1960 이면
 *   trainning.pzx 프레임 11 을 (W/2 − 폭/2, 10) 에, 그 밑 +0x36 숫자 — ← 0x37388 · 0x46cb6). 판은 상태 0x17 그리기(0x46c88)에서만
 *   불려 판 내내(관문이 닫힌 뒤 10틱까지) 보이고, 숫자는 틱마다 다시 쓴 값을 따라 오른다(`displayDistanceTicks` ·
 *   `derbyDisplayDistanceAt` → pages/home-run-derby `DerbyHud` 의 비거리 판).
 * - HOMERUN 글자 (재검증): 이 갈래는 +0x1961(단계) = [sp+0x10](= 0xb68dc 결과 = 0) · +0x1960 = 1 만 쓴다(0x5279a~0x527ac).
 *   일반 홈런 0x51cd8 과 달리 **+0x1963(틱 셈) = 0 · 글자 칸 +0x1964+i = 5+i 를 안 쓴다** — 칸을 쓰는 곳은 0x51cf6 · 그리기 0x40b18 뿐이고
 *   더비 장면은 일반 홈런 갈래를 안 지나 칸이 장면 new 의 0 그대로다 → 날아 들어오기 없이 0 칸(제자리)부터, 단계 0 은 (2 − 남은 +0x1963) 그림.
 *   글자를 끄는 곳은 0x17 끝 0x35108(0x351d0) · 위 키 건너뛰기. 그리기 0x40b18 은 0x46c88 이 `관문 0xb0d28 열림 && (state[0x1d] ||
 *   +0x129)` 일 때만 부르므로(0x46e2e~0x46e5c) 글자는 홈런 틱 h … closeTick − 1 에만 보인다. 타석 화면(`BattingStage` 의 `homeRunText`)이
 *   이 창으로 그린다 — 단계 셈은 widgets/batting-stage `homeRunBanner` 의 `derbyHomeRunTextOn` · `homeRunTextAfterDraws`.
 * - 0x90191([0x1400064], 2, 1) 뒤 +8 = +9 = 1 (0x527b4~0x527c0): 장면 효과 객체(0x90190 → 0x8fe58)를 **종류 2(알갱이 칸 7)** 로 다시
 *   깔고 켠다 — 일반 홈런 0x51d1e 와 같은 홈런 효과다(0x4f4d8 은 홈런이 아니라 경기 정산 0x4ea0c 갈래다 — entities/batting
 *   `homeRunFireworks` 머리말). 틱 0x901a0 은 0x40b18 이 **HOMERUN 글자 유지 단계(+0x1961 ≥ 4)를 그린 뒤**(0x40faa)에만 부른다.
 *   ⚠️ 미이식(난수): 알갱이 틱 · 파티클 굴림은 `homeRunFireworks` 머리말의 미해결 때문에 아직 진행기에 안 붙였다.
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
  /**
   * 표시 비거리 +0x36 — 526d0 이 aa0 ≥ t 인 틱마다 지금 점으로 다시 쓴 마지막 값(낙구 틱 점, 파울 포함, 상한 160).
   * 그런 틱이 하나도 없으면 null(앞 값 그대로).
   */
  readonly displayDistance: number | null
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
  /**
   * 판 진행 관문 0xb0d28 이 닫히는 공 틱 — 보통은 공이 처음 멈춘 틱(`derbyBallStopTickOf`), 홈런 뒤 키로 건너뛰었으면
   * 키를 받은 틱 + 1 (`skipDerbyBattedBall`). 위 갈래는 t = 1 … closeTick − 1 에서 돈다.
   */
  readonly closeTick: number
  /**
   * 표시 비거리 +0x36 을 다시 쓴 틱과 값 (526d0 — 관문이 열린 동안 aa0 ≥ t 인 틱마다). 비거리 판 0x36cd4 가 틱마다 이 칸을 읽어
   * **공이 나는 동안 숫자가 따라 오른다**. 비어 있으면 앞 값 그대로다(`derbyDisplayDistanceAt`).
   */
  readonly displayDistanceTicks: readonly { readonly tick: number; readonly value: number }[]
  /** 홈런 뒤 키로 건너뛴 틱(키 메시지 0x587 → 0x519cc 를 받은 공 틱). 안 건너뛰었으면 null */
  readonly skippedAtTick: number | null
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
  return derbyPlayOf(pattern, trajectory, null)
}

/**
 * **홈런 뒤 키로 건너뛰기** (2026-10-07 직접 뜸 — 0x53420 · 0x519cc · 0x5284e · 0xbf01c · 0xa2b78).
 * ```
 * 53450  0x17 키 처리: 키마다 끝에 메시지 0x587(0) — 갈림 없이 모든 키
 * 519cc  0x587: state[0x1d] || 플레이+0x129 || state[0xb] ∈ {3, 4} 일 때만 →
 *        0x6e418(소리 멈춤) · [장면+0xfe7] = 1 · HOMERUN 글자 +0x1960 = 0 · +0x1100 = 0 ·
 *        0x8fc70(홈런 효과 객체 칸 버리기) · 파티클 관리자 +0x57 = 0 · 0x6dee4(파티클 모두 지우기)
 * 5284e  모드 7 갈래 끝: +0xfe7 이면 공+0x68 = 0xbf01c(공)                       ; 틱마다 (위 갈래 다음)
 * bf01c  +0x3c(수평 속도) == 0 ? 1000 : ⌈(|+0x14.x − +0x2c.x| + |+0x14.z − +0x2c.z|) / +0x3c⌉
 * a2b78  점 꺼내기는 번호를 [0, +0x6c − 1] 로 자른다 → 1000 은 마지막 점(멈춘 점)
 * ```
 * - 키는 그 그림의 갱신보다 먼저 돈다(0x52c50: 키 0x498d4 → 공용 갱신 0x3f060(공 틱 +1) → 슬롯 2). 그래서 키를 받은 틱 k 의
 *   위 갈래는 그대로 돈 뒤(526d0 표시 비거리 · 52720 홈런 — 527f0 은 +0xfe7 로 막히지만 state[0x1d] 가 이미 서 있어 같다)
 *   공 틱이 0xbf01c 값으로 넘어가고, 다음 틱(k + 1)의 관문 0xb0d28 이 멈춘 점을 보고 닫는다 → 10틱 뒤 0xbb9.
 *   (더비 홈런 공은 원본 패턴 표 99장 모두 미리 계산이 멈춤으로 끝나 +0x3c = 0 → 1000 → 마지막 점이다. 속도가 남은 공이면
 *   ⌈거리/속도⌉ 번 점이 안 멈춘 점일 수 있고 원본은 그 점에서 다시 재생한다 — 표에 없어 미이식.)
 * - 더비는 사건 코드가 없어(+0x129 · state[0xb] 가 안 선다) **홈런 갈래가 state[0x1d] 를 세운 뒤의 틱**에만 건너뛴다 — 홈런 틱 h 의
 *   갱신이 끝난 다음 그림부터(k > h). 관문이 이미 닫힌 뒤(k ≥ closeTick)면 판 길이는 그대로다.
 * - 건너뛰면 폴(ab0) 뒤 담장선(aa4)에서 한 번 더 지나는 홈런 갈래(두 번 더하기)가 k 뒤라면 안 선다 — 비거리 · 표시 비거리도 k 까지만이다.
 *
 * 건너뛸 수 없는 틱이면 같은 공을 그대로 돌려준다. 난수를 쓰지 않는다(이미 깐 궤적을 다시 돈다).
 */
export function skipDerbyBattedBall(batted: DerbyBattedBall, keyTick: number): DerbyBattedBall {
  if (batted.skippedAtTick !== null) return batted
  const firstHomeRunTick = batted.homeRunTicks[0]
  if (firstHomeRunTick === undefined || keyTick <= firstHomeRunTick || keyTick >= batted.closeTick) return batted
  return derbyPlayOf(batted.pattern, batted.trajectory, keyTick)
}

/** 틱 t 에 비거리 판 0x36cd4 가 읽는 표시 비거리 +0x36 — 그 틱까지 마지막으로 쓴 값, 없으면 `previous`(앞 공의 값) */
export function derbyDisplayDistanceAt(batted: DerbyBattedBall, tick: number, previous: number): number {
  let value = previous
  for (const written of batted.displayDistanceTicks) {
    if (written.tick > tick) break
    value = written.value
  }
  return value
}

/** 판 하나를 공 틱 1 … closeTick − 1 로 돈다. `skipTick` 이면 그 틱을 끝으로 공 틱을 넘기고 다음 틱에 관문이 닫힌다 */
function derbyPlayOf(
  pattern: BattedBallPattern,
  trajectory: BattedBallTrajectory,
  skipTick: number | null,
): DerbyBattedBall {
  const landingTick = trajectory.landingTick
  const stopTick = derbyBallStopTickOf(trajectory)
  // 5284e → 다음 틱 52502 의 관문이 마지막 점(멈춤)을 보고 닫는다
  const closeTick = skipTick === null ? stopTick : Math.min(stopTick, skipTick + 1)
  // 0xb68dc — 더비는 state[0x19] = 0(0x35034 가 모드 7 이면 굴리지 않음) · state[0x1f] = 0(쥐는 이가 없음)이라 쏜 각 state[0x1c] 그대로
  const isFoul = !isFairAngle(pattern[0])

  let isHomeRun = false
  let distance = 0
  const homeRunTicks: number[] = []
  let foulCallTick: number | null = null
  let displayDistance: number | null = null
  const displayDistanceTicks: { tick: number; value: number }[] = []
  for (let tick = 1; tick < closeTick; tick += 1) {
    // 526d0 — 아직 낙구 전(aa0 ≥ t)이면 state[0x36] = 지금 점 비거리 (홈런 · 파울 가리지 않음)
    if (landingTick >= tick) {
      displayDistance = derbyDistanceOf(trajectory.pointAt(tick))
      displayDistanceTicks.push({ tick, value: displayDistance })
    }
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
    // 527f0 — 낙구 틱, 아직 홈런이 아니고(state[0x1d] == 0) 건너뛰기(+0xfe7)도 아니면 지금 점으로 0xa600c · 파울이면 25.
    // 건너뛰기는 홈런 뒤에만 서므로 이 갈래는 state[0x1d] 로 이미 막혀 있다
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
    displayDistance,
    homeRunTicks,
    foulCallTick,
    endTicks: closeTick + DERBY_PLAY_CLOSE_TICKS,
    closeTick,
    displayDistanceTicks,
    skippedAtTick: closeTick < stopTick ? skipTick : null,
  }
}
