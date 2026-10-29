import { CATCH_KIND } from '@/entities/fielding/model/catchPrediction'
import { type WorldPoint, isSamePoint } from '@/entities/fielding/model/fieldGeometry'
import { FIELDER_ACTION, withAction, withCatchMotion, withFlyWaitPose } from '@/entities/fielding/model/fielderPose'
import { rollFumble } from '@/entities/fielding/model/fieldingErrors'
import { type FielderState, recordPlayerAbilityOf } from '@/entities/fielding/model/fieldingState'
import { isBallStoppedAt } from '@/features/defense-play/model/defensePlay/ball/ballPoint'
import { isCatchGateOpen } from '@/features/defense-play/model/defensePlay/catch/catchGate'
import { grabBall } from '@/features/defense-play/model/defensePlay/catch/grabBall'
import { DEFAULT_ABILITY, HIT_STAGGER_LOCK_TICKS } from '@/features/defense-play/model/defensePlay/constants'
import type { TickFrame } from '@/features/defense-play/model/defensePlay/step/tickFrame'
import type { DefensePlayState } from '@/features/defense-play/model/defensePlay/types/defensePlayState'
import { FUMBLE_MARK_TICKS } from '@/features/defense-play/model/playerEffects'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { pushPlayLog } from '@/features/defense-play/model/playLog'

/**
 * **1. 포구** — 포구 틱 갈래 전체(b4074~b42ce: 동작 시작 · 펌블 굴림 · 필살타법 표시 · 결과 코드 9 · 쥐기)는 플레이 틱 0xb401c 머리
 * b4064 의 플레이.vt50 = 0xb2ac8(`isCatchGateOpen`)이 참일 때만 돈다(직접 뜬 것). 하나라도 서면 b4072 b b42ce 로 포구 틱 갈래를
 * 통째로 건너뛴다.
 * 사건 코드는 같은 틱 뒤쪽 b44f6(6d 절)이 세우므로 담장선 · 낙구 틱에는 그 틱의 포구가 먼저 돈다. 그 뒤로는 아무도
 * 공을 쥐지 않아(펌블 굴림도 없다) 담장을 넘은 공으로 주자를 잡을 수 없다. 예전 웹은 이 관문이 없어 담장선을 넘어 홈런
 * 사건이 선 공을 쫓아간 야수가 쥐고 던져 홈에서 타자주자를 잡았다(원본 표 전체 CPU 수비 130판).
 * 아웃 판정 0xb36d0 의 종류 거르개 0x58d 에 6(홈런 — 0xb2bd8 의 0xb0cb8(6))이 없는 것은 원본 그대로다 — 쥔 야수가 없으니
 * 그 판정은 아무도 죽이지 못한다. 0xb2c58(vt54)도 사건 7 · 12 에만 야수 동작 0xf 를 주고 8 에는 안 준다(그대로 쫓는다)
 */
export function rollCatchTick(s: DefensePlayState, t: TickFrame): void {
  if (!isCatchGateOpen(s)) return
  setFlyWaitPose(s)
  if (t.tick === s.play.actionStartTick) startCatchMotion(s)
  if (t.tick !== s.catchTick) return
  // 필살타법 성공 타구(비트 4)는 야수가 쥐지 않고 지나친다 — 포구 자체를 건너뛴다 (0xaf180·0xbc3)
  if (s.uncatchable) {
    rollUncatchableHit(s, t)
    return
  }
  if (s.input.random !== undefined) rollFumbleAtCatch(s, t, s.input.random)
  if (!t.ballEventThisTick) grabBall(s, t)
}

/**
 * b40ca~b4130 (매 틱) — 잡을 야수(+0x170)가 서 있고(vt18) 목표점 x · z 가 포구 틱 공 점(0xa25b0(공, +0x174))과 같고
 * +0x174 < 공+0xaa0(낙구 틱) && 포구 종류 0 이면 vt9c 0xa1e44: 동작 0xc · 자세 +0xb2 (뜬공 기다리기 — 그동안 vtcc 가 거짓, r171).
 * 낙구가 없는 공은 +0xaa0 = −1(점 기록 a29f4 가 처음 높이 ≤ 0 에서만 적는다)이고 b4090 은 부호 있는 비교(ldrsh · bge)라
 * +0x174 < −1 이 거짓 — vt9c 를 안 건다(r176 확정, 웹 −1 과 같다)
 */
function setFlyWaitPose(s: DefensePlayState): void {
  const catcher = s.fielders[s.play.catchFielderSlot]
  const ballAtCatch = s.trajectory.pointAt(s.catchTick)
  if (catcher === undefined || !isWaitingUnderFly(s, catcher, ballAtCatch)) return
  s.fielders = s.fielders.map((fielder) => (fielder.slot === catcher.slot ? withFlyWaitPose(fielder) : fielder))
}

function isWaitingUnderFly(s: DefensePlayState, catcher: FielderState, ballAtCatch: WorldPoint): boolean {
  const beforeLanding = s.play.catchKind === CATCH_KIND.LOW && s.ballLandingTick >= 0 && s.catchTick < s.ballLandingTick
  const standingUnderBall = catcher.target.x === ballAtCatch.x && catcher.target.z === ballAtCatch.z
  return beforeLanding && isSamePoint(catcher.position, catcher.target) && standingUnderBall
}

/**
 * b4134~b419c — 공 틱이 동작 시작 틱(플레이+0x176)이면 포구 종류(+0x16c)대로 동작을 걸고, 표 0xd87f4 의 종류 3 은
 * 플레이+0x1f7 = 1(필살 점프 캐치) · 종류 4 는 +0x1f8 = 1(필살 슬라이딩 캐치).
 * 잡을 야수(+0x170)에게 포구 동작 · 자세 워드(`fielderPose.withCatchMotion`). 워드가 남는 동안 vtC4(던질 준비)가
 * 거짓이라 바운드 전 낮은 공(S+5)·점프(S+15)·슬라이딩(S+12) 포구는 준비 틱 R 보다 늦게 던질 수 있다(r171)
 */
function startCatchMotion(s: DefensePlayState): void {
  s.fielders = s.fielders.map((fielder) => (fielder.slot === s.play.catchFielderSlot ? withCatchMotion(fielder, s.play.catchKind) : fielder))
  if (s.play.catchKind === CATCH_KIND.JUMP) s.deadlyJumpArmed = true
  if (s.play.catchKind === CATCH_KIND.SLIDE) s.deadlySlideArmed = true
}

/**
 * 필살타법 타구 — 공 속성 목록 +0x5c 의 비트 4(0xaf180) 때문에 포구 틱 갈래가 쥐기 대신 메시지 0xbc3 · 사건(sp+0x24) = 1
 * (b4250). 그 0xbc3 에는 처리기가 없고, 틱 끝 b45a4 의 사건 갈래가 공을 그 야수에게서 튕겨 다시 쏜다(0xb3148)
 */
function rollUncatchableHit(s: DefensePlayState, t: TickFrame): void {
  // b4228 — 펌블 굴림 rand(0, 10000) 은 필살타법 표시를 보기(b4246) 전에 늘 먹는다
  if (s.input.random !== undefined) s.input.random.rand(0, 10_000)
  t.ballEventThisTick = true
  // b4258 sp+0x20 = 그 야수 → 틱 끝 b4588 플레이.vt74 = 0xb3420 → 야수.vte4 = 0xa1e60: 자세 13 · **+0xb4 = 15**(동작 잠금) ·
  // 효과음 53. 펌블(b4274~)은 sp+0x20 을 안 세워 이 잠금이 없다 — 펌블은 +0xb8 = 6(그림 0x4381a 만 읽는 세기)뿐이다.
  // vt74 는 vt70(0xb3148, 다시 쏘기 · 예보)보다 먼저라 새 예보의 복제가 이 잠금을 물려받는다
  s.fielders = s.fielders.map((fielder) =>
    fielder.slot === s.chaserSlot ? { ...withAction(fielder, FIELDER_ACTION.HIT_STAGGER), actionLockTicks: HIT_STAGGER_LOCK_TICKS } : fielder,
  )
  t.hitStaggerSoundThisTick = true
  pushPlayLog(s.log, () => `${t.tick}틱 ${s.chaserSlot}번 야수에게 필살타법 타구가 맞았다 (0xbc3)`)
}

/**
 * 펌블 굴림 (0xb41d0) — **움직이는 공을 잡을 때마다** 걸린다(뜬공 직접 포구 포함).
 * 굴러와 멈춘 공을 줍는 것만 빠진다 — 공.vt18 = 0xa27f0(지금 점의 속도·수직 속도 워드 == 0 && 높이 0) 이 0 일 때만.
 * 손으로 만든 시험 궤적(원본 칸 없음)은 마지막 점을 멈춘 점으로 본다.
 */
function rollFumbleAtCatch(s: DefensePlayState, t: TickFrame, random: RandomPort): void {
  const ballIsMoving = !isBallStoppedAt(s.trajectory, t.tick)
  const fumbled = rollFumble(recordPlayerAbilityOf(s.abilities, s.chaserSlot, DEFAULT_ABILITY), ballIsMoving, random)
  if (!fumbled) return
  s.fumbled = true
  s.fumbleMarks = s.fumbleMarks.map((value, slot) => (slot === s.chaserSlot ? FUMBLE_MARK_TICKS : value))
  // b4280: 야수+0xb8 = 6(놓침 동작) · 메시지 0xbc2 · 사건(sp+0x24) = 1 — 쥐지 않는다. 틱 끝 b45a4 가 플레이.vt70 = 0xb3148 로
  // 공을 그 야수 자리에서 지금 점의 속도·각으로 다시 쏘고 새 예보로 줍는 야수를 다시 고른다(`rollRelaunchFromFielder`)
  t.ballEventThisTick = true
  pushPlayLog(s.log, () => `${t.tick}틱 ${s.chaserSlot}번 야수 펌블 (0xbc2)`)
}
