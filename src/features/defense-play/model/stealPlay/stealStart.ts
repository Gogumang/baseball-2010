import { basePosition } from '@/entities/fielding/model/fieldGeometry'
import { placedAt, withCarriedSlack } from '@/entities/fielding/model/fielderPose'
import {
  AI_STATE,
  type FielderState,
  type PlayView,
  type RunnerState,
  createFielders,
  createRunner,
  initialPlayView,
} from '@/entities/fielding/model/fieldingState'
import { PICKOFF_COVER_OF_BASE } from '@/entities/fielding/model/pickoff'
import { applyRunnerLead, runnerLeadOf } from '@/entities/fielding/model/runnerLead'
import { STEAL_PLAY_KIND, stealTargetBaseOf } from '@/entities/fielding/model/stealStart'
import { CATCHER_BALL_POINT, runCoverTick, runnerPlayBallInput } from '@/features/defense-play/model/coverTick'
import { loadedRunnerAceOf, runnerAceIndexesOf } from '@/features/defense-play/model/runnerAces'
import type { RunnerPlayEngineInput } from '@/features/defense-play/model/runnerPlayEngine'
import type { StealPlayInput } from '@/features/defense-play/model/stealPlay/stealPlayTypes'
import { DEFAULT_ABILITY, occupiedBasesOf, stealRunnerSpeedOf } from '@/features/defense-play/model/stealPlay/stealStartRunners'

/**
 * 판 시작 — 야수 · 주자 · 리드(도루 주자마다 rand(0,9))까지 세운 진행기 입력. 실시간으로 돌릴 때는 이것을
 * `startRunnerPlay` 에 넣고, 다 돈 결과를 `stealPlayResultOf` 로 정리한다(굴림 차례는 `runStealPlay` 와 같다).
 */
export function stealPlayEngineInputOf(input: StealPlayInput): RunnerPlayEngineInput {
  const abilities = input.defenseAbilities ?? Array.from({ length: 9 }, () => DEFAULT_ABILITY)
  const covers = [...PICKOFF_COVER_OF_BASE]
  const fielders = coveringFieldersOf(input, abilities, covers)
  const play: PlayView = { ...initialPlayView(STEAL_PLAY_KIND), coverOfBase: covers, ballHolderSlot: CATCHER_SLOT, catchFielderSlot: CATCHER_SLOT }
  const { runners, coverRunners } = rollStealLeads(input)
  // ── b29d0 vt30 = 0xb1c90 한 번 (`coverTick.runCoverTick`) — 표는 [1, 2, 3, 4] 그대로(머리말)이고, 2루 커버가 아닌 유격수가
  //    0xb203a 로 자리(0xd8764 — 공 가진 포수는 내야라 기본 자리)를 잡아 AI 0xa 가 된다. 공은 0xa276c 의 점 하나(포수 자리 · 각 0) ──
  const started = runCoverTick({
    context: { play, fielders, runners: coverRunners, currentTick: 0, landingTick: 0 },
    ...runnerPlayBallInput(null, CATCHER_BALL_POINT, 0),
    relayFlag: true,
  })
  return {
    kind: STEAL_PLAY_KIND,
    fielders: started.fielders,
    // b29d4: 0xb2710(P, 1, 0) — 엔진이 첫 틱 앞에서 쥐게 하려고 쥠 칸을 세워 둔다. 쥐기는 +0x128 = 1 도 세운다(b2720)
    play: { ...started.play, held: true, everHeld: true, wantsThrow: true },
    relayFlag: started.relayFlag,
    runners,
    abilities,
    outs: input.outs,
    ballOnGround: true,
    ...passThroughOf(input),
  }
}

/** 포수 칸 */
const CATCHER_SLOT = 1

/**
 * b297a: 야수 1~4 를 제 루로(위치 · 목표 = 루 좌표) · 커버 = 루 + 1 — 홈은 b23a4 가 포수로 되돌려 표 그대로(머리말).
 * b295e vt20(0) — b1144 가 +0xcc 쓰기(b1156)를 건너뛰어 앞 판이 남긴 값을 들고 연다(`DefenseScene.fielderSlack`, r196)
 */
function coveringFieldersOf(input: StealPlayInput, abilities: readonly (number | null)[], covers: readonly number[]): FielderState[] {
  const created = withCarriedSlack(createFielders(abilities, input.defenseTeamBonus ?? 0), input.scene?.fielderSlack)
  return created.map((fielder) => {
    const base = covers.indexOf(fielder.slot)
    return base < 0 ? fielder : coveringFielderOf(fielder, base)
  })
}

/**
 * 0xbef58 = 0xbee60(위치 +0x20 · 구간 출발 +0x14 = 루 좌표) → vt14(루 좌표) — 판이 열리는 순간 **루 위에 서 있다**.
 * 목표는 vt14 관문이 열릴 때만 루 좌표다(+0xcc 가 남은 판은 시작 자리 — `placedAt`, r196).
 * b2564 가 커버 1·2·3루 야수에게 AI 루 + 2 · 포수는 고르기 0xb3b38 의 b3e54 가 AI 1(쫓기 — 쥐고 있어 안 움직인다).
 * b29d4·b29de: 포수가 공을 쥐고(0xb2710 → 야수+0xe0 = 1) 준비 틱은 0 (vt88(0) → +0xc8 = 0)
 */
function coveringFielderOf(fielder: FielderState, base: number): FielderState {
  const catcher = fielder.slot === CATCHER_SLOT
  return {
    ...placedAt(fielder, basePosition(base), base),
    aiState: catcher ? AI_STATE.CHASE : AI_STATE.COVER_HOME + base,
    holdingBall: catcher,
    actionRemainingTicks: 0,
  }
}

/**
 * 주자 목록 — 찬 루 오름차순(0xa9a10), 타자주자 없음(0x46418: state[0x11] · 종류 2·3 · state[0x1a] 가 아님).
 * 판 시작 vt30(b29d0)이 보는 주자(`coverRunners`) — 리드(0x46418 → 0x3d7b8)는 vt18 **뒤**라 아직 루 위다(목표는 0xa9bd4 가 세운 다음 루).
 * 0xa9bd4 → vt48(0xb6228) — 출발한 주자의 목표 루는 한 루 앞.
 * 0x46418 → 0x3d7b8: 플레이 시작 뒤 주자 목록 차례로 리드 틱을 몰아서 돌린다 (도루 주자는 rand(0,9) 한 번)
 */
function rollStealLeads(input: StealPlayInput): { readonly runners: RunnerState[]; readonly coverRunners: RunnerState[] } {
  const runners: RunnerState[] = []
  const coverRunners: RunnerState[] = []
  for (const base of occupiedBasesOf(input.bases)) {
    const runner = createRunner(runners.length + 1, base, stealRunnerSpeedOf(input, base), { isBatterRunner: false })
    const stealing = input.stealingFrom.includes(base)
    const started = stealing ? { ...runner, targetBase: stealTargetBaseOf(base) } : runner
    coverRunners.push(started)
    const lead = runnerLeadOf(started, { playKind: STEAL_PLAY_KIND, stealing, buntKind: input.buntKind, random: input.random })
    runners.push(applyRunnerLead(started, lead))
  }
  return { runners, coverRunners }
}

/** 판 입력에서 진행기 입력으로 그대로 넘기는 칸 */
function passThroughOf(input: StealPlayInput) {
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
    scene: input.scene,
    sceneResultCode: input.sceneResultCode,
    controls: input.controls,
  }
}
