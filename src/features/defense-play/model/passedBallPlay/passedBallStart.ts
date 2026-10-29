import { BATTING_POINT, battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import type { BattedBallTrajectory } from '@/entities/fielding/model/catchPrediction'
import { withCarriedSlack } from '@/entities/fielding/model/fielderPose'
import {
  AI_STATE,
  type FielderState,
  type PlayView,
  type RunnerState,
  createFielders,
  initialPlayView,
} from '@/entities/fielding/model/fieldingState'
import { PASSED_BALL_PLAY_KIND, type PassedBallShot } from '@/entities/fielding/model/passedBall'
import { type StealBase, stealTargetBaseOf } from '@/entities/fielding/model/stealStart'
import { type CatchForecast, forecastCatch } from '@/features/defense-play/model/catchForecast'
import { PITCHER_BALL_POINT, runCoverTick, runnerPlayBallInput } from '@/features/defense-play/model/coverTick'
import { DEFAULT_ABILITY, leadRunnersForPassedBall, passedBallRunnersOf } from '@/features/defense-play/model/passedBallPlay/passedBallRunners'
import type { PassedBallPlayInput } from '@/features/defense-play/model/passedBallPlay/passedBallTypes'
import { FUMBLE_MARK_TICKS } from '@/features/defense-play/model/playerEffects'
import { loadedRunnerAceOf, runnerAceIndexesOf } from '@/features/defense-play/model/runnerAces'
import type { RunnerPlayEngineInput } from '@/features/defense-play/model/runnerPlayEngine'

/** 0x3507c 의 쏘기 값 → 공 궤적 (머리말 — 메시지 0x11 의 덱 없는 갈래 51172). 시작점은 타구와 같은 0xcfb70 */
export function passedBallTrajectoryOf(shot: PassedBallShot): BattedBallTrajectory {
  return battedBallTrajectory([-shot.angle, shot.strength, shot.verticalSpeed, 0], { origin: BATTING_POINT })
}

/** 포수 칸 */
const CATCHER_SLOT = 1

/** 판 시작 — 예보 · 커버까지 세운 진행기 입력 (실시간이면 `startRunnerPlay` 에, 끝나면 `passedBallPlayResultOf`) */
export function passedBallPlayEngineInputOf(input: PassedBallPlayInput): RunnerPlayEngineInput {
  const abilities = input.defenseAbilities ?? Array.from({ length: 9 }, () => DEFAULT_ABILITY)
  const trajectory = passedBallTrajectoryOf(input.shot)
  const batterRuns = input.batterRuns === true
  const runners = passedBallRunnersOf(input, batterRuns)
  const coverRunners = coverRunnersOf(runners, input.stealingFrom ?? [])
  leadRunnersForPassedBall(runners, input, batterRuns)
  // ── 0xb284a: 예보(vt24, 추적야수 = 포수라 t ≤ 4 동안 포수를 건너뜀) → 고르기(vt34) ──
  // b2856 vt20(0) — b1144 가 +0xcc 쓰기(b1156)를 건너뛰어 앞 판이 남긴 값을 들고 연다(`DefenseScene.fielderSlack`, r196).
  // 예보 복제(0xb12d0)도 그 +0xcc 를 베낀다 — 막힌 복제는 판정 없이 복제 틱만 돈다(`forecastCatch`)
  const startFielders = withCarriedSlack(createFielders(abilities, input.defenseTeamBonus ?? 0), input.scene?.fielderSlack)
  const forecast = forecastCatch(trajectory, startFielders, { from: 0, to: Number.POSITIVE_INFINITY }, { initialChaserSlot: CATCHER_SLOT })
  const catchTick = Math.max(0, forecast.choice.catchTick)
  const started = runCoverTick({
    context: {
      play: openingPlayOf(forecast, catchTick),
      fielders: chasingFieldersOf(startFielders, forecast),
      runners: coverRunners,
      currentTick: 0,
      landingTick: trajectory.landingTick,
    },
    ...runnerPlayBallInput({ trajectory, startTick: 0 }, PITCHER_BALL_POINT, 0),
    relayFlag: true,
  })
  return {
    kind: PASSED_BALL_PLAY_KIND,
    fielders: started.fielders,
    play: started.play,
    relayFlag: started.relayFlag,
    runners,
    abilities,
    outs: input.outs,
    ballOnGround: false,
    chase: { trajectory, slot: forecast.choice.slot, catchTick, diveTicks: forecast.diveTicks, forecastCatchTick: forecast.choice.catchTick },
    ...passThroughOf(input, abilities.length),
  }
}

/**
 * 판 시작 vt30(b2884)이 보는 주자 — vt18(0xb284a)은 0x46418 의 타자주자 0xa93ac(4650e) · 목표 0xa9e44 · 리드 0x3d7b8 보다
 * 앞이라 루에 선 주자들뿐이다(도루 주자의 목표는 투구 중 0xa9bd4 가 세운 다음 루)
 */
function coverRunnersOf(runners: readonly RunnerState[], stealingFrom: readonly StealBase[]): RunnerState[] {
  return runners
    .filter((runner) => !runner.isBatterRunner)
    .map((runner) => (stealingFrom.includes(runner.startBase as StealBase) ? { ...runner, targetBase: stealTargetBaseOf(runner.startBase) } : runner))
}

/**
 * b2884 vt30 = 0xb1c90 — 판 시작 커버 · 키스톤 자리 (`coverTick.runCoverTick`, 그 뒤로는 진행기가 vt4c 끝에서 매 틱).
 * 고르기 vt34(b2878)가 쫓는 야수를 AI 1 로 둔다(b3e54 — 목표는 안 바꾼다). 공 첫 점 · 각은 메시지 0x11 이 쏜 폭투 공이다.
 * b3f5c — 외야 추적야수면 가장 가까운 외야수 AI 0xc(백업, `CatchForecast.backupSlot`, r180)
 */
function chasingFieldersOf(fielders: readonly FielderState[], forecast: CatchForecast): FielderState[] {
  return fielders.map((fielder) => {
    if (fielder.slot === forecast.choice.slot) return { ...fielder, aiState: AI_STATE.CHASE }
    return fielder.slot === forecast.backupSlot ? { ...fielder, aiState: AI_STATE.BACKUP } : fielder
  })
}

function openingPlayOf(forecast: CatchForecast, catchTick: number): PlayView {
  const chaserSlot = forecast.choice.slot
  return {
    ...initialPlayView(PASSED_BALL_PLAY_KIND),
    ballHolderSlot: chaserSlot,
    catchFielderSlot: chaserSlot,
    catchKind: forecast.choice.kind,
    catchTick,
    actionStartTick: forecast.choice.actionStartTick,
    // 0xb28b6: P+0x112 = 1
    everHeld: true,
  }
}

/** 판 입력에서 진행기 입력으로 그대로 넘기는 칸 */
function passThroughOf(input: PassedBallPlayInput, fielderCount: number) {
  return {
    random: input.random,
    fielderSkillIds: input.fielderSkillIds,
    defenseIsCpu: input.defenseIsCpu,
    throwMode: input.throwMode,
    manualThrowBase: input.manualThrowBase,
    offenseIsCpu: input.offenseIsCpu,
    runningMode: input.runningMode,
    aceIndexes: input.aceIndexes,
    defenseTeamIndex: input.defenseTeamIndex,
    fielderRecords: input.fielderRecords,
    offenseTeamIndex: input.offenseTeamIndex,
    fielderPlates: input.fielderPlates,
    runnerAceIndexes: runnerAceIndexesOf(input.runnerAces, input.bases),
    runnerAceSprite: loadedRunnerAceOf(input.runnerAces, input.bases),
    // 0x3e062(0x3e08c~0x3e092) — 판정이 포수 +0xb8 = 6 을 적고 0x17 로 간다(첫 그림 앞 야수 틱이 5 로 줄인다)
    fumbleMarks: Array.from({ length: fielderCount }, (_, slot) => (slot === CATCHER_SLOT ? FUMBLE_MARK_TICKS : 0)),
    scene: input.scene,
    sceneResultCode: input.sceneResultCode,
    controls: input.controls,
  }
}
