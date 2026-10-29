import { contactOfOutcome } from '@/entities/batting/model/battedContact'
import { type FielderState, NONE } from '@/entities/fielding/model/fieldingState'
import { ballParticleFactsOf } from '@/features/defense-play/model/ballParticleFacts'
import { ballPointAt, isBallBeyondFence, isBallStoppedAt } from '@/features/defense-play/model/defensePlay/ball/ballPoint'
import { bigHitWatchOf } from '@/features/defense-play/model/defensePlay/start/bigHitWatch'
import type { TickFrame } from '@/features/defense-play/model/defensePlay/step/tickFrame'
import type { DefensePlayState } from '@/features/defense-play/model/defensePlay/types/defensePlayState'
import { type DefensePlayView, type ViewStateInput, holderMarkOf, viewStateOf } from '@/features/defense-play/model/defensePlayView'
import { loadedRunnerAceOf, runnerAceIndexesOf } from '@/features/defense-play/model/runnerAces'

/**
 * **5. 화면 스냅샷** — 판 틱 `at` 의 그림. 5 절은 이 틱이고, 판이 G2 에서만 닫힌 그림(`closingListFrame` — 8 절 뒤)은 다음 틱
 * 자리에서 한 번 더 찍는다. 파티클은 언제나 이 판 틱(`t.tick`)의 공으로 본다.
 */
export function snapshotAt(
  s: DefensePlayState,
  t: TickFrame,
  at: number,
  fieldersNow: readonly FielderState[],
  frozenCamera: boolean,
): DefensePlayView {
  return viewStateOf({
    tick: at,
    ...ballViewOf(s, at, fieldersNow),
    // 머리에서 경기 멈춤(+0x1993)이 서 있던 그림(레이저 발사 다음 그림) — 0x3f060 이 3f0a4 에서 돌아가 카메라가 안 움직인다
    cameraFrozen: frozenCamera,
    ...playersViewOf(s, at, fieldersNow),
    ...holderMarksViewOf(s),
    ballParticles: ballParticlesOf(s, t),
    runnerAceIndexes: runnerAceIndexesOf(s.input.runnerAces, s.input.bases),
    runnerAceSprite: loadedRunnerAceOf(s.input.runnerAces, s.input.bases),
    aceIndexes: s.input.aceIndexes,
    defenseTeamIndex: s.input.defenseTeamIndex,
    fielderRecords: s.input.fielderRecords,
    offenseTeamIndex: s.input.offenseTeamIndex,
  })
}

/** 공 · 카메라 칸 */
function ballViewOf(s: DefensePlayState, at: number, fieldersNow: readonly FielderState[]) {
  const ballInput = { tick: at, trajectory: s.trajectory, catchTick: s.catchTick, fielders: fieldersNow }
  const throwFlying = s.throwArrivalTick >= 0 && at < s.throwArrivalTick
  return {
    ball: ballPointAt({ ...ballInput, holderSlot: s.play.ballHolderSlot, held: s.play.held, uncatchable: s.uncatchable }),
    ballIsFlying: s.uncatchable ? at < s.trajectory.landingTick : at < s.catchTick || throwFlying,
    // 카메라 0x3f060 — 홈런(+0x111) · 폴 홈런(+0x129) 판에서 공.vt18(멈춤)이면 타자주자를 본다.
    // 멈춤은 관문 파울 갈래와 같은 읽기(지금 점의 속도 0)다. 홈런 판엔 쥔 공이 없다 — +0x111 · +0x129 는 아무도 쥐기 전(+0x112 == 0)의
    // 0x9d5bc 만 세우고, 선 뒤엔 포구 관문 b2af6 이 쥐기를 막는다 (U-115)
    ballStopped: isBallStoppedAt(s.trajectory, at),
    homeRunFlag: s.homeRunFlag,
    poleHomeRunFlag: s.play.suppressed,
    // 공 그리기 0x36dfc — 쥔 공(+0x12c)과 담장 뒤로 사라진 공은 공 · 그림자를 안 그린다
    ballHeld: s.play.held,
    ballBeyondFence: isBallBeyondFence(at, s.ballLandingTick, s.trajectory.fenceTick, s.homeRunFlag),
    // 공+0x68 — 0 이면 0x36dfc 36e24 가 공 · 그림자를 건너뛴다(판 첫 그림 · 송구 · 다시 쏜 그림)
    ballPlaybackTick: at - s.ballLaunchTick,
    // 레이저 잔상 0x37076 — +0x1991 동안 지금 공 궤적의 t = 0 점에서 공까지
    laserTrailFrom: s.laserTrailOn ? s.ballSegmentStart : null,
  }
}

/** 야수 · 주자 · 포구 동작 · 송구 동작 칸 */
function playersViewOf(s: DefensePlayState, at: number, fieldersNow: readonly FielderState[]) {
  const throwing = s.throwArrivalTick >= 0 && at >= s.throwReleaseTick && at < s.throwReleaseTick + THROW_MOTION_TICKS
  return {
    fielders: fieldersNow,
    runners: s.runners.map((runner) => runner.state),
    catchKind: at >= s.play.actionStartTick && at <= s.catchTick ? s.play.catchKind : null,
    chaserSlot: s.chaserSlot,
    throwingSlot: throwing ? s.throwFromSlot : NONE,
    throwBase: s.throwBase,
    previousActions: s.previousActions,
    previousTargetOf: (index: number) => s.runners.find((runner) => runner.state.index === index)?.previousTarget ?? NONE,
  }
}

/** 던진 뒤 송구 동작을 그리는 그림 수 */
const THROW_MOTION_TICKS = 3

/**
 * 그림에만 쓰이는 공 가진 야수 표시들.
 * 번쩍임(deadly_effect B·C)은 넘길 것이 없다 — 켜짐 칸 플레이+0x1f7·+0x1f8 을 세우는 것이
 * 포구 동작 분기표 0xd87f4 의 종류 3(점프)·4(슬라이딩)라 `catchKind` 로 이미 정해진다 (P2 2b, 확정). `defensePlayView.flashOf` 주석 참고.
 * 레이저 송구 반짝임(경기+0x19ad) — 0x43406~0x4342c 의 세 조건을 여기서 본다:
 * 공 쥔 야수(플레이+0x130) · 반짝임 켜짐 · deadly_effect A(+0x1990)가 안 돎.
 * A 는 **그리지 않는 줌 펀치**라 웹판에 상태 자체가 없다(R2 2절) — 셋째 조건은 늘 참으로 둔다(근사).
 * 공 가진 야수 고리 0x43cb0 — 경기+0x19ac · +0x130 · 공격 주체 · +0x19ad.
 * +0x19ac 는 쥐기 0xb2710 의 메시지 0x15(0x51872)만 세우고 0x17 진입이 지운다 = 이 판에 한 번이라도 쥐었나(`everHeld`).
 * +0x130 은 쥐기뿐 아니라 고르기 0xb3b38(b3e40)도 적는다 — 송구가 나가면 받을 야수로 바로 옮는다(`ballHolderSlot`)
 */
function holderMarksViewOf(s: DefensePlayState) {
  return {
    laserShiningSlot: s.laserShining && s.play.held ? s.play.ballHolderSlot : NONE,
    holderMark: holderMarkOf({
      grabbed: s.play.everHeld,
      holderSlot: s.play.ballHolderSlot,
      offenseIsCpu: s.input.offenseIsCpu === true,
      isShining: s.laserShining,
    }),
    holderPlate: s.input.fielderPlates?.[s.play.ballHolderSlot] ?? null,
    fumbleTicks: s.fumbleMarks,
    throwErrorTicks: s.throwErrorMarks,
  }
}

/**
 * 공 그리기 0x36dfc 의 큰 타구 · 튐 파티클 — 진행기 쪽 조건 (`ballParticleFactsOf`).
 * 튐은 공을 **궤적에서 읽어 그리는 틱**(`ballPointAt` 의 궤적 갈래 — 잡히기 전 · 못 잡는 공 · 송구 · 튕긴 공 · 안 쥔 공)에만 본다.
 * 0x36dfc 의 파티클은 공 그림 깃발 [sp+0x58](+0x12c == 0, 36e8a~36ef8)이 선 그림에서만 돈다 — 받는 틱이 지난 안 쥔 공도 본다 (r313)
 * 날아가는 송구도 이 갈래다 — 송구공은 세계 공(`launchThrow`)을 이 틱부터 이어 깔고(`takeLooseBall` 의 `spliceTrajectory`)
 * 받는 틱 = 예보 포구 틱(catchTick = throwArrivalTick)이라, 0x36dfc 가 [장면+0x204] 공을 그리듯 송구 공 점으로 튐을 본다 (A-29)
 */
function ballParticlesOf(s: DefensePlayState, t: TickFrame): ViewStateInput['ballParticles'] {
  return ballParticleFactsOf({
    ballTick: t.tick,
    at: t.tick,
    trajectory: s.trajectory,
    onTrajectory: s.uncatchable || !s.play.held || t.tick < s.catchTick,
    bigHitWatch: s.input.bigHitWatch ?? bigHitWatchOf(s.input),
    playKind: s.play.kind,
    resultCode: contactOfOutcome(s.input.outcome)?.resultCode ?? null,
  })
}
