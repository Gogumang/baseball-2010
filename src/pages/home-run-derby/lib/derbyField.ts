import type { WorldPoint } from '@/entities/fielding/model/fieldGeometry'
import { FIELDER_START_POSITIONS } from '@/entities/fielding/model/fieldGeometry'
import type { DerbyBattedBall } from '@/entities/home-run-derby/model/derbyBattedBall'
import { isBallInEventZone } from '@/entities/home-run-derby/model/eventZone'
import { ballParticleFactsOf } from '@/features/defense-play/model/ballParticleFacts'
import { isBallBeyondFence } from '@/features/defense-play/model/runDefensePlay'
import { ballParticleShotsOf } from '@/pages/defense/lib/ballParticles'
import { type CameraState, cameraBoundsOf, centerOn, screenOffsetOf, stepCamera, toScreenX, toScreenY } from '@/pages/defense/lib/defenseCamera'
import { FIELDER_ACTION } from '@/shared/config/original/defenseAnimations'
import type { DefenseFielder } from '@/entities/fielding/model/defenseView/defenseFigures'
import type { DefenseViewState } from '@/entities/fielding/model/defenseView/defenseViewState'
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '@/pages/defense/ui/DefenseScreen.css'
import { isBugFixed } from '@/shared/config/bugfixes'

/**
 * **홈런더비 판(상태 0x17)의 필드 화면** (A-01, r274 직접 떴다).
 *
 * 더비 판도 다른 모드의 수비 화면과 **같은 그리기**다 — 모드 7 갈래는 몇 칸뿐이다.
 * ```
 * 52f36  0x41230  틀 그리기: 필드 카메라 [+0x1e8](2D 따라가기형 0xc0570, 배율 [+0x1f0] = 40000×32500 → 620×500)로 오프셋
 *                 (+0xfec, +0xff0) = −카메라 × 620/40000 · 500/32500 (0xb9481). 상태 0x17 은 0x33c98 참이라 413a2 0x411e0 →
 *                 구장 0x78931(defense.pzx 두 장) → 4121a 0x41098(모드 7 이면 event_zone 프레임 0 을 오프셋에 · 존이 서면 깜빡임 · 200G)
 * 52fe6  0x46c88  비거리 판 0x36cd4(46cb6) → 야수 0x43278(칸 0 은 0xae83d · 0xb633d 면 투수 마선수 그림) → 주자 0x43a0c(더비 판은
 *                 타자주자도 없다) → 공 0x36dfc(그림자 · 이벤트 존 · 파티클은 곧바로, 공은 목록) → 목록 비우기 → 결과 판 0x46844(판 종류 8 이면
 *                 작은 지도 0x395f4 를 건너뛴다) → HOMERUN 글자 0x40b18
 * 3f060  갱신(G1) — 관문 0xb0d28 이 열려 있으면 목록 틱 · 카메라 vt20(공 (x, z − y)) · vt28(20%/틱). 진입 0x46418(466d0)이 공 첫 점
 *                 (x, z)로 곧바로 맞춘 뒤 같은 틀의 G1 부터 따라간다(진입 표 → 키 → 0x3f060 차례). 홈런 칸 P+0x111 은 사건 처리가 안 도는
 *                 더비 판에서 늘 0 이라 공만 본다
 * ```
 * - **필드 카메라는 0xbe3d8 이 아니다.** 0xbe3d8 은 타석 투영기 [+0x218](vt+8)이고, 필드는 [+0x1e8] 의 2D 카메라 · 배율 0xb9481 이다.
 *   [+0x1ec] 는 타석 카메라(480×390, +0xff4 · +0xff8)다. 그래서 웹 수비 화면(`pages/defense` 의 `defenseCamera` · `DefenseScreen`)의
 *   투영을 그대로 쓴다 — 새로 풀 투영 수식이 없다.
 * - 야수는 판 시작 vt20(0xb0fb4 b1124)이 0xd86ec 자리에 세우고, 종류 8 판은 플레이 틱(AI)을 안 돌려 그 자리에 선다(`derbyBattedBall` 머리말).
 * - 공은 판 공 [+0x204] 의 점(공+0x68 — 진입 그림은 0 이라 안 그린다). 관문이 닫히면(멈춤 · 키 건너뛰기) 공 틱 · 카메라가 선다.
 *
 * **이벤트 존** (U-93 — 0x36dfc 3726c~3732a, 그림자 0x356f8 바로 뒤):
 * ```
 * 3726c  h = 높이 투영 (0, y) 의 둘째 값 ≤ 0x36 이고 모드 7 이고 존(+0x17cc · +0x17d0)이 둘 다 −1 이고
 * 37292  땅점 화면 y = +0xff0 + z 투영 < 화면 높이 0x14008c8 / 3 이고
 * 372b4  0x357e0([+0xfd4] − 24 ≤ 2 — 결과 코드 24~26) 이고 플레이 +0x127(패턴 플래그 & 2) 이면
 * 372d4    +0x17cc = +0xfec + x 투영 · +0x17d0 = 땅점 y(14 이하면 15) · 경기+0x3f = 1(공 끝 0xae3e8 이 보너스 +200G) ·
 *          trainning 애니 3 을 첫 칸으로 되감아 반복 재생(0x93d31 · 0x93cfd)
 * ```
 * 이 갈래에 닿는 그림은 공을 그리는 그림(36e86)이고 땅점 y ≥ 1(36fce)이다. 곧 **홈런성 결과 코드의 큰 뜬공 패턴이 화면 위쪽(관중석 쪽)
 * 낮은 높이로 날아든 그림**에서 선다. 예전 웹은 "공 화면 y < 높이/3" 와 결과 코드 24~26 을 안 봐 플래그 & 2 인 패턴(주로 결과 18~20)마다
 * 200G 를 주었다 — 원본은 결과 18~20 에서 존이 안 선다.
 */

/** 화면 (W, H) = (0x14008b8, 0x14008c8) */
const SCREEN = { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } as const
/** 0x3726c `cmp r3, #0x36` — 높이 투영 상한 */
const ZONE_HEIGHT_LIMIT = 0x36
/** 0x372e6 — 존 y 하한(14 이하면 15) */
const ZONE_TOP_LIMIT = 0xe
const ZONE_TOP = 0xf
/** 0x357e0 — 결과 코드 24~26 */
const HOME_RUN_HIT_CODES: readonly number[] = [24, 25, 26]
/** 판 종류 — 홈런더비 판 (0x46418 0xb0cb8(플레이, 8)) */
const DERBY_PLAY_KIND = 8
/** 0xbf01c — 키 건너뛰기가 공 틱으로 적는 값(더비 홈런 공은 멈춰 +0x3c = 0 → 1000). 점은 0xa2b78 이 마지막 점으로 자른다 */
const SKIPPED_BALL_TICK = 1000

export interface DerbyFieldInput {
  readonly batted: DerbyBattedBall
  /** 경기 +0xfd4 — 판정 결과 코드(방향 포함) */
  readonly resultCode: number | null
  /** 플레이 +0x127 — 패턴 플래그 & 2 (0x514e6) */
  readonly isBigFlyPattern: boolean
  /** 경기 +0x199a — 0x13 이 세운 감상 플래그(0x392ac). 공 그리기의 큰 타구 파티클(36f76)이 본다 */
  readonly watchesBigHit: boolean
}

/** 판 틱 t(0x17 진입 그림 = 0)의 그림 한 장 */
export interface DerbyFieldFrame {
  /** 공+0x68 — 진입 그림은 0, 관문이 닫힌 뒤 그대로, 건너뛰면 1000 */
  readonly ballTick: number
  /** 이 그림의 필드 카메라 [+0x1e8] (갱신 G1 뒤) */
  readonly camera: CameraState
}

export interface DerbyEventZone {
  /** 존을 놓은 그림(판 틱) — 0x41098 은 다음 그림부터 깜빡임 · 200G 를 그린다 */
  readonly tick: number
  /** +0x17cc · +0x17d0 (화면 좌표) */
  readonly x: number
  readonly y: number
}

export interface DerbyFieldTimeline {
  /** 판 틱 0 … 판 끝(`endTicks`)의 그림 */
  readonly frames: readonly DerbyFieldFrame[]
  readonly zone: DerbyEventZone | null
}

/** 판 틱 t 의 공+0x68 (`DerbyFieldFrame.ballTick`) */
export function derbyFieldBallTickAt(batted: DerbyBattedBall, tick: number): number {
  if (tick <= 0) return 0
  if (batted.skippedAtTick !== null && tick >= batted.skippedAtTick) return SKIPPED_BALL_TICK
  return Math.min(tick, batted.closeTick)
}

const pointAt = (batted: DerbyBattedBall, ballTick: number): WorldPoint =>
  batted.trajectory.pointAt(Math.max(0, Math.min(ballTick, batted.trajectory.length - 1)))

/** 0x36dfc 36e24 · 36e86 — 공(그림자 · 존 · 파티클)을 그리는 그림인가 */
export function isDerbyBallDrawn(batted: DerbyBattedBall, ballTick: number): boolean {
  if (ballTick <= 0) return false
  // 더비 판은 사건 처리(0xb2bc4)가 안 돌아 홈런 칸 P+0x111 이 늘 0 — 담장선이 있는 공만 사라진다
  return !isBallBeyondFence(ballTick, batted.trajectory.landingTick, batted.trajectory.fenceTick, false)
}

/** 판 하나의 카메라 · 공 틱 · 이벤트 존 — 난수를 안 쓴다 */
export function derbyFieldTimelineOf(input: DerbyFieldInput): DerbyFieldTimeline {
  const { batted } = input
  const bounds = cameraBoundsOf(SCREEN.width, SCREEN.height)
  const first = pointAt(batted, 0)
  // 진입 0x46418 466d0 — 공 점 0xa25d4 의 (x, z) 로 곧바로 (높이를 안 뺀다)
  let camera = centerOn(bounds, { x: first.x, z: first.z })
  const frames: DerbyFieldFrame[] = []
  let zone: DerbyEventZone | null = null
  for (let tick = 0; tick <= batted.endTicks; tick += 1) {
    // G1(3f0b8) — 관문이 열려 있으면 그 틀 머리의 공 점(갱신 전 공 틱)으로 따라간다. 닫힌 틱부터 카메라가 선다
    if (tick < batted.closeTick) {
      const target = pointAt(batted, tick)
      camera = stepCamera(bounds, camera, { x: target.x, z: target.z - target.y })
    }
    const ballTick = derbyFieldBallTickAt(batted, tick)
    frames.push({ ballTick, camera })
    if (zone === null) zone = eventZoneAt(input, tick, ballTick, camera)
  }
  return { frames, zone }
}

/** 0x36dfc 의 존 갈래 (머리말) — 이 그림에서 존을 놓으면 그 자리 */
function eventZoneAt(input: DerbyFieldInput, tick: number, ballTick: number, camera: CameraState): DerbyEventZone | null {
  if (!isDerbyBallDrawn(input.batted, ballTick)) return null
  const point = pointAt(input.batted, ballTick)
  const offset = screenOffsetOf(camera)
  const height = toScreenY(point.y)
  const groundY = offset.y + toScreenY(point.z)
  if (!isZoneSpot(height, groundY)) return null
  if (!isHomeRunBigFly(input)) return null
  // B-32 고침 — 존 좌표(372d4~372e4, 공 땅점 화면 자리)에서 필드 오프셋을 뺀 자리가 존 그림 두 칸 안일 때만 적중. 굴림 없음
  if (isBugFixed('B-32') && !isBallInEventZone({ x: toScreenX(point.x), y: groundY - offset.y })) return null
  return { tick, x: offset.x + toScreenX(point.x), y: groundY > ZONE_TOP_LIMIT ? groundY : ZONE_TOP }
}

/** 존을 놓을 수 있는 공 자리 — 높이 투영 · 땅점 화면 y (머리말 조건) */
function isZoneSpot(height: number, groundY: number): boolean {
  // 36fba · 36fce — 높이 투영 < 0 이거나 땅점 화면 y < 1 이면 그림자 · 존이 없다
  if (height < 0 || groundY < 1) return false
  if (height > ZONE_HEIGHT_LIMIT) return false
  if (groundY >= Math.trunc(SCREEN.height / 3)) return false
  return true
}

/** 홈런성 결과 코드이고 큰 타구 무늬인가 */
function isHomeRunBigFly(input: DerbyFieldInput): boolean {
  return HOME_RUN_HIT_CODES.includes(input.resultCode ?? -1) && input.isBigFlyPattern
}

/** 판 틱 t 의 그림 — 판 끝을 넘으면 마지막 그림 */
export function derbyFieldFrameAt(timeline: DerbyFieldTimeline, tick: number): DerbyFieldFrame {
  return timeline.frames[Math.max(0, Math.min(tick, timeline.frames.length - 1))]!
}

export interface DerbyFieldLook {
  /** 수비 팀 = 장면 시작이 뽑은 상대 팀 v (3a454 · 3a476 0xb6bd5(ctx, 1, v)) — defender.mpl 벌 */
  readonly defenseTeamIndex: number | null
  /** 마운드 투수가 마투수(0xb633d)면 그 순번 0~4 — 칸 0 을 투수 마선수 그림(0x79ab0 · 0xd4008)으로 */
  readonly acePitcherOrder: number | null
}

/** 판 틱 t 의 수비 화면 스냅샷 (`DefenseScreen`) */
export function derbyFieldViewOf(input: DerbyFieldInput, timeline: DerbyFieldTimeline, tick: number, look: DerbyFieldLook): DefenseViewState {
  const { batted } = input
  const frame = derbyFieldFrameAt(timeline, tick)
  const point = pointAt(batted, frame.ballTick)
  const fielders: DefenseFielder[] = FIELDER_START_POSITIONS.map((position, slot) => ({
    slot,
    x: position.x,
    z: position.z,
    action: FIELDER_ACTION.stand,
    actionTick: Math.max(0, tick),
    teamIndex: look.defenseTeamIndex,
    aceIndex: slot === 0 ? look.acePitcherOrder : null,
  }))
  return {
    ball: {
      x: point.x,
      z: point.z,
      height: point.y,
      isFlying: frame.ballTick < batted.closeTick,
      isStopped: frame.ballTick >= batted.closeTick,
      isPlaybackStart: frame.ballTick <= 0,
      isBeyondFence: frame.ballTick > 0 && !isDerbyBallDrawn(batted, frame.ballTick),
    },
    fielders,
    runners: [],
  }
}

/**
 * 판 틱 t 의 그림이 공 그리기 0x36dfc 에서 쏘는 파티클 — 큰 타구(36f76: +0x199a && 판 종류 8) · 튐(36fe0). 화면 자리는 그 그림의 카메라 오프셋
 * (`lib/ballParticles` — 수비 화면과 같은 셈)
 */
export function derbyFieldShotsAt(
  input: DerbyFieldInput,
  timeline: DerbyFieldTimeline,
  tick: number,
): readonly { readonly id: number; readonly img: number; readonly x: number; readonly y: number }[] {
  if (tick < 0 || tick >= timeline.frames.length) return []
  const frame = timeline.frames[tick]!
  if (!isDerbyBallDrawn(input.batted, frame.ballTick)) return []
  const point = pointAt(input.batted, frame.ballTick)
  const facts = ballParticleFactsOf({
    ballTick: frame.ballTick,
    at: frame.ballTick,
    trajectory: input.batted.trajectory,
    onTrajectory: true,
    bigHitWatch: input.watchesBigHit,
    playKind: DERBY_PLAY_KIND,
    resultCode: input.resultCode,
  })
  const state = { ball: { x: point.x, z: point.z, height: point.y, isFlying: true }, ballParticles: facts }
  return ballParticleShotsOf(state, screenOffsetOf(frame.camera)).map(({ id, img, x, y }) => ({ id, img, x, y }))
}
